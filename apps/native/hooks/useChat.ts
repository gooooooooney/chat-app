import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';
import { api } from '@chat-app/backend/convex/_generated/api';

export interface UseChatProps {
  conversationId: Id<"conversations">;
  userId: string;
}

export function useChat({ conversationId, userId }: UseChatProps) {
  const [error, setError] = useState<string | null>(null);

  // 获取会话信息 - 使用 TanStack Query
  const { data: conversation } = useQuery(
    convexQuery(api.v1.conversations.getConversationById, {
      conversationId,
      userId
    })
  );

  // 获取消息列表 - 使用 TanStack Query 并启用缓存
  const { data: messagesData } = useQuery(
    convexQuery(api.v1.messages.getConversationMessages, {
      conversationId,
      userId,
      limit: 50,
    })
  );

  // 发送消息
  const sendMessageMutation = useMutation({
    mutationFn: useConvexMutation(api.v1.messages.sendMessage),
  });

  // 标记消息已读
  const markAsReadMutation = useMutation({
    mutationFn: useConvexMutation(api.v1.messages.markMessagesAsRead),
  });

  const handleSendMessage = async (content: string, type: "text" | "image" = "text") => {
    if (!content.trim()) return;

    try {
      const messageId = await sendMessageMutation.mutateAsync({
        conversationId,
        senderId: userId,
        content: content.trim(),
        type,
      });

      setError(null);
      return messageId;
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('发送消息失败，请重试');
      throw err;
    }
  };

  const handleMarkAsRead = useCallback(async (messageIds: Id<"messages">[]) => {
    try {
      await markAsReadMutation.mutateAsync({
        conversationId,
        userId,
        messageIds,
      });
    } catch (err) {
      console.error('Failed to mark messages as read:', err);
      // 标记已读失败不需要显示错误给用户
    }
  }, [markAsReadMutation, conversationId, userId]);

  // 跟踪已经标记为已读的消息，避免重复标记
  const markedAsReadRef = useRef<Set<string>>(new Set());

  // 自动标记可见消息为已读
  useEffect(() => {
    if (messagesData?.messages && messagesData.messages.length > 0) {
      const unreadMessages = messagesData.messages
        .filter((msg) => msg.senderId !== userId && !markedAsReadRef.current.has(msg._id))
        .map((msg) => msg._id as Id<"messages">);

      if (unreadMessages.length > 0) {
        // 记录这些消息已经被标记，避免重复
        unreadMessages.forEach(id => markedAsReadRef.current.add(id));
        handleMarkAsRead(unreadMessages);
      }
    }
  }, [messagesData?.messages?.length, userId, handleMarkAsRead]);

  return {
    conversation,
    messages: messagesData?.messages || [],
    hasMore: messagesData?.hasMore || false,
    loading: conversation === undefined || messagesData === undefined,
    error,
    sendMessage: handleSendMessage,
    markAsRead: handleMarkAsRead,
    clearError: () => setError(null),
  };
}