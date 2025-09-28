# Phase 2: UI组件实现指南

> 基于现有UI组件库的聊天界面组件开发文档

## 1. 概述

本阶段重点实现聊天系统的前端UI组件，充分利用项目现有的 `@/components/ui/` 组件库，确保设计一致性和开发效率。

## 2. 技术栈确认

### 2.1 现有UI组件库

- **Button**: `/apps/native/components/ui/button.tsx`
- **Input**: `/apps/native/components/ui/input.tsx` 
- **Text**: `/apps/native/components/ui/text.tsx`
- **Avatar**: `/apps/native/components/ui/avatar.tsx`
- **其他**: dropdown-menu.tsx, native-only-animated-view.tsx

### 2.2 样式框架

- **NativeWind**: TailwindCSS for React Native
- **Class Variance Authority**: 组件变体管理
- **rn-primitives**: 底层原始组件

### 2.3 动画与键盘

- **react-native-reanimated**: 高性能动画
- **react-native-keyboard-controller**: 精确键盘控制

## 3. 核心组件设计

### 3.1 聊天页面容器 (ChatScreen)

```typescript
// apps/native/app/(authenticated)/(pages)/chat/[conversationId].tsx
import React from 'react';
import { View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface ChatScreenProps {
  conversationId: string;
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  
  // Convex查询
  const conversation = useQuery(api.conversations.getById, { 
    conversationId: conversationId as Id<"conversations"> 
  });
  const messages = useQuery(api.messages.getConversationMessages, {
    conversationId: conversationId as Id<"conversations">,
    userId: currentUserId, // 从auth context获取
  });
  
  // 发送消息mutation
  const sendMessage = useMutation(api.messages.sendMessage);
  
  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;
    
    await sendMessage({
      conversationId: conversationId as Id<"conversations">,
      senderId: currentUserId,
      content: content.trim(),
      type: "text",
    });
  };
  
  const handleBack = () => {
    router.back();
  };
  
  if (!conversation || !messages) {
    return <LoadingScreen />;
  }
  
  return (
    <KeyboardProvider>
      <View className="flex-1 bg-background">
        <ChatHeader 
          conversation={conversation}
          onBack={handleBack}
        />
        
        <ChatMessageList 
          messages={messages}
          currentUserId={currentUserId}
        />
        
        <MessageInput 
          onSendMessage={handleSendMessage}
          disabled={false}
        />
      </View>
    </KeyboardProvider>
  );
}
```

### 3.2 聊天头部组件 (ChatHeader)

```typescript
// apps/native/components/chat/ChatHeader.tsx
import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, MoreVertical, Phone, Video } from 'lucide-react-native';

interface ChatHeaderProps {
  conversation: {
    type: "direct" | "group";
    name?: string;
    participants: Array<{
      userId: string;
      displayName: string;
      avatar?: string;
      presence?: "online" | "offline";
    }>;
  };
  onBack: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onMore?: () => void;
}

export function ChatHeader({ 
  conversation, 
  onBack, 
  onCall, 
  onVideoCall, 
  onMore 
}: ChatHeaderProps) {
  const isGroup = conversation.type === 'group';
  const participant = conversation.participants[0]; // 单聊时获取对方信息
  
  const title = isGroup 
    ? conversation.name 
    : participant?.displayName || '未知用户';
    
  const subtitle = isGroup 
    ? `${conversation.participants.length} 位成员`
    : participant?.presence === 'online' ? '在线' : '离线';
  
  const avatarUri = isGroup 
    ? conversation.avatar 
    : participant?.avatar;
  
  return (
    <View className="flex-row items-center bg-background border-b border-border px-4 py-3 pt-safe">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onPress={onBack}
        className="mr-3"
      >
        <ArrowLeft size={20} className="text-foreground" />
      </Button>
      
      {/* 头像 */}
      <Avatar className="mr-3 size-10">
        <AvatarImage 
          source={{ uri: avatarUri }} 
          alt={title}
        />
        <AvatarFallback>
          <Text className="font-medium text-sm">
            {title?.charAt(0).toUpperCase() || '?'}
          </Text>
        </AvatarFallback>
      </Avatar>
      
      {/* 标题信息 */}
      <View className="flex-1">
        <Text className="font-semibold text-base leading-tight">
          {title}
        </Text>
        <Text variant="muted" className="text-sm">
          {subtitle}
        </Text>
      </View>
      
      {/* 操作按钮 */}
      <View className="flex-row space-x-1">
        {!isGroup && onCall && (
          <Button
            variant="ghost"
            size="icon"
            onPress={onCall}
          >
            <Phone size={18} className="text-foreground" />
          </Button>
        )}
        
        {!isGroup && onVideoCall && (
          <Button
            variant="ghost"
            size="icon"
            onPress={onVideoCall}
          >
            <Video size={18} className="text-foreground" />
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onPress={onMore}
        >
          <MoreVertical size={18} className="text-foreground" />
        </Button>
      </View>
    </View>
  );
}
```

