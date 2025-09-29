# Phase 3: 聊天功能核心实现

> 实时聊天功能的业务逻辑和状态管理实现指南 (使用 Convex React Hooks)

## 1. 概述

本阶段实现聊天系统的核心功能，基于当前已实现的基础架构，包括：

### ✅ 已实现功能
1. **基础聊天界面**: ChatScreen + ChatMessageList + MessageBubble + MessageInput
2. **消息状态系统**: sending/sent/delivered/read/failed 状态显示
3. **实时数据同步**: 基于 Convex React hooks 的实时消息更新
4. **性能优化**: FlatList 优化、组件 memo、自动滚动

### 🚧 待实现功能
1. **乐观更新机制**: WhatsApp风格的即时消息发送，失败显示红色重试图标
2. **消息长按操作**: 支持复制、删除、回复功能
3. **消息回复功能**: 回复时显示原消息预览，不超过一行文字

## 2. 当前架构分析

### 2.1 核心组件结构

```typescript
// apps/native/components/chat/ChatScreen.tsx
export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
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

  // 数据转换以匹配组件接口
  const transformedMessages = useMemo(() => {
    return messages.map((msg) => ({
      _id: msg._id,
      content: msg.content,
      senderId: msg.senderId,
      type: msg.type || 'text',
      status: msg.status || 'sent',
      createdAt: msg._creationTime,
      sender: {
        userId: msg.sender?.userId || msg.senderId,
        displayName: msg.sender?.displayName || '未知用户',
        avatar: msg.sender?.avatar,
      },
    }));
  }, [messages]);

  return (
    <KeyboardProvider>
      <View className="flex-1 bg-background">
        <ChatHeader conversation={...} onBack={handleBack} />
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
```

### 2.2 useChat Hook 实现

```typescript
// apps/native/hooks/useChat.ts
export function useChat({ conversationId, userId }: UseChatProps) {
  const [error, setError] = useState<string | null>(null);

  // 直接使用 Convex React hooks
  const conversation = useQuery(api.v1.conversations.getConversationById, {
    conversationId,
    userId
  });

  const messagesData = useQuery(api.v1.messages.getConversationMessages, {
    conversationId,
    userId,
    limit: 50,
  });

  const sendMessage = useMutation(api.v1.messages.sendMessage);
  const markAsRead = useMutation(api.v1.messages.markMessagesAsRead);

  const handleSendMessage = async (content: string, type: "text" | "image" = "text") => {
    if (!content.trim()) return;

    try {
      const messageId = await sendMessage({
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

  // 自动标记消息已读
  useEffect(() => {
    if (messagesData?.messages && messagesData.messages.length > 0) {
      const unreadMessages = messagesData.messages
        .filter((msg) => msg.senderId !== userId && !markedAsReadRef.current.has(msg._id))
        .map((msg) => msg._id as Id<"messages">);

      if (unreadMessages.length > 0) {
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
```

### 2.3 MessageBubble 组件

```typescript
// apps/native/components/chat/MessageBubble.tsx
export const MessageBubble = React.memo(function MessageBubbleComponent({
  message,
  isOwn,
  senderInfo,
  showAvatar = true,
  onPress,
  onLongPress, // 🚧 待实现长按逻辑
}: MessageBubbleProps) {
  
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Icon as={Clock} size={12} className="text-muted-foreground" />;
      case 'sent':
        return <Icon as={Check} size={12} className="text-muted-foreground" />;
      case 'delivered':
        return <Icon as={CheckCheck} size={12} className="text-muted-foreground" />;
      case 'read':
        return <Icon as={CheckCheck} size={12} className="text-primary-foreground" />;
      case 'failed': // 🚧 待实现重试功能
        return <Icon as={XCircle} size={12} className="text-destructive" />;
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
      {/* 头像显示逻辑 */}
      {!isOwn && showAvatar && (
        <Avatar>
          <AvatarImage source={{ uri: senderInfo?.avatar }} />
          <AvatarFallback>
            <Text className="text-xs font-medium">
              {senderInfo?.displayName?.charAt(0).toUpperCase() || '?'}
            </Text>
          </AvatarFallback>
        </Avatar>
      )}

      {/* 消息气泡 */}
      <View className={cn(
        "max-w-[75%] rounded-2xl px-3 py-2",
        isOwn ? "bg-primary ml-auto" : "bg-muted mr-auto"
      )}>
        {/* 消息内容 + 时间 + 状态 */}
        <Text className={cn(
          "text-base leading-5",
          isOwn ? "text-primary-foreground" : "text-foreground"
        )}>
          {message.content}
        </Text>
        
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-xs opacity-70">
            {formatTime(message.createdAt)}
          </Text>
          {isOwn && (
            <View className="ml-2">
              {getStatusIcon()}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});
```

### 2.4 MessageInput 组件

```typescript
// apps/native/components/chat/MessageInput.tsx
export function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder = "输入消息...",
  onAttach,
  onVoiceRecord,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [inputHeight, setInputHeight] = useState(40);

  const handleSend = useCallback(() => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      setInputHeight(40);
    }
  }, [message, disabled, onSendMessage]);

  return (
    <KeyboardStickyView>
      <View className="flex-row items-end gap-3 bg-background border-t border-border pt-4 pb-2">
        {/* 附件按钮 */}
        <Button variant="ghost" size="icon" onPress={onAttach}>
          <Plus size={20} />
        </Button>

        {/* 文本输入框 */}
        <View className="flex-1 max-h-[120px]">
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            multiline
            maxLength={2000}
            className="bg-muted/30 border border-muted rounded-2xl px-4 py-3"
            onContentSizeChange={handleContentSizeChange}
          />
          {/* 字数提示 */}
          {message.length > 1800 && (
            <Text variant="muted" className="text-xs mt-1 text-right">
              {message.length}/2000
            </Text>
          )}
        </View>

        {/* 发送/语音按钮 */}
        {message.trim() ? (
          <Button size="icon" className="rounded-full bg-primary" onPress={handleSend}>
            <Icon as={Send} size={18} className="text-primary-foreground" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onPress={onVoiceRecord}>
            <Icon as={Mic} size={18} />
          </Button>
        )}
      </View>
    </KeyboardStickyView>
  );
}
```

