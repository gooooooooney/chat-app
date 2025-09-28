# 聊天系统技术设计方案

## 1. 项目概述

基于现有的React Native + Convex架构，设计实现支持单人聊天和群聊的实时聊天系统，具备离线消息查看能力。

## 2. 核心需求分析

### 功能需求
- ✅ 支持单人对话（1v1）
- ✅ 支持群组聊天（多人）
- ✅ 实时消息传递
- ✅ 离线消息查看
- ✅ 消息分页加载
- ✅ 消息状态（发送中、已发送、已读）
- ✅ 图片/文件发送（预留）
- ✅ 消息回复功能（预留）

### 非功能需求
- 🚀 高性能：消息列表虚拟化
- 📱 离线支持：本地缓存 + 同步机制
- 🔄 实时性：基于Convex实时查询
- 🔐 安全性：好友关系验证
- 📊 可扩展：支持万级消息历史

## 3. 技术架构设计

### 3.1 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │      Convex     │    │   AsyncStorage  │
│                 │    │                 │    │                 │
│  ┌─────────────┐│    │  ┌─────────────┐│    │  ┌─────────────┐│
│  │Chat Screen  ││◄──►│  │Chat Queries ││    │  │Message Cache││
│  └─────────────┘│    │  └─────────────┘│    │  └─────────────┘│
│  ┌─────────────┐│    │  ┌─────────────┐│    │  ┌─────────────┐│
│  │Message List ││    │  │Message      ││    │  │Sync Queue   ││
│  └─────────────┘│    │  │Mutations    ││    │  └─────────────┘│
│  ┌─────────────┐│    │  └─────────────┘│    │                 │
│  │Input        ││    │                 │    │                 │
│  │Component    ││    │                 │    │                 │
│  └─────────────┘│    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 3.2 数据层设计

#### 基于现有Schema的优化
```typescript
// 利用现有的conversations表支持单聊和群聊
conversations: {
  type: "direct" | "group",  // 区分聊天类型
  participants: string[],    // 参与者列表
  name?: string,            // 群聊名称
  lastMessageAt: number,    // 最后消息时间
  // ... 其他字段
}

// 消息表结构
messages: {
  conversationId: Id<"conversations">,
  senderId: string,
  content: string,
  type: "text" | "image" | "file" | "system",
  replyToId?: Id<"messages">,
  createdAt: number,
  // ... 其他字段
}
```

## 4. 离线支持策略

### 4.1 本地存储架构

```typescript
// AsyncStorage 数据结构
const STORAGE_KEYS = {
  CONVERSATIONS: 'chat_conversations',
  MESSAGES: 'chat_messages_',
  PENDING_MESSAGES: 'chat_pending_messages',
  SYNC_TIMESTAMP: 'chat_sync_timestamp',
  USER_PROFILE: 'chat_user_profile'
};

// 消息缓存策略
interface CachedMessage {
  id: string;
  conversationId: string;
  content: string;
  senderId: string;
  timestamp: number;
  status: 'sent' | 'pending' | 'failed';
  synced: boolean;
}
```

### 4.2 离线优先数据流

```
1. 用户发送消息
   ↓
2. 立即存储到本地 (status: pending)
   ↓
3. 显示在界面中 (乐观更新)
   ↓
4. 后台尝试发送到服务器
   ↓
5. 成功: 更新status为sent，标记synced=true
   失败: 保持pending状态，等待重试
```

## 5. 性能优化策略

### 5.1 消息列表优化

```typescript
// 使用 @legendapp/list 实现虚拟化列表
<LegendList
  data={messages}
  renderItem={renderMessage}
  inverted={true}
  maintainVisibleContentPosition
  onEndReached={loadMoreMessages}
  recycleItems={true}
  estimatedItemSize={80}
/>
```

### 5.2 分页策略

```typescript
// Convex分页查询
const { data: messages, loadMore, hasNextPage } = usePaginatedQuery(
  api.messages.list,
  { conversationId },
  { initialNumItems: 20 }
);
```

