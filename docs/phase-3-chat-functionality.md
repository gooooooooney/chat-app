# Phase 3: 聊天功能核心实现

> 实时聊天功能的业务逻辑和状态管理实现指南

## 1. 概述

本阶段实现聊天系统的核心功能，包括实时消息传递、状态管理、用户体验优化等关键业务逻辑。

## 2. 核心功能架构

### 2.1 状态管理架构

```typescript
// apps/native/hooks/useChat.ts
import { useQuery, useMutation } from 'convex/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface UseChatOptions {
  conversationId: Id<"conversations">;
  currentUserId: string;
  initialPageSize?: number;
}

export function useChat({ conversationId, currentUserId, initialPageSize = 20 }: UseChatOptions) {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadedAll, setHasLoadedAll] = useState(false);
  const scrollRef = useRef<any>(null);
  
  // 获取会话信息
  const conversation = useQuery(api.conversations.getById, { 
    conversationId,
    userId: currentUserId 
  });
  
  // 获取消息列表 (分页)
  const { results: messages, status, loadMore } = usePaginatedQuery(
    api.messages.getConversationMessages,
    { conversationId, userId: currentUserId },
    { initialNumItems: initialPageSize }
  );
  
  // 发送消息
  const sendMessageMutation = useMutation(api.messages.sendMessage);
  const markAsReadMutation = useMutation(api.messages.markMessagesAsRead);
  
  // 发送文本消息
  const sendMessage = useCallback(async (content: string, type: "text" | "image" = "text") => {
    if (!content.trim()) return;
    
    try {
      const messageId = await sendMessageMutation({
        conversationId,
        senderId: currentUserId,
        content: content.trim(),
        type,
      });
      
      // 发送成功后滚动到底部
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      return messageId;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [conversationId, currentUserId, sendMessageMutation]);
  
  // 加载更多消息
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || hasLoadedAll || status !== "CanLoadMore") return;
    
    setIsLoadingMore(true);
    try {
      await loadMore(20);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasLoadedAll, status, loadMore]);
  
  // 标记消息已读
  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    
    try {
      await markAsReadMutation({
        conversationId,
        userId: currentUserId,
        messageIds: messageIds as Id<"messages">[],
      });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [conversationId, currentUserId, markAsReadMutation]);
  
  // 自动标记可见消息为已读
  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const unreadMessageIds = viewableItems
      .map((item: any) => item.item)
      .filter((message: any) => 
        message.senderId !== currentUserId && 
        message.status !== 'read'
      )
      .map((message: any) => message._id);
    
    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(unreadMessageIds);
    }
  }, [currentUserId, markMessagesAsRead]);
  
  return {
    // 数据
    conversation,
    messages: messages || [],
    
    // 状态
    isLoading: status === "LoadingFirstPage",
    isLoadingMore,
    hasMore: status === "CanLoadMore",
    
    // 操作
    sendMessage,
    loadMoreMessages,
    markMessagesAsRead,
    handleViewableItemsChanged,
    
    // Refs
    scrollRef,
  };
}
```

### 2.2 实时消息监听

```typescript
// apps/native/hooks/useRealtimeMessages.ts
import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface UseRealtimeMessagesOptions {
  conversationId: Id<"conversations">;
  currentUserId: string;
  onNewMessage?: (message: any) => void;
  onMessageUpdate?: (message: any) => void;
}

export function useRealtimeMessages({
  conversationId,
  currentUserId,
  onNewMessage,
  onMessageUpdate,
}: UseRealtimeMessagesOptions) {
  const lastMessageTimestamp = useRef<number>(Date.now());
  
  // 监听新消息
  const newMessages = useQuery(api.messages.subscribeToConversationMessages, {
    conversationId,
    userId: currentUserId,
    since: lastMessageTimestamp.current,
  });
  
  // 处理新消息
  useEffect(() => {
    if (newMessages && newMessages.length > 0) {
      newMessages.forEach(message => {
        // 更新最后消息时间戳
        if (message.createdAt > lastMessageTimestamp.current) {
          lastMessageTimestamp.current = message.createdAt;
        }
        
        // 如果是新消息且不是自己发送的，触发回调
        if (message.senderId !== currentUserId) {
          onNewMessage?.(message);
        }
        
        // 触发消息更新回调
        onMessageUpdate?.(message);
      });
    }
  }, [newMessages, currentUserId, onNewMessage, onMessageUpdate]);
  
  return {
    newMessages: newMessages || [],
  };
}
```

