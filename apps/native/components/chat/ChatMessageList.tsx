import React, { useRef, useEffect } from 'react';
import { View, FlatList } from 'react-native';
import { MessageBubble } from './MessageBubble';
import { Text } from '@/components/ui/text';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';

interface Message {
  _id: Id<"messages">;
  content: string;
  senderId: string;
  type: "text" | "image" | "file" | "system";
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  createdAt: number;
  sender: {
    userId: string;
    displayName: string;
    avatar?: string;
  };
}

interface ChatMessageListProps {
  messages: Message[];
  currentUserId: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export function ChatMessageList({
  messages,
  currentUserId,
  onLoadMore,
  hasMore = false,
  loading = false,
}: ChatMessageListProps) {
  const flatListRef = useRef<FlatList>(null);

  // 新消息自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const renderMessage = ({ item: message, index }: { item: Message; index: number }) => {
    const isOwn = message.senderId === currentUserId;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showAvatar = !isOwn && (!prevMessage || prevMessage.senderId !== message.senderId);

    return (
      <MessageBubble
        key={message._id}
        message={message}
        isOwn={isOwn}
        senderInfo={message.sender}
        showAvatar={showAvatar}
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

  // 优化大量消息的性能 - 如果消息高度固定可以启用
  // const getItemLayout = (data: any, index: number) => ({
  //   length: 80, // 估算的消息高度
  //   offset: 80 * index,
  //   index,
  // });

  if (messages.length === 0) {
    return renderEmptyState();
  }

  return (
    <View className="flex-1">
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.1}
        ListHeaderComponent={renderLoadMoreHeader}
        contentContainerStyle={{
          paddingVertical: 16,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
        // 性能优化
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        initialNumToRender={15}
        // getItemLayout={getItemLayout} // 如果消息高度固定可以启用
        // 优化滚动性能
        disableIntervalMomentum={true}
        scrollEventThrottle={16}
      />
    </View>
  );
}