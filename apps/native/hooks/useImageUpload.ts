import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@chat-app/backend/convex/_generated/api';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';

interface UploadImageParams {
  conversationId: Id<"conversations">;
  senderId: string;
  imageUri: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  size?: number;
  replyToId?: Id<"messages">;
}

/**
 * Hook for uploading images to R2 and creating messages
 * Following the @convex-dev/r2 pattern:
 * 1. generateUploadUrl() -> {url, key}
 * 2. Upload file to presigned URL
 * 3. syncMetadata() to finalize
 * 4. Create message with imageKey
 */
export const useImageUpload = () => {
  const queryClient = useQueryClient();

  // R2 component API - generates presigned URL and returns key
  const generateUploadUrl = useConvexMutation(api.r2.generateUploadUrl);
  const syncMetadata = useConvexMutation(api.r2.syncMetadata);

  // Custom mutation to create message with image
  const createImageMessage = useConvexMutation(api.v1.messages.sendMessage);

  return useMutation({
    mutationFn: async (params: UploadImageParams) => {
      const {
        conversationId,
        senderId,
        imageUri,
        fileName = 'image.jpg',
        mimeType = 'image/jpeg',
        width,
        height,
        size,
        replyToId,
      } = params;

      // 1. 创建乐观更新的消息
      const optimisticId = `temp_img_${Date.now()}`;
      const optimisticMessage = {
        _id: optimisticId,
        _creationTime: Date.now(),
        conversationId,
        senderId,
        content: '[图片]',
        type: 'image' as const,
        uploadStatus: 'uploading' as const,
        imageKey: undefined,
        imageMetadata: width && height ? { width, height, size: size || 0, mimeType } : undefined,
        replyToId,
        edited: false,
        deleted: false,
      };

      // 2. 立即更新 UI 显示上传中状态
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: [...(old?.messages || []), optimisticMessage],
        })
      );

      try {
        // 3. 生成 R2 上传 URL（R2 组件自动生成 UUID key）
        const { url: uploadUrl, key: imageKey } = await generateUploadUrl({});

        // 4. 上传图片到 R2 presigned URL
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': mimeType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`上传到 R2 失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        // 5. 同步元数据到 Convex（触发 onUpload 回调）
        await syncMetadata({ key: imageKey });

        // 6. 创建包含图片的消息
        const messageId = await createImageMessage({
          conversationId,
          senderId,
          content: '[图片]',
          type: 'image' as const,
          imageKey,
          imageMetadata: width && height ? { width, height, size: size || 0, mimeType } : undefined,
          replyToId,
        });

        return { optimisticId, realMessageId: messageId, imageKey };
      } catch (error) {
        // 7. 失败时标记为失败状态
        queryClient.setQueryData(
          ['conversation-messages', conversationId],
          (old: any) => ({
            ...old,
            messages: old?.messages?.map((msg: any) =>
              msg._id === optimisticId
                ? { ...msg, uploadStatus: 'failed' }
                : msg
            ),
          })
        );
        throw error;
      }
    },

    onSuccess: (data, variables) => {
      // 成功后移除乐观更新，让实际数据通过 Convex 订阅显示
      queryClient.setQueryData(
        ['conversation-messages', variables.conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.filter((msg: any) => msg._id !== data.optimisticId),
        })
      );

      // 刷新会话消息列表（Convex 会返回带 imageUrl 的完整数据）
      queryClient.invalidateQueries({
        queryKey: ['conversation-messages', variables.conversationId],
      });
    },

    onError: (error, variables) => {
      console.error('图片上传失败:', error);

      // 可选：一段时间后移除失败的消息
      setTimeout(() => {
        queryClient.setQueryData(
          ['conversation-messages', variables.conversationId],
          (old: any) => ({
            ...old,
            messages: old?.messages?.filter((msg: any) =>
              msg.uploadStatus !== 'failed'
            ),
          })
        );
      }, 5000);
    },
  });
};