### 2.3 会话列表管理

```typescript
// apps/native/hooks/useConversations.ts
import { useQuery, useMutation } from 'convex/react';
import { useCallback } from 'react';
import { api } from '@/convex/_generated/api';

export function useConversations(currentUserId: string) {
  // 获取用户会话列表
  const conversations = useQuery(api.conversations.getUserConversations, {
    userId: currentUserId,
  });
  
  // 创建新会话
  const createConversationMutation = useMutation(api.conversations.createConversation);
  
  // 创建或获取对话
  const createOrGetConversation = useCallback(async (options: {
    type: "direct" | "group";
    participants: string[];
    name?: string;
  }) => {
    try {
      const conversationId = await createConversationMutation(options);
      return conversationId;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }, [createConversationMutation]);
  
  // 开始与好友聊天
  const startChatWithFriend = useCallback(async (friendUserId: string) => {
    return await createOrGetConversation({
      type: "direct",
      participants: [currentUserId, friendUserId].sort(),
    });
  }, [currentUserId, createOrGetConversation]);
  
  // 创建群聊
  const createGroupChat = useCallback(async (participants: string[], groupName: string) => {
    return await createOrGetConversation({
      type: "group",
      participants: [currentUserId, ...participants].sort(),
      name: groupName,
    });
  }, [currentUserId, createOrGetConversation]);
  
  return {
    conversations: conversations || [],
    createOrGetConversation,
    startChatWithFriend,
    createGroupChat,
    isLoading: conversations === undefined,
  };
}
```

## 3. 消息类型处理

### 3.1 文本消息处理

```typescript
// apps/native/components/chat/messages/TextMessage.tsx
import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface TextMessageProps {
  content: string;
  isOwn: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function TextMessage({ content, isOwn, onPress, onLongPress }: TextMessageProps) {
  // URL检测和处理
  const renderContentWithLinks = () => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <Text
            key={index}
            className={cn(
              "underline",
              isOwn ? "text-primary-foreground" : "text-primary"
            )}
            onPress={() => {
              // 处理链接点击
              // Linking.openURL(part);
            }}
          >
            {part}
          </Text>
        );
      }
      return part;
    });
  };
  
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      <Text className={cn(
        "text-base leading-5",
        isOwn ? "text-primary-foreground" : "text-foreground"
      )}>
        {renderContentWithLinks()}
      </Text>
    </Pressable>
  );
}
```

### 3.2 系统消息处理

```typescript
// apps/native/components/chat/messages/SystemMessage.tsx
import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

interface SystemMessageProps {
  content: string;
  timestamp: number;
}

export function SystemMessage({ content, timestamp }: SystemMessageProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  return (
    <View className="items-center py-2 px-4">
      <View className="bg-muted/50 rounded-lg px-3 py-1">
        <Text variant="muted" className="text-xs text-center">
          {content}
        </Text>
        <Text variant="muted" className="text-xs text-center opacity-70">
          {formatTime(timestamp)}
        </Text>
      </View>
    </View>
  );
}
```

## 4. 消息状态管理

### 4.1 发送状态处理