### 3.3 消息列表组件 (ChatMessageList)

```typescript
// apps/native/components/chat/ChatMessageList.tsx
import React, { useRef, useEffect } from 'react';
import { View, Animated } from 'react-native';
import { LegendList } from '@legendapp/list';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { MessageBubble } from './MessageBubble';
import { Text } from '@/components/ui/text';

interface Message {
  _id: string;
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
  const scrollRef = useRef<any>(null);
  const keyboardHeight = useSharedValue(0);
  
  // 键盘事件处理
  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      if (e.progress === 1) {
        runOnJS(() => {
          // 键盘即将显示，滚动到底部
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 50);
        })();
      }
    },
    onMove: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
    },
    onEnd: (e) => {
      'worklet';
      runOnJS(() => {
        if (e.height > 0) {
          // 键盘显示完成
          scrollRef.current?.scrollToEnd({ animated: true });
        }
      })();
    }
  }, []);
  
  // 新消息自动滚动
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
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
  
  if (messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text variant="muted" className="text-center">
          还没有消息，发送第一条消息开始聊天吧！
        </Text>
      </View>
    );
  }
  
  return (
    <View className="flex-1">
      <LegendList
        ref={scrollRef}
        data={messages}
        renderItem={renderMessage}
        estimatedItemSize={80}
        inverted={false} // 使用正向，从底部开始
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.1}
        ListHeaderComponent={renderLoadMoreHeader}
        contentContainerStyle={{
          paddingVertical: 16,
          paddingBottom: keyboardHeight.value > 0 ? 10 : 16,
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
```

### 3.4 消息气泡组件 (MessageBubble)

```typescript
// apps/native/components/chat/MessageBubble.tsx
import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, XCircle } from 'lucide-react-native';

interface MessageBubbleProps {
  message: {
    _id: string;
    content: string;
    senderId: string;
    type: "text" | "image" | "file" | "system";
    status: "sending" | "sent" | "delivered" | "read" | "failed";
    createdAt: number;
  };
  isOwn: boolean;
  senderInfo: {
    userId: string;
    displayName: string;
    avatar?: string;
  };
  showAvatar?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function MessageBubble({
  message,
  isOwn,
  senderInfo,
  showAvatar = true,
  onPress,
  onLongPress,
}: MessageBubbleProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };
  
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Clock size={12} className="text-muted-foreground" />;
      case 'sent':
        return <Check size={12} className="text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck size={12} className="text-muted-foreground" />;
      case 'read':
        return <CheckCheck size={12} className="text-primary" />;
      case 'failed':
        return <XCircle size={12} className="text-destructive" />;
      default:
        return null;
    }
  };
  
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className={cn(
        "flex-row mb-3 px-4",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {/* 头像(仅对方消息显示) */}
      {!isOwn && (
        <View className="mr-2 mt-1">
          {showAvatar ? (
            <Avatar className="size-8">
              <AvatarImage 
                source={{ uri: senderInfo?.avatar }} 
                alt={senderInfo?.displayName}
              />
              <AvatarFallback>
                <Text className="text-xs font-medium">
                  {senderInfo?.displayName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </AvatarFallback>
            </Avatar>
          ) : (
            <View className="size-8" />
          )}
        </View>
      )}
      
      {/* 消息内容容器 */}
      <View className={cn(
        "max-w-[75%] rounded-2xl px-3 py-2",
        isOwn 
          ? "bg-primary ml-auto" 
          : "bg-muted mr-auto"
      )}>
        {/* 发送者名称(群聊中对方消息显示) */}
        {!isOwn && showAvatar && (
          <Text className="text-xs font-medium text-muted-foreground mb-1">
            {senderInfo.displayName}
          </Text>
        )}
        
        {/* 消息内容 */}
        <Text className={cn(
          "text-base leading-5",
          isOwn ? "text-primary-foreground" : "text-foreground"
        )}>
          {message.content}
        </Text>
        
        {/* 消息元信息 */}
        <View className="flex-row items-center justify-between mt-1 min-h-[16px]">
          <Text className={cn(
            "text-xs opacity-70",
            isOwn ? "text-primary-foreground" : "text-muted-foreground"
          )}>
            {formatTime(message.createdAt)}
          </Text>
          
          {/* 消息状态(仅自己的消息) */}
          {isOwn && (
            <View className="ml-2">
              {getStatusIcon()}
            </View>
          )}
        </View>
      </View>
      
      {/* 占位，保持布局平衡 */}
      {isOwn && <View className="w-8" />}
    </Pressable>
  );
}
```

