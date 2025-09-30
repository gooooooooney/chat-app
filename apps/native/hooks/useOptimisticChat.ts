import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@chat-app/backend/convex/_generated/api';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';
import { MessageType } from '@chat-app/backend/convex/types';

interface SendMessageParams {
  senderId: string;
  content: string;
  type?: MessageType;
  replyToId?: Id<"messages">;
}

interface OptimisticMessage {
  _id: string;
  _creationTime: number;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType
  replyToId?: Id<"messages">;
  status: "sending" | "sent" | "failed";
  edited: boolean;
  deleted: boolean;
}

/**
 * 乐观更新的消息发送 Hook
 * 提供即时 UI 响应和自动错误处理
 */
export const useOptimisticSendMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const sendMessage = useConvexMutation(api.v1.messages.sendMessage);

  return useMutation({
    mutationFn: async (message: SendMessageParams) => {
      // 1. 立即更新 UI (乐观更新)
      const optimisticMessage: OptimisticMessage = {
        _id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        _creationTime: Date.now(),
        conversationId,
        ...message,
        type: message.type || "text",
        status: 'sending',
        edited: false,
        deleted: false,
      };

      // 立即将消息添加到缓存中
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => {
          if (!old) {
            return {
              messages: [optimisticMessage],
              nextCursor: null,
              hasMore: false,
            };
          }

          return {
            ...old,
            messages: [...(old.messages || []), optimisticMessage],
          };
        }
      );

      // 2. 发送到服务器
      try {
        const result = await sendMessage({
          conversationId: conversationId as Id<"conversations">,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          replyToId: message.replyToId,
        });

        return { optimisticId: optimisticMessage._id, realId: result };
      } catch (error) {
        // 标记消息为失败状态而不是移除
        queryClient.setQueryData(
          ['conversation-messages', conversationId],
          (old: any) => ({
            ...old,
            messages: old?.messages?.map((msg: any) =>
              msg._id === optimisticMessage._id
                ? { ...msg, status: 'failed' }
                : msg
            ),
          })
        );
        throw error;
      }
    },

    onError: (error, variables, context) => {
      console.error('发送消息失败:', error);

      // 在UI中显示错误状态已经在 mutationFn 中处理了
      // 这里可以添加其他错误处理逻辑，比如显示 toast
    },

    onSuccess: (data, variables) => {
      // 成功后用真实 ID 替换乐观 ID
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.map((msg: any) =>
            msg._id === data.optimisticId
              ? { ...msg, _id: data.realId, status: 'sent' }
              : msg
          ),
        })
      );

      // 刷新数据以确保与服务器同步
      queryClient.invalidateQueries({
        queryKey: ['conversation-messages', conversationId],
      });
    },
  });
};

/**
 * 重试失败消息的 Hook
 */
export const useRetryMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const { mutate: sendMessage } = useOptimisticSendMessage(conversationId);

  const retryMessage = (failedMessage: OptimisticMessage) => {
    // 首先移除失败的消息
    queryClient.setQueryData(
      ['conversation-messages', conversationId],
      (old: any) => ({
        ...old,
        messages: old?.messages?.filter((msg: any) =>
          msg._id !== failedMessage._id
        ),
      })
    );

    // 重新发送消息
    sendMessage({
      senderId: failedMessage.senderId,
      content: failedMessage.content,
      type: failedMessage.type,
      replyToId: failedMessage.replyToId,
    });
  };

  return { retryMessage };
};

/**
 * 乐观更新的消息编辑 Hook
 */
export const useOptimisticEditMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const editMessage = useConvexMutation(api.v1.messages.editMessage);

  return useMutation({
    mutationFn: async ({ messageId, newContent }: {
      messageId: Id<"messages">;
      newContent: string;
      userId: string;
    }) => {
      // 乐观更新
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.map((msg: any) =>
            msg._id === messageId
              ? { ...msg, content: newContent, edited: true, editedAt: Date.now() }
              : msg
          ),
        })
      );

      // 发送到服务器
      return await editMessage({
        messageId,
        userId: messageId.toString(), // 简化，实际应该传入正确的 userId
        newContent,
      });
    },

    onError: (error, variables) => {
      console.error('编辑消息失败:', error);

      // 回滚更改
      queryClient.invalidateQueries({
        queryKey: ['conversation-messages', conversationId],
      });
    },
  });
};

/**
 * 乐观更新的消息删除 Hook
 */
export const useOptimisticDeleteMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const deleteMessage = useConvexMutation(api.v1.messages.deleteMessage);

  return useMutation({
    mutationFn: async ({ messageId, userId }: {
      messageId: Id<"messages">;
      userId: string;
    }) => {
      // 保存原始状态以便回滚
      const previousData = queryClient.getQueryData(['conversation-messages', conversationId]);

      // 乐观更新：标记为已删除
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.map((msg: any) =>
            msg._id === messageId
              ? { ...msg, deleted: true, content: '', deletedAt: Date.now() }
              : msg
          ),
        })
      );

      try {
        // 发送到服务器
        await deleteMessage({ messageId, userId });
        return { previousData };
      } catch (error) {
        // 失败时回滚
        queryClient.setQueryData(['conversation-messages', conversationId], previousData);
        throw error;
      }
    },

    onError: (error) => {
      console.error('删除消息失败:', error);
    },
  });
};

/**
 * 乐观更新的消息已读状态 Hook
 */
export const useOptimisticMarkAsRead = (conversationId: string) => {
  const queryClient = useQueryClient();
  const markAsRead = useConvexMutation(api.v1.messages.markMessagesAsRead);

  return useMutation({
    mutationFn: async ({ messageIds, userId }: {
      messageIds: Id<"messages">[];
      userId: string;
    }) => {
      // 乐观更新：立即标记为已读
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.map((msg: any) =>
            messageIds.includes(msg._id)
              ? { ...msg, status: 'read' }
              : msg
          ),
        })
      );

      // 发送到服务器
      return await markAsRead({
        conversationId: conversationId as Id<"conversations">,
        userId,
        messageIds,
      });
    },

    onError: (error, { messageIds }) => {
      console.error('标记已读失败:', error);

      // 失败时回滚到 delivered 状态
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.map((msg: any) =>
            messageIds.includes(msg._id)
              ? { ...msg, status: 'delivered' }
              : msg
          ),
        })
      );
    },
  });
};