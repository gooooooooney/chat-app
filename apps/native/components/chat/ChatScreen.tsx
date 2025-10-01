import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { MessageInput } from './MessageInput';
import { LoadingScreen } from './LoadingScreen';
import { ErrorScreen } from './ErrorScreen';
import { useChat } from '@/hooks/useChat';
import { useOptimisticSendMessage, useRetryMessage } from '@/hooks/useOptimisticChat';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '@chat-app/backend/convex/_generated/api';


export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: Id<"conversations"> }>();
  const router = useRouter();
  const currentUser = useQuery(api.auth.getCurrentUser);
  const currentUserId = currentUser?._id || '';

  const {
    conversation,
    messages,
    hasMore,
    loading,
    error,
    sendMessage,
    clearError,
  } = useChat({
    conversationId,
    userId: currentUserId
  });

  // 乐观更新 hooks
  const { mutate: optimisticSendMessage, isPending: isSending } = useOptimisticSendMessage(conversationId || '');
  const { retryMessage } = useRetryMessage(conversationId || '');

  // Transform participants data to match ChatHeader interface
  const transformedParticipants = useMemo(() => {
    return (conversation?.participants || [])
      .filter((p) => p != null)
      .map((p) => ({
        userId: p.userId || p._id,
        displayName: p.displayName || '未知用户',
        avatar: p.avatar,
        presence: p.presence || 'offline' as const,
      }));
  }, [conversation?.participants]);

  // Transform messages data to match ChatMessageList interface
  const transformedMessages = useMemo(() => {
    return messages.map((msg) => ({
      _id: msg._id,
      content: msg.content,
      senderId: msg.senderId,
      type: msg.type || 'text',
      status: (msg.status === 'sending' || msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'read' || msg.status === 'failed')
        ? msg.status
        : 'sent' as any,
      createdAt: msg._creationTime,
      // 图片相关字段
      imageUrl: msg.imageUrl,
      imageMetadata: msg.imageMetadata,
      uploadStatus: msg.uploadStatus,
      localImageUri: msg.localImageUri,
      sender: {
        userId: msg.sender?.userId || msg.senderId,
        displayName: msg.sender?.displayName || '未知用户',
        avatar: msg.sender?.avatar,
      },
    }));
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !conversationId || !currentUserId) return;

    // 使用乐观更新发送消息
    optimisticSendMessage({
      senderId: currentUserId,
      content: content.trim(),
      type: "text",
    });
  };

  const handleRetryMessage = (messageId: string) => {
    // 找到失败的消息
    const failedMessage = transformedMessages.find(msg => msg._id === messageId);
    if (failedMessage) {
      retryMessage({
        _id: failedMessage._id,
        _creationTime: failedMessage.createdAt,
        conversationId: conversationId || '',
        senderId: failedMessage.senderId,
        content: failedMessage.content,
        type: failedMessage.type,
        status: 'failed',
        edited: false,
        deleted: false,
      });
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleRetry = () => {
    clearError();
  };

  // Loading state
  if (loading) {
    return <LoadingScreen />;
  }

  // Error state
  if (error) {
    return <ErrorScreen error={error} onRetry={handleRetry} />;
  }

  // Conversation not found
  if (!conversation) {
    return (
      <ErrorScreen
        error="聊天会话不存在或已被删除"
        onRetry={handleBack}
      />
    );
  }


  return (
      <View className="flex-1 bg-background">
        <ChatHeader
          conversation={{
            type: conversation.type,
            name: conversation.name,
            participants: transformedParticipants,
          }}
          onBack={handleBack}
        />

        <ChatMessageList
          messages={transformedMessages}
          currentUserId={currentUserId}
          hasMore={hasMore}
          onRetryMessage={handleRetryMessage}
        />

        <MessageInput
          conversationId={conversationId}
          currentUserId={currentUserId}
          onSendMessage={handleSendMessage}
          disabled={isSending || !currentUserId}
        />
      </View>
  );
}