## 3. 性能优化实现

### 3.1 ChatMessageList 优化

```typescript
// apps/native/components/chat/ChatMessageList.tsx
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

  return (
    <View className="flex-1">
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.1}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
        // 性能优化配置
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        initialNumToRender={15}
        disableIntervalMomentum={true}
        scrollEventThrottle={16}
      />
    </View>
  );
}
```

## 4. 待实现功能路线图

### 4.1 乐观更新机制

```typescript
// 🚧 待实现: apps/native/hooks/useOptimisticMessages.ts
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
  
  // 合并真实消息和乐观消息
  const allMessages = [...realMessages, ...optimisticMessages]
    .sort((a, b) => a.createdAt - b.createdAt);
  
  return {
    allMessages,
    addOptimisticMessage,
    // ... 其他方法
  };
}
```

### 4.2 长按操作功能

```typescript
// 🚧 待实现: apps/native/components/chat/MessageLongPress.tsx
export function MessageLongPress({
  message,
  isOwn,
  onReply,
  onDelete,
  onRetry,
  onClose,
}: MessageLongPressProps) {
  
  const handleCopy = () => {
    Clipboard.setString(message.content);
    onClose();
  };
  
  // iOS 原生 ActionSheet
  if (Platform.OS === 'ios') {
    const options = ['复制', '回复'];
    if (message.status === 'failed' && onRetry) options.push('重试发送');
    if (isOwn) options.push('删除消息');
    options.push('取消');
    
    ActionSheetIOS.showActionSheetWithOptions({
      options,
      cancelButtonIndex: options.length - 1,
    }, (buttonIndex) => {
      // 处理用户选择
    });
    return null;
  }
  
  // Android 自定义菜单
  return (
    <View className="bg-background border border-border rounded-lg p-2">
      <Button variant="ghost" size="sm" onPress={handleCopy}>
        <Copy size={16} />
        <Text>复制</Text>
      </Button>
      
      <Button variant="ghost" size="sm" onPress={() => onReply(message)}>
        <Reply size={16} />
        <Text>回复</Text>
      </Button>
      
      {message.status === 'failed' && onRetry && (
        <Button variant="ghost" size="sm" onPress={() => onRetry(message._id)}>
          <RotateCcw size={16} />
          <Text>重试发送</Text>
        </Button>
      )}
      
      {isOwn && (
        <Button variant="ghost" size="sm" onPress={() => onDelete(message._id)}>
          <Delete size={16} className="text-destructive" />
          <Text className="text-destructive">删除</Text>
        </Button>
      )}
    </View>
  );
}
```

### 4.3 消息回复功能

```typescript
// 🚧 待实现: apps/native/components/chat/ReplyPreview.tsx
export function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  const truncateContent = (content: string, maxLength: number = 50) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };
  
  return (
    <View className="bg-muted/30 border-l-4 border-primary px-3 py-2 mx-4 mb-2 rounded-r-md">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-primary font-medium text-sm mb-1">
            回复 {message.sender?.displayName || '未知用户'}
          </Text>
          <Text 
            numberOfLines={1} 
            ellipsizeMode="tail"
            className="text-muted-foreground text-sm"
          >
            {truncateContent(message.content)}
          </Text>
        </View>
        
        <Pressable onPress={onCancel} className="p-1">
          <X size={16} className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}

// 🚧 待实现: apps/native/hooks/useMessageReply.ts
export function useMessageReply() {
  const [replyingTo, setReplyingTo] = useState<any>(null);
  
  const startReply = useCallback((message: any) => {
    setReplyingTo(message);
  }, []);
  
  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);
  
  return {
    replyingTo,
    startReply,
    cancelReply,
    isReplying: !!replyingTo,
  };
}
```

## 5. 实现步骤建议

### 第一步: 实现乐观更新机制
1. 创建 `useOptimisticMessages` hook
2. 修改 `useChat` hook 集成乐观更新
3. 更新 `ChatScreen` 使用新的 hook
4. 实现失败重试功能

### 第二步: 实现长按操作功能
1. 创建 `MessageLongPress` 组件
2. 在 `MessageBubble` 中集成长按处理
3. 实现复制、删除功能
4. 添加iOS/Android平台适配

### 第三步: 实现消息回复功能
1. 创建 `useMessageReply` hook
2. 创建 `ReplyPreview` 组件
3. 修改 `MessageInput` 支持回复模式
4. 更新后端API支持回复消息

---

## 总结

当前聊天功能已具备扎实的基础架构，采用 **Convex React Hooks + NativeWind + 组件化设计**：

### ✅ 已实现的优势
- **实时数据同步**: Convex hooks 提供开箱即用的实时性
- **性能优化**: FlatList优化、组件memo、合理的状态管理
- **用户体验**: 自动滚动、键盘处理、消息状态显示
- **代码质量**: TypeScript类型安全、清晰的组件分层

### 🎯 待实现功能的价值
- **乐观更新**: 提升消息发送的即时反馈体验
- **长按操作**: 增强消息交互功能
- **回复功能**: 支持更丰富的对话场景

这种渐进式的实现方式确保了代码的稳定性和可维护性。