### 5.3 缓存策略

- **L1缓存**: React Query内存缓存（最近20条消息）
- **L2缓存**: AsyncStorage本地持久化（最近1000条消息/会话）
- **L3存储**: Convex云端存储（全量历史消息）

## 6. 实时通信设计

### 6.1 基于Convex的实时查询

```typescript
// 实时监听新消息
const messages = useQuery(api.messages.list, { 
  conversationId,
  limit: 20 
});

// 自动滚动到最新消息
useEffect(() => {
  if (messages?.length > 0) {
    scrollToBottom();
  }
}, [messages]);
```

### 6.2 消息状态管理

```typescript
enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}
```

## 7. 网络状态处理

### 7.1 网络检测

```typescript
import NetInfo from '@react-native-community/netinfo';

const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });
    return unsubscribe;
  }, []);
  
  return isOnline;
};
```

### 7.2 同步机制

```typescript
// 网络恢复时同步策略
const syncPendingMessages = async () => {
  const pending = await getPendingMessages();
  
  for (const message of pending) {
    try {
      await sendMessage(message);
      await markMessageAsSynced(message.id);
    } catch (error) {
      // 重试逻辑或错误处理
    }
  }
};
```

## 8. 用户界面设计

### 8.1 聊天界面布局

```
┌────────────────────────────────┐
│           Chat Header          │  ← 标题栏（显示对方姓名/群名）
├────────────────────────────────┤
│                                │
│        Message List            │  ← 消息列表（虚拟化滚动）
│     (Inverted LegendList)      │
│                                │
│  ┌──────────┐  ┌─────────────┐ │
│  │Other Msg │  │   My Msg    │ │
│  └──────────┘  └─────────────┘ │
├────────────────────────────────┤
│  ┌───┐ ┌─────────────┐ ┌────┐  │  ← 输入栏(KeyboardAvoidingView)
│  │ + │ │ Text Input  │ │Send│  │
│  └───┘ └─────────────┘ └────┘  │
└────────────────────────────────┘
```

### 8.2 键盘处理策略 (react-native-keyboard-controller)

#### 8.2.1 键盘控制器集成

```typescript
import { KeyboardProvider, KeyboardAvoidingView, useKeyboardHandler } from 'react-native-keyboard-controller';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

// 主聊天页面组件包装
export default function ChatScreen() {
  return (
    <KeyboardProvider>
      <ChatContent />
    </KeyboardProvider>
  );
}
```

#### 8.2.2 消息输入组件 (基于现有UI组件)

```typescript
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

const MessageInput = ({ onSendMessage, disabled = false }) => {
  const [message, setMessage] = useState('');
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardHeight.value / 2 }],
  }));

  const handleSend = useCallback(() => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  }, [message, onSendMessage]);

  return (
    <KeyboardAvoidingView 
      behavior="padding"
      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
    >
      <Animated.View 
        style={animatedStyle}
        className="flex-row items-end space-x-2 bg-background border-t border-border p-3"
      >
        {/* 附件按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onPress={() => {/* TODO: 打开附件选择器 */}}
        >
          <Icon as={PlusIcon} size={20} />
        </Button>

        {/* 文本输入框 */}
        <View className="flex-1">
          <Input
            value={message}
            onChangeText={setMessage}
            placeholder="输入消息..."
            multiline
            maxLength={2000}
            textAlignVertical="center"
            className="min-h-10 max-h-24 bg-muted/30"
            editable={!disabled}
          />
        </View>

        {/* 发送按钮 */}
        <Button
          size="icon"
          className="rounded-full"
          onPress={handleSend}
          disabled={disabled || !message.trim()}
        >
          <Icon as={SendIcon} size={18} />
        </Button>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};
```

#### 8.2.3 智能键盘处理