```typescript
// apps/native/hooks/useMessageStatus.ts
import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useMessageStatus(messageId: string, conversationId: string) {
  const [status, setStatus] = useState<'sending' | 'sent' | 'delivered' | 'read' | 'failed'>('sending');
  
  // 查询消息状态
  const messageStatus = useQuery(api.messages.getMessageStatus, {
    messageId: messageId as Id<"messages">,
    conversationId: conversationId as Id<"conversations">,
  });
  
  useEffect(() => {
    if (messageStatus) {
      setStatus(messageStatus.status);
    }
  }, [messageStatus]);
  
  return status;
}
```

### 4.2 乐观更新机制

```typescript
// apps/native/hooks/useOptimisticMessages.ts
import { useState, useCallback } from 'react';
import { nanoid } from 'nanoid';

interface OptimisticMessage {
  _id: string;
  content: string;
  senderId: string;
  type: "text" | "image";
  status: "sending" | "sent" | "failed";
  createdAt: number;
  isOptimistic: boolean;
}

export function useOptimisticMessages(realMessages: any[] = []) {
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  
  // 添加乐观消息
  const addOptimisticMessage = useCallback((content: string, senderId: string) => {
    const tempMessage: OptimisticMessage = {
      _id: `temp-${nanoid()}`,
      content,
      senderId,
      type: "text",
      status: "sending",
      createdAt: Date.now(),
      isOptimistic: true,
    };
    
    setOptimisticMessages(prev => [...prev, tempMessage]);
    return tempMessage._id;
  }, []);
  
  // 更新乐观消息状态
  const updateOptimisticMessage = useCallback((tempId: string, status: "sent" | "failed", realId?: string) => {
    setOptimisticMessages(prev => 
      prev.map(msg => 
        msg._id === tempId 
          ? { ...msg, status, _id: realId || msg._id }
          : msg
      )
    );
  }, []);
  
  // 移除已确认的乐观消息
  const removeOptimisticMessage = useCallback((tempId: string) => {
    setOptimisticMessages(prev => prev.filter(msg => msg._id !== tempId));
  }, []);
  
  // 合并真实消息和乐观消息
  const allMessages = [...realMessages, ...optimisticMessages]
    .sort((a, b) => a.createdAt - b.createdAt);
  
  return {
    allMessages,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
  };
}
```

## 5. 消息操作功能

### 5.1 消息长按菜单

```typescript
// apps/native/components/chat/MessageActions.tsx
import React from 'react';
import { View, Alert } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { 
  Copy, 
  Reply, 
  Forward, 
  Delete, 
  Info,
  Star 
} from 'lucide-react-native';

interface MessageActionsProps {
  message: any;
  isOwn: boolean;
  onCopy: () => void;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
  onInfo: () => void;
  onFavorite: () => void;
  onClose: () => void;
}

export function MessageActions({
  message,
  isOwn,
  onCopy,
  onReply,
  onForward,
  onDelete,
  onInfo,
  onFavorite,
  onClose,
}: MessageActionsProps) {
  const handleDelete = () => {
    Alert.alert(
      '删除消息',
      '确定要删除这条消息吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: onDelete },
      ]
    );
  };
  
  return (
    <View className="bg-background border border-border rounded-lg p-2 shadow-lg">
      <View className="flex-row flex-wrap">
        <Button variant="ghost" size="sm" onPress={onCopy} className="m-1">
          <Copy size={16} className="mr-2" />
          <Text>复制</Text>
        </Button>
        
        <Button variant="ghost" size="sm" onPress={onReply} className="m-1">
          <Reply size={16} className="mr-2" />
          <Text>回复</Text>
        </Button>
        
        <Button variant="ghost" size="sm" onPress={onForward} className="m-1">
          <Forward size={16} className="mr-2" />
          <Text>转发</Text>
        </Button>
        
        <Button variant="ghost" size="sm" onPress={onFavorite} className="m-1">
          <Star size={16} className="mr-2" />
          <Text>收藏</Text>
        </Button>
        
        <Button variant="ghost" size="sm" onPress={onInfo} className="m-1">
          <Info size={16} className="mr-2" />
          <Text>详情</Text>
        </Button>
        
        {isOwn && (
          <Button variant="ghost" size="sm" onPress={handleDelete} className="m-1">
            <Delete size={16} className="mr-2 text-destructive" />
            <Text className="text-destructive">删除</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
```

