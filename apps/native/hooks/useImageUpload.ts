import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@chat-app/backend/convex/_generated/api';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';

interface UploadImageParams {
  conversationId: string;
  senderId: string;
  imageUri: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  size?: number;
  replyToId?: Id<"messages">;
}

export const useImageUpload = () => {
  const queryClient = useQueryClient();
  const generateUploadUrl = useConvexMutation(api.v1.images.generateImageUploadUrl);
  const completeUpload = useConvexMutation(api.v1.images.completeImageUpload);

  return useMutation({
    mutationFn: async (params: UploadImageParams) => {
      const {
        conversationId,
        senderId,
        imageUri,
        fileName,
        mimeType,
        width,
        height,
        size = 0,
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
        status: 'uploading' as const,
        imageUrl: imageUri, // 先显示本地图片
        imageMetadata: { width, height, size, mimeType },
        replyToId,
        edited: false,
        deleted: false,
      };

      // 2. 立即更新 UI
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: [...(old?.messages || []), optimisticMessage],
        })
      );

      try {
        // 3. 获取上传 URL
        const { uploadUrl, fileKey } = await generateUploadUrl({
          conversationId: conversationId as Id<"conversations">,
          userId: senderId,
          fileName,
          contentType: mimeType,
        });

        // 4. 上传图片到 R2
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const uploadResponse = await fetch(uploadUrl.url, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': mimeType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('上传到 R2 失败');
        }

        // 5. 完成上传并创建消息
        const messageId = await completeUpload({
          conversationId: conversationId as Id<"conversations">,
          senderId,
          fileKey,
          metadata: { width, height, size, mimeType },
          replyToId,
        });

        return { optimisticId, realMessageId: messageId, fileKey };
      } catch (error) {
        // 6. 失败时标记为失败状态
        queryClient.setQueryData(
          ['conversation-messages', conversationId],
          (old: any) => ({
            ...old,
            messages: old?.messages?.map((msg: any) =>
              msg._id === optimisticId
                ? { ...msg, status: 'failed' }
                : msg
            ),
          })
        );
        throw error;
      }
    },

    onSuccess: (data, variables) => {
      // 成功后用真实 ID 和云端 URL 替换乐观更新
      queryClient.setQueryData(
        ['conversation-messages', variables.conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.map((msg: any) =>
            msg._id === data.optimisticId
              ? { 
                  ...msg, 
                  _id: data.realMessageId, 
                  status: 'sent',
                  // imageUrl 会在重新查询时更新为 R2 URL
                }
              : msg
          ),
        })
      );

      // 刷新数据以获取最新的图片 URL
      queryClient.invalidateQueries({
        queryKey: ['conversation-messages', variables.conversationId],
      });
    },

    onError: (error, _variables) => {
      console.error('图片上传失败:', error);
    },
  });
};