### 3.5 消息输入组件 (MessageInput)

```typescript
// apps/native/components/chat/MessageInput.tsx
import React, { useState, useCallback } from 'react';
import { View, Animated } from 'react-native';
import { KeyboardAvoidingView, useKeyboardHandler } from 'react-native-keyboard-controller';
import { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Plus, Send, Mic } from 'lucide-react-native';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onAttach?: () => void;
  onVoiceRecord?: () => void;
}

export function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder = "输入消息...",
  onAttach,
  onVoiceRecord,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const keyboardHeight = useSharedValue(0);
  
  // 监听键盘事件
  useKeyboardHandler({
    onMove: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
    },
    onInteractive: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
    }
  }, []);
  
  // 键盘动画样式
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(-keyboardHeight.value / 4, 0) }],
  }));
  
  const handleSend = useCallback(() => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      setInputHeight(40); // 重置输入框高度
    }
  }, [message, disabled, onSendMessage]);
  
  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    setInputHeight(Math.min(Math.max(height, 40), 120)); // 限制高度 40-120
  };
  
  const canSend = message.trim().length > 0 && !disabled;
  
  return (
    <KeyboardAvoidingView 
      behavior="padding"
      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
    >
      <Animated.View 
        style={animatedStyle}
        className="flex-row items-end space-x-3 bg-background border-t border-border pt-3 pb-2"
      >
        {/* 附件按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full self-end mb-1"
          onPress={onAttach}
          disabled={disabled}
        >
          <Plus size={20} className="text-foreground" />
        </Button>
        
        {/* 文本输入框容器 */}
        <View className="flex-1 min-h-[40px] max-h-[120px]">
          <Input
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            className={cn(
              "bg-muted/30 border-muted rounded-2xl px-4 py-2",
              "min-h-[40px] text-base leading-5"
            )}
            style={{ height: inputHeight }}
            onContentSizeChange={handleContentSizeChange}
            editable={!disabled}
            placeholderTextColor="#9CA3AF"
          />
          
          {/* 字数提示 */}
          {message.length > 1800 && (
            <Text variant="muted" className="text-xs mt-1 text-right">
              {message.length}/2000
            </Text>
          )}
        </View>
        
        {/* 发送/语音按钮 */}
        {canSend ? (
          <Button
            size="icon"
            className="rounded-full self-end mb-1"
            onPress={handleSend}
            disabled={disabled}
          >
            <Send size={18} className="text-primary-foreground" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full self-end mb-1"
            onPress={onVoiceRecord}
            disabled={disabled}
          >
            <Mic size={18} className="text-foreground" />
          </Button>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
```

## 4. 辅助组件

### 4.1 加载状态组件

