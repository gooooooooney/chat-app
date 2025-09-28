import React from 'react';
import { View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { MessageInput } from './MessageInput';
import { LoadingScreen } from './LoadingScreen';
import { ErrorScreen } from './ErrorScreen';
import { useChat } from '@/hooks/useChat';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '@chat-app/backend/convex/_generated/api';


export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
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
    conversationId: conversationId as Id<"conversations">,
    userId: currentUserId
  });

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !conversationId) return;

    try {
      await sendMessage(content);
    } catch (err) {
      // Error is handled in the hook
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

  // Transform participants data to match ChatHeader interface
  const transformedParticipants = (conversation.participants || [])
    .filter((p: any) => p != null)
    .map((p: any) => ({
      userId: p.userId || p._id,
      displayName: p.displayName || '未知用户',
      avatar: p.avatar,
      presence: p.presence || 'offline' as const,
    }));

  // Transform messages data to match ChatMessageList interface
  const transformedMessages = messages.map((msg: any) => ({
    _id: msg._id,
    content: msg.content,
    senderId: msg.senderId,
    type: msg.type || 'text',
    status: (msg.status === 'sending' || msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'read' || msg.status === 'failed')
      ? msg.status
      : 'sent' as const,
    createdAt: msg.createdAt,
    sender: {
      userId: msg.sender?.userId || msg.senderId,
      displayName: msg.sender?.displayName || '未知用户',
      avatar: msg.sender?.avatar,
    },
  }));

  return (
    <KeyboardProvider>
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
        />

        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={false}
        />
      </View>
    </KeyboardProvider>
  );
}