### 5.2 消息回复功能

```typescript
// apps/native/hooks/useMessageReply.ts
import { useState, useCallback } from 'react';

export function useMessageReply() {
  const [replyingTo, setReplyingTo] = useState<any>(null);
  
  const startReply = useCallback((message: any) => {
    setReplyingTo(message);
  }, []);
  
  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);
  
  const sendReply = useCallback(async (content: string, sendMessageFn: any) => {
    if (!replyingTo) return;
    
    try {
      await sendMessageFn(content, {
        replyToId: replyingTo._id,
      });
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to send reply:', error);
      throw error;
    }
  }, [replyingTo]);
  
  return {
    replyingTo,
    startReply,
    cancelReply,
    sendReply,
    isReplying: !!replyingTo,
  };
}
```

## 6. 输入增强功能

### 6.1 输入建议和表情

```typescript
// apps/native/components/chat/input/MessageInputEnhanced.tsx
import React, { useState, useCallback } from 'react';
import { View } from 'react-native';
import { MessageInput } from '../MessageInput';
import { EmojiPicker } from './EmojiPicker';
import { InputSuggestions } from './InputSuggestions';

interface MessageInputEnhancedProps {
  onSendMessage: (content: string) => void;
  replyingTo?: any;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export function MessageInputEnhanced({
  onSendMessage,
  replyingTo,
  onCancelReply,
  disabled,
}: MessageInputEnhancedProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // 处理@用户建议
  const handleTextChange = useCallback((text: string) => {
    setMessage(text);
    
    // 检测@符号并显示建议
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const query = text.slice(lastAtIndex + 1);
      if (query.length > 0) {
        // 搜索用户建议
        // setSuggestions(searchUsers(query));
      }
    } else {
      setSuggestions([]);
    }
  }, []);
  
  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmoji(false);
  }, []);
  
  const handleSend = useCallback((content: string) => {
    onSendMessage(content);
    setMessage('');
    setSuggestions([]);
  }, [onSendMessage]);
  
  return (
    <View>
      {/* 回复预览 */}
      {replyingTo && (
        <ReplyPreview
          message={replyingTo}
          onCancel={onCancelReply}
        />
      )}
      
      {/* 用户建议 */}
      {suggestions.length > 0 && (
        <InputSuggestions
          suggestions={suggestions}
          onSelect={(user) => {
            // 替换@查询为@用户名
            const lastAtIndex = message.lastIndexOf('@');
            const newMessage = message.slice(0, lastAtIndex + 1) + user + ' ';
            setMessage(newMessage);
            setSuggestions([]);
          }}
        />
      )}
      
      {/* 主输入框 */}
      <MessageInput
        value={message}
        onChangeText={handleTextChange}
        onSendMessage={handleSend}
        disabled={disabled}
        onEmojiPress={() => setShowEmoji(!showEmoji)}
      />
      
      {/* 表情选择器 */}
      {showEmoji && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmoji(false)}
        />
      )}
    </View>
  );
}
```

## 7. 错误处理和重试机制

### 7.1 消息发送失败处理

```typescript
// apps/native/hooks/useMessageRetry.ts
import { useCallback, useState } from 'react';

export function useMessageRetry() {
  const [retryingMessages, setRetryingMessages] = useState<Set<string>>(new Set());
  
  const retryMessage = useCallback(async (
    messageId: string,
    content: string,
    sendMessageFn: (content: string) => Promise<any>
  ) => {
    if (retryingMessages.has(messageId)) return;
    
    setRetryingMessages(prev => new Set(prev).add(messageId));
    
    try {
      await sendMessageFn(content);
      // 成功后移除重试状态
      setRetryingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    } catch (error) {
      console.error('Retry failed:', error);
      setRetryingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      throw error;
    }
  }, [retryingMessages]);
  
  const isRetrying = useCallback((messageId: string) => {
    return retryingMessages.has(messageId);
  }, [retryingMessages]);
  
  return {
    retryMessage,
    isRetrying,
  };
}
```