```typescript
// apps/native/components/chat/LoadingScreen.tsx
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#007AFF" />
      <Text variant="muted" className="mt-4">
        加载中...
      </Text>
    </View>
  );
}
```

### 4.2 错误状态组件

```typescript
// apps/native/components/chat/ErrorScreen.tsx
import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { RefreshCw } from 'lucide-react-native';

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text variant="muted" className="text-center mb-4">
        {error}
      </Text>
      <Button onPress={onRetry} variant="outline">
        <RefreshCw size={16} className="mr-2" />
        <Text>重试</Text>
      </Button>
    </View>
  );
}
```

## 5. 路由配置

### 5.1 聊天页面路由

```typescript
// apps/native/app/(authenticated)/(pages)/chat/[conversationId].tsx
import { Stack } from 'expo-router';
import ChatScreen from '@/components/chat/ChatScreen';

export default function ChatPage() {
  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />
      <ChatScreen />
    </>
  );
}
```

### 5.2 导航集成

```typescript
// 从联系人页面跳转到聊天
const handleStartChat = async (friendUserId: string) => {
  try {
    // 创建或获取对话
    const conversationId = await createOrGetConversation({
      type: "direct",
      participants: [currentUserId, friendUserId],
    });
    
    // 跳转到聊天页面
    router.push(`/(authenticated)/(pages)/chat/${conversationId}`);
  } catch (error) {
    console.error('Failed to start chat:', error);
  }
};
```

## 6. 样式主题

### 6.1 聊天相关的TailwindCSS配置

```javascript
// tailwind.config.js 扩展
module.exports = {
  theme: {
    extend: {
      colors: {
        // 聊天气泡颜色
        'chat-own': 'rgb(var(--color-primary))',
        'chat-other': 'rgb(var(--color-muted))',
        'chat-system': 'rgb(var(--color-accent))',
      },
      borderRadius: {
        'bubble': '18px',
      },
      maxWidth: {
        'chat-bubble': '75%',
      }
    }
  }
}
```

### 6.2 暗色模式支持

```typescript
// 自动适配暗色模式的消息气泡
const bubbleClassName = cn(
  "max-w-chat-bubble rounded-bubble px-3 py-2",
  isOwn 
    ? "bg-primary dark:bg-primary" 
    : "bg-muted dark:bg-muted"
);
```

## 7. 性能优化

### 7.1 消息列表优化

```typescript
// 使用React.memo优化MessageBubble渲染
export const MessageBubble = React.memo(MessageBubbleComponent, (prevProps, nextProps) => {
  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.isOwn === nextProps.isOwn
  );
});
```

### 7.2 键盘动画优化

```typescript
// 使用useSharedValue避免JS桥接
const keyboardHeight = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: -keyboardHeight.value / 4 }],
}), []);
```

## 8. 可访问性

### 8.1 无障碍支持

```typescript
// 消息气泡可访问性
<Pressable
  accessibilityRole="button"
  accessibilityLabel={`${isOwn ? '我' : senderInfo.displayName}发送的消息: ${message.content}`}
  accessibilityHint="双击查看消息详情"
>
  {/* 消息内容 */}
</Pressable>
```

### 8.2 语音消息支持

```typescript
// 语音消息组件(未来扩展)
const VoiceMessageBubble = ({ duration, isPlaying, onPlay }) => (
  <Button
    variant="ghost"
    className="flex-row items-center space-x-2"
    onPress={onPlay}
    accessibilityLabel={`语音消息，时长${duration}秒`}
  >
    <Mic size={16} />
    <Text>{formatDuration(duration)}</Text>
  </Button>
);
```

---

## 总结

Phase 2建立了完整的聊天UI组件体系，充分利用现有的设计系统确保一致性。关键特性包括：

- **组件复用**: 基于现有UI组件库构建
- **键盘优化**: 智能键盘处理和动画
- **性能优化**: 虚拟化列表和组件优化
- **可访问性**: 完整的无障碍支持
- **响应式**: 适配不同屏幕尺寸

下一阶段将实现核心的聊天功能逻辑。