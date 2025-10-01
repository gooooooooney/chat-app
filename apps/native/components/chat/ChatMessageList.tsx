import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { LegendList, LegendListRef, LegendListRenderItemProps } from '@legendapp/list';
import { MessageBubble } from './MessageBubble';
import { ImageMessageBubble } from './ImageMessageBubble';
import { Text } from '@/components/ui/text';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';
import { MessageType } from '@chat-app/backend/convex/types';

interface Message {
  _id: Id<"messages">;
  content: string;
  senderId: string;
  type: MessageType;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  createdAt: number;
  sender: {
    userId: string;
    displayName: string;
    avatar?: string;
  };
  // 图片相关字段
  imageUrl?: string;
  imageMetadata?: {
    width: number;
    height: number;
    size: number;
    mimeType: string;
  };
  uploadStatus?: "uploading" | "completed" | "failed";
  localImageUri?: string; // 本地图片URI（上传中使用）
}

interface ChatMessageListProps {
  messages: Message[];
  currentUserId: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  onRetryMessage?: (messageId: string) => void;
  onImagePress?: (messageId: string) => void;
}

export function ChatMessageList({
  messages,
  currentUserId,
  onLoadMore,
  hasMore = false,
  loading = false,
  onRetryMessage,
  onImagePress,
}: ChatMessageListProps) {
  const listRef = useRef<LegendListRef | null>(null);

  // 新消息自动滚动到底部
  useEffect(() => {
    console.log(JSON.stringify(messages, null, 2))
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const renderMessage = ({ item: message, index }: LegendListRenderItemProps<Message>) => {
    const isOwn = message.senderId === currentUserId;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showAvatar = !isOwn && (!prevMessage || prevMessage.senderId !== message.senderId);

    const handleRetry = () => {
      if (onRetryMessage) {
        onRetryMessage(message._id);
      }
    };

    const handleImagePress = () => {
      if (onImagePress && message.imageUrl && message.uploadStatus === 'completed') {
        onImagePress(message._id);
      }
    };

    // 根据消息类型渲染不同的组件
    if (message.type === 'image') {
      return (
        <View key={message._id} className={`flex-row mb-3 px-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          {/* 左侧头像占位（对方消息） */}
          {!isOwn && <View className="w-8 mr-2" />}

          <ImageMessageBubble
            message={{
              _id: message._id,
              imageUrl: message.imageUrl,
              imageMetadata: message.imageMetadata,
              status: message.uploadStatus,
              createdAt: message.createdAt,
              localImageUri: message.localImageUri,
            }}
            isOwn={isOwn}
            onPress={handleImagePress}
            onRetry={handleRetry}
          />

          {/* 右侧占位（自己的消息） */}
          {isOwn && <View className="w-8 ml-2" />}
        </View>
      );
    }

    // 文本消息
    return (
      <MessageBubble
        key={message._id}
        message={message}
        isOwn={isOwn}
        senderInfo={message.sender}
        showAvatar={showAvatar}
        onRetry={handleRetry}
      />
    );
  };

  const renderLoadMoreHeader = () => {
    if (!hasMore) return null;

    return (
      <View className="py-4 items-center">
        {loading ? (
          <Text variant="muted" className="text-sm">
            加载中...
          </Text>
        ) : (
          <Text variant="muted" className="text-sm">
            上拉加载更多
          </Text>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-6">
      <Text variant="muted" className="text-center">
        还没有消息，发送第一条消息开始聊天吧！
      </Text>
    </View>
  );

  if (messages.length === 0) {
    return renderEmptyState();
  }

  return (
    <View className="flex-1">
      <LegendList
        ref={listRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        recycleItems={true}
        maintainVisibleContentPosition
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.1}
        ListHeaderComponent={renderLoadMoreHeader}
        contentContainerStyle={{
          paddingVertical: 16,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}