### 7.2 网络状态处理

```typescript
// apps/native/hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
      setConnectionType(state.type);
    });
    
    return unsubscribe;
  }, []);
  
  return {
    isOnline,
    connectionType,
    isWifi: connectionType === 'wifi',
    isCellular: connectionType === 'cellular',
  };
}
```

## 8. 性能优化策略

### 8.1 消息虚拟化

```typescript
// apps/native/components/chat/VirtualizedMessageList.tsx
import React, { useMemo } from 'react';
import { LegendList } from '@legendapp/list';

interface VirtualizedMessageListProps {
  messages: any[];
  currentUserId: string;
  onLoadMore: () => void;
  onViewableItemsChanged: (info: any) => void;
}

export function VirtualizedMessageList({
  messages,
  currentUserId,
  onLoadMore,
  onViewableItemsChanged,
}: VirtualizedMessageListProps) {
  // 优化渲染项
  const renderItem = useMemo(() => ({ item: message, index }: any) => {
    return (
      <MessageBubble
        key={message._id}
        message={message}
        isOwn={message.senderId === currentUserId}
        senderInfo={message.sender}
        showAvatar={shouldShowAvatar(message, index, messages)}
      />
    );
  }, [messages, currentUserId]);
  
  // 计算是否显示头像
  const shouldShowAvatar = (message: any, index: number, allMessages: any[]) => {
    if (message.senderId === currentUserId) return false;
    
    const prevMessage = allMessages[index - 1];
    return !prevMessage || prevMessage.senderId !== message.senderId;
  };
  
  return (
    <LegendList
      data={messages}
      renderItem={renderItem}
      estimatedItemSize={80}
      onEndReached={onLoadMore}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 1000,
      }}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={21}
    />
  );
}
```

### 8.2 消息预处理

```typescript
// apps/native/utils/messageProcessor.ts
export class MessageProcessor {
  // 消息分组（按日期）
  static groupMessagesByDate(messages: any[]) {
    const groups: Record<string, any[]> = {};
    
    messages.forEach(message => {
      const date = new Date(message.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  }
  
  // 消息去重
  static deduplicateMessages(messages: any[]) {
    const seen = new Set();
    return messages.filter(message => {
      if (seen.has(message._id)) {
        return false;
      }
      seen.add(message._id);
      return true;
    });
  }
  
  // 合并连续的系统消息
  static mergeSystemMessages(messages: any[]) {
    const result = [];
    let currentGroup: any[] = [];
    
    for (const message of messages) {
      if (message.type === 'system') {
        currentGroup.push(message);
      } else {
        if (currentGroup.length > 0) {
          // 合并系统消息
          result.push(this.createMergedSystemMessage(currentGroup));
          currentGroup = [];
        }
        result.push(message);
      }
    }
    
    if (currentGroup.length > 0) {
      result.push(this.createMergedSystemMessage(currentGroup));
    }
    
    return result;
  }
  
  private static createMergedSystemMessage(messages: any[]) {
    return {
      _id: `merged-${messages[0]._id}`,
      type: 'system',
      content: messages.map(m => m.content).join('\n'),
      createdAt: messages[0].createdAt,
      isMerged: true,
    };
  }
}
```

---

## 总结

Phase 3实现了聊天系统的核心业务逻辑，包括：

- **实时通信**: 基于Convex的实时消息监听
- **状态管理**: 完整的消息状态和乐观更新
- **用户体验**: 消息操作、回复、重试等功能
- **性能优化**: 虚拟化列表和消息预处理
- **错误处理**: 网络状态监听和重试机制

这为聊天系统提供了稳定可靠的核心功能基础。