```typescript
const ChatMessageList = ({ messages, onLoadMore }) => {
  const keyboardHeight = useSharedValue(0);
  const scrollRef = useRef(null);

  // 键盘事件处理
  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      // 键盘即将显示，准备滚动到底部
      if (e.progress === 1) {
        runOnJS(() => {
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
      // 键盘动画结束，确保消息列表位置正确
      runOnJS(() => {
        if (e.height > 0) {
          // 键盘显示完成，滚动到最新消息
          scrollRef.current?.scrollToEnd({ animated: true });
        }
      })();
    }
  }, []);

  return (
    <LegendList
      ref={scrollRef}
      data={messages}
      renderItem={renderMessage}
      inverted={true}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 10
      }}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.1}
      estimatedItemSize={80}
      contentContainerStyle={{
        paddingBottom: useAnimatedStyle(() => ({
          paddingBottom: keyboardHeight.value > 0 ? 10 : 0
        }))
      }}
    />
  );
};
```

### 8.3 消息气泡设计 (使用项目UI组件)

```typescript
import { Text } from '@/components/ui/text';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const MessageBubble = ({ message, isOwn, senderInfo }) => {
  return (
    <View className={cn(
      "flex-row mb-4 px-4",
      isOwn ? "justify-end" : "justify-start"
    )}>
      {/* 头像(仅对方消息显示) */}
      {!isOwn && (
        <Avatar className="mr-2 mt-1">
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
      )}

      <View className={cn(
        "max-w-[85%] rounded-2xl px-4 py-2",
        isOwn 
          ? "bg-primary ml-auto" 
          : "bg-muted mr-auto"
      )}>
        {/* 消息内容 */}
        <Text className={cn(
          "text-base leading-5",
          isOwn ? "text-primary-foreground" : "text-foreground"
        )}>
          {message.content}
        </Text>

        {/* 消息元信息 */}
        <View className="flex-row items-center justify-between mt-1">
          <Text className={cn(
            "text-xs opacity-70",
            isOwn ? "text-primary-foreground" : "text-muted-foreground"
          )}>
            {formatTime(message.createdAt)}
          </Text>
          
          {/* 消息状态(仅自己的消息) */}
          {isOwn && (
            <MessageStatusIndicator status={message.status} />
          )}
        </View>
      </View>
    </View>
  );
};

const MessageStatusIndicator = ({ status }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Icon as={ClockIcon} size={12} className="text-muted-foreground" />;
      case 'sent':
        return <Icon as={CheckIcon} size={12} className="text-muted-foreground" />;
      case 'delivered':
        return <Icon as={CheckCheckIcon} size={12} className="text-muted-foreground" />;
      case 'read':
        return <Icon as={CheckCheckIcon} size={12} className="text-primary" />;
      case 'failed':
        return <Icon as={XCircleIcon} size={12} className="text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <View className="ml-2">
      {getStatusIcon()}
    </View>
  );
};
```

### 8.4 聊天头部设计

```typescript
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const ChatHeader = ({ conversation, participants, onBack }) => {
  const isGroup = conversation.type === 'group';
  const title = isGroup ? conversation.name : participants[0]?.displayName;
  const subtitle = isGroup 
    ? `${participants.length} 位成员` 
    : participants[0]?.presence === 'online' ? '在线' : '离线';

  return (
    <View className="flex-row items-center bg-background border-b border-border px-4 py-3">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onPress={onBack}
        className="mr-3"
      >
        <Icon as={ArrowLeftIcon} size={20} />
      </Button>

      {/* 头像 */}
      <Avatar className="mr-3">
        <AvatarImage 
          source={{ uri: isGroup ? conversation.avatar : participants[0]?.avatar }} 
          alt={title}
        />
        <AvatarFallback>
          <Text className="font-medium">
            {title?.charAt(0).toUpperCase() || '?'}
          </Text>
        </AvatarFallback>
      </Avatar>

      {/* 标题信息 */}
      <View className="flex-1">
        <Text className="font-semibold text-base">{title}</Text>
        <Text variant="muted" className="text-sm">{subtitle}</Text>
      </View>

      {/* 更多操作 */}
      <Button
        variant="ghost"
        size="icon"
      >
        <Icon as={MoreVerticalIcon} size={20} />
      </Button>
    </View>
  );
};
```

## 9. 安全考虑

### 9.1 访问控制

```typescript
// 验证用户是否有权限访问会话
export const hasConversationAccess = async (
  ctx: QueryCtx,
  userId: string,
  conversationId: Id<"conversations">
) => {
  const participant = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_conversation_user", q => 
      q.eq("conversationId", conversationId).eq("userId", userId)
    )
    .first();
    
  return !!participant && !participant.leftAt;
};
```

### 9.2 消息验证

- 输入内容验证和清理
- 图片文件大小和格式限制
- 发送频率限制（防刷屏）

## 10. 技术实现路线图

### Phase 1: 基础架构（2-3天）
1. ✅ 创建聊天页面路由和基础组件
2. ✅ 实现消息列表UI组件
3. ✅ 实现消息输入组件
4. ✅ 集成Convex实时查询

### Phase 2: 核心功能（3-4天）
1. ✅ 实现发送文本消息
2. ✅ 实现消息分页加载
3. ✅ 实现单聊和群聊的统一处理
4. ✅ 添加消息状态显示

### Phase 3: 离线支持（2-3天）
1. ✅ 实现AsyncStorage消息缓存
2. ✅ 实现离线消息队列
3. ✅ 实现网络状态监听和同步
4. ✅ 添加重试机制

### Phase 4: 优化和扩展（2-3天）
1. ✅ 性能优化（虚拟化列表）
2. ✅ 添加图片发送功能
3. ✅ 实现消息搜索
4. ✅ 添加更多交互功能

## 11. 关键技术决策

### 11.1 状态管理
- **选择**: React Query + Convex自带状态管理
- **原因**: 减少复杂度，利用Convex实时特性

### 11.2 本地存储
- **选择**: AsyncStorage + SQLite（大量数据）
- **原因**: AsyncStorage处理简单数据，SQLite处理复杂查询

### 11.3 UI框架
- **选择**: 现有的NativeWind + rn-primitives + @/components/ui
- **原因**: 
  - 保持项目一致性，减少学习成本
  - 充分利用已有的Button、Input、Text、Avatar等组件
  - 统一的设计语言和主题系统

### 11.4 键盘处理
- **选择**: react-native-keyboard-controller
- **原因**: 
  - 项目已安装，提供精确的键盘控制
  - 支持交互式键盘dismissal
  - 与Reanimated完美集成
  - 跨平台一致性体验

### 11.5 列表性能
- **选择**: @legendapp/list
- **原因**: 项目已在使用，性能优秀

## 12. 风险评估与缓解

### 高风险
- **大量历史消息加载性能**: 分页+虚拟化+缓存策略
- **离线同步冲突**: 时间戳+客户端ID避冲突
- **网络不稳定**: 重试机制+本地队列

### 中风险
- **内存使用过多**: 定期清理+LRU缓存
- **消息顺序问题**: 服务端时间戳排序

### 低风险
- **UI适配问题**: 响应式设计+测试覆盖

## 13. 监控和分析

### 关键指标
- 消息发送成功率
- 平均消息延迟
- 离线消息同步成功率
- 内存使用情况
- 崩溃率

### 错误处理
- 网络错误重试
- 数据格式错误恢复
- 存储空间不足处理

---

## 总结

该设计方案基于现有技术栈，充分利用Convex的实时特性和React Native的跨平台能力，通过合理的缓存策略和离线支持，打造高性能、可靠的聊天系统。

核心优势：
- 🚀 **高性能**: 虚拟化列表 + 分页加载
- 📱 **离线优先**: 本地缓存 + 智能同步
- 🔄 **实时性**: Convex实时查询
- 🔧 **可维护**: 清晰的架构分层
- 📈 **可扩展**: 支持未来功能扩展