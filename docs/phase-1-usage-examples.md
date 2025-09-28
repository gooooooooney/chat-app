# Phase 1 API 使用示例

> Chat System Backend API Phase 1 的实际使用示例和测试方法

## 1. API 部署状态

✅ **已实现的API**:
- 会话管理API (conversations.ts)
- 消息管理API (messages.ts) 
- 实时订阅API (subscriptions.ts)
- 辅助工具函数 (helpers/utils.ts)
- 错误处理系统 (types/errors.ts)
- 测试工具API (test.ts)

## 2. 快速开始测试

### 2.1 启动开发服务器

```bash
cd packages/backend
npx convex dev
```

### 2.2 使用测试工具创建测试数据

在 Convex Dashboard 中执行以下操作：

```typescript
// 1. 创建测试用户
await api.v1.createTestUsers({ count: 2 });

// 2. 获取测试统计
const stats = await api.v1.getTestStats();
console.log("数据库统计:", stats);

// 3. 运行完整的聊天流程测试
const result = await api.v1.testChatFlow({
  user1Id: "test_user_1_[timestamp]",
  user2Id: "test_user_2_[timestamp]", 
  testMessage: "Hello from API test!"
});
console.log("测试结果:", result);
```

## 3. 前端集成示例

### 3.1 React Native 中使用会话API

```typescript
// apps/native/hooks/useConversations.ts
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useConversations(userId: string) {
  // 获取用户会话列表
  const conversations = useQuery(api.v1.getUserConversations, { 
    userId,
    limit: 20 
  });
  
  // 创建新会话
  const createConversation = useMutation(api.v1.createConversation);
  
  const startDirectChat = async (friendUserId: string) => {
    return await createConversation({
      type: "direct",
      participants: [userId, friendUserId],
      createdBy: userId,
    });
  };
  
  const createGroupChat = async (participants: string[], name: string) => {
    return await createConversation({
      type: "group", 
      participants: [userId, ...participants],
      name,
      createdBy: userId,
    });
  };
  
  return {
    conversations,
    startDirectChat,
    createGroupChat,
    isLoading: conversations === undefined,
  };
}
```

### 3.2 React Native 中使用消息API

```typescript
// apps/native/hooks/useMessages.ts
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function useMessages(conversationId: Id<"conversations">, userId: string) {
  // 获取消息列表
  const messagesData = useQuery(api.v1.getConversationMessages, {
    conversationId,
    userId,
    limit: 50,
  });
  
  // 发送消息
  const sendMessage = useMutation(api.v1.sendMessage);
  
  // 标记消息已读
  const markAsRead = useMutation(api.v1.markMessagesAsRead);
  
  const handleSendMessage = async (content: string, type: "text" | "image" = "text") => {
    return await sendMessage({
      conversationId,
      senderId: userId,
      content,
      type,
    });
  };
  
  const handleMarkAsRead = async (messageIds: Id<"messages">[]) => {
    return await markAsRead({
      conversationId,
      userId,
      messageIds,
    });
  };
  
  return {
    messages: messagesData?.messages || [],
    hasMore: messagesData?.hasMore || false,
    nextCursor: messagesData?.nextCursor,
    sendMessage: handleSendMessage,
    markAsRead: handleMarkAsRead,
    isLoading: messagesData === undefined,
  };
}
```

### 3.3 实时订阅使用

```typescript
// apps/native/hooks/useRealTimeChat.ts
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";

export function useRealTimeChat(conversationId: Id<"conversations">, userId: string) {
  const lastSyncTime = useRef(Date.now());
  
  // 订阅新消息
  const newMessages = useQuery(api.v1.subscribeToConversationMessages, {
    conversationId,
    userId,
    since: lastSyncTime.current,
  });
  
  // 订阅会话更新
  const conversationUpdates = useQuery(api.v1.subscribeToUserConversations, {
    userId,
    since: lastSyncTime.current,
  });
  
  // 订阅已读状态更新
  const readStatusUpdates = useQuery(api.v1.subscribeToMessageReadStatus, {
    conversationId,
    userId,
    since: lastSyncTime.current,
  });
  
  // 订阅用户在线状态
  const presenceUpdates = useQuery(api.v1.subscribeToUserPresence, {
    conversationId,
    userId,
    since: lastSyncTime.current,
  });
  
  // 处理新消息
  useEffect(() => {
    if (newMessages && newMessages.length > 0) {
      console.log("收到新消息:", newMessages);
      // 更新本地状态、显示通知等
      lastSyncTime.current = Date.now();
    }
  }, [newMessages]);
  
  // 处理已读状态更新
  useEffect(() => {
    if (readStatusUpdates && readStatusUpdates.length > 0) {
      console.log("消息已读状态更新:", readStatusUpdates);
      // 更新消息的已读状态显示
    }
  }, [readStatusUpdates]);
  
  return {
    newMessages: newMessages || [],
    conversationUpdates: conversationUpdates || [],
    readStatusUpdates: readStatusUpdates || [],
    presenceUpdates: presenceUpdates || [],
  };
}
```

## 4. API 使用场景

### 4.1 创建聊天会话

```typescript
// 场景1: 用户点击好友头像开始聊天
const handleStartChatWithFriend = async (friendUserId: string) => {
  try {
    const conversationId = await createConversation({
      type: "direct",
      participants: [currentUserId, friendUserId],
      createdBy: currentUserId,
    });
    
    // 跳转到聊天页面
    router.push(`/chat/${conversationId}`);
  } catch (error) {
    console.error("创建会话失败:", error);
    alert("无法开始聊天，请确保你们是好友关系");
  }
};

// 场景2: 创建群聊
const handleCreateGroupChat = async (selectedFriends: string[], groupName: string) => {
  try {
    const conversationId = await createConversation({
      type: "group",
      participants: [currentUserId, ...selectedFriends],
      name: groupName,
      description: "群聊创建于 " + new Date().toLocaleString(),
      createdBy: currentUserId,
    });
    
    router.push(`/chat/${conversationId}`);
  } catch (error) {
    console.error("创建群聊失败:", error);
  }
};
```

### 4.2 发送和接收消息

```typescript
// 场景1: 发送文本消息
const handleSendTextMessage = async (content: string) => {
  if (!content.trim()) return;
  
  try {
    const messageId = await sendMessage({
      conversationId,
      senderId: currentUserId,
      content: content.trim(),
      type: "text",
    });
    
    console.log("消息发送成功:", messageId);
    
    // 清空输入框
    setInputText("");
    
    // 滚动到底部
    scrollToBottom();
  } catch (error) {
    console.error("发送消息失败:", error);
    alert("发送失败，请重试");
  }
};

// 场景2: 回复消息
const handleReplyToMessage = async (replyToId: Id<"messages">, content: string) => {
  try {
    await sendMessage({
      conversationId,
      senderId: currentUserId,
      content: content.trim(),
      type: "text",
      replyToId,
    });
  } catch (error) {
    console.error("回复消息失败:", error);
  }
};

// 场景3: 批量标记消息已读
const handleMarkVisibleMessagesAsRead = async (visibleMessageIds: Id<"messages">[]) => {
  const unreadMessages = visibleMessageIds.filter(id => {
    // 过滤出未读消息
    return !readMessages.includes(id);
  });
  
  if (unreadMessages.length > 0) {
    try {
      await markAsRead({
        conversationId,
        userId: currentUserId,
        messageIds: unreadMessages,
      });
    } catch (error) {
      console.error("标记已读失败:", error);
    }
  }
};
```

### 4.3 实时功能实现

```typescript
// 场景1: 实时显示"正在输入"状态
const [typingUsers, setTypingUsers] = useState<string[]>([]);

// 监听其他用户的在线状态
const presenceUpdates = useQuery(api.v1.subscribeToUserPresence, {
  conversationId,
  userId: currentUserId,
  since: lastPresenceCheck.current,
});

useEffect(() => {
  if (presenceUpdates) {
    presenceUpdates.forEach(update => {
      if (update.presence === "online") {
        console.log(`${update.displayName} 上线了`);
      } else {
        console.log(`${update.displayName} 离线了`);
      }
    });
  }
}, [presenceUpdates]);

// 场景2: 实时消息计数更新
const conversations = useQuery(api.v1.getUserConversations, { 
  userId: currentUserId 
});

const totalUnreadCount = conversations?.reduce((total, conv) => {
  return total + (conv.unreadCount || 0);
}, 0) || 0;

// 更新应用图标徽章
useEffect(() => {
  if (totalUnreadCount > 0) {
    // 更新应用徽章数字
    // setBadgeCount(totalUnreadCount);
  }
}, [totalUnreadCount]);
```

## 5. 错误处理示例

```typescript
import { ChatError, ChatErrorCodes, getUserFriendlyMessage } from "@/convex/v1/types/errors";

// 统一错误处理函数
const handleChatError = (error: any) => {
  if (error instanceof ChatError) {
    const friendlyMessage = getUserFriendlyMessage(error);
    
    switch (error.code) {
      case ChatErrorCodes.NOT_FRIENDS:
        alert("只能与好友聊天，请先添加对方为好友");
        break;
      case ChatErrorCodes.CONVERSATION_NOT_FOUND:
        alert("会话不存在或已被删除");
        router.back();
        break;
      case ChatErrorCodes.CONTENT_TOO_LONG:
        alert(`消息内容过长，最多${error.details?.maxLength}个字符`);
        break;
      case ChatErrorCodes.RATE_LIMITED:
        alert("操作过于频繁，请稍后再试");
        break;
      default:
        alert(friendlyMessage);
    }
  } else {
    console.error("未知错误:", error);
    alert("操作失败，请重试");
  }
};

// 在API调用中使用
try {
  await sendMessage({...});
} catch (error) {
  handleChatError(error);
}
```

## 6. 性能优化建议

### 6.1 分页加载消息

```typescript
const [messages, setMessages] = useState<any[]>([]);
const [hasMore, setHasMore] = useState(true);
const [cursor, setCursor] = useState<string | null>(null);

const loadMoreMessages = async () => {
  if (!hasMore || isLoading) return;
  
  try {
    const result = await getConversationMessages({
      conversationId,
      userId: currentUserId,
      limit: 20,
      cursor,
    });
    
    setMessages(prev => [...result.messages, ...prev]);
    setHasMore(result.hasMore);
    setCursor(result.nextCursor);
  } catch (error) {
    console.error("加载更多消息失败:", error);
  }
};
```

### 6.2 优化实时订阅

```typescript
// 使用防抖减少订阅频率
import { useDebouncedCallback } from 'use-debounce';

const debouncedSyncTime = useDebouncedCallback(() => {
  lastSyncTime.current = Date.now();
}, 1000);

useEffect(() => {
  if (newMessages && newMessages.length > 0) {
    // 处理新消息
    handleNewMessages(newMessages);
    debouncedSyncTime();
  }
}, [newMessages, debouncedSyncTime]);
```

## 7. 测试和调试

### 7.1 开发环境测试

```bash
# 启动 Convex 开发服务器
cd packages/backend
npx convex dev

# 在另一个终端查看日志
npx convex logs --tail
```

### 7.2 API 测试脚本

```typescript
// 在 Convex Dashboard 中运行
const runAPITest = async () => {
  console.log("🚀 开始API测试...");
  
  // 1. 创建测试用户
  const { users } = await api.v1.createTestUsers({ count: 2 });
  console.log("✅ 创建用户:", users);
  
  // 2. 测试聊天流程
  const result = await api.v1.testChatFlow({
    user1Id: users[0].userId,
    user2Id: users[1].userId,
    testMessage: "API测试消息",
  });
  console.log("✅ 聊天测试:", result);
  
  // 3. 获取统计信息
  const stats = await api.v1.getTestStats();
  console.log("📊 数据统计:", stats);
  
  console.log("🎉 测试完成!");
};

// 运行测试
await runAPITest();
```

---

## 总结

Phase 1 的后端API已经完全实现并可以投入使用。主要特性包括：

✅ **完整的会话管理**: 支持1v1和群聊  
✅ **实时消息传递**: 基于Convex的实时订阅  
✅ **消息状态跟踪**: 已读/未读状态管理  
✅ **权限控制**: 好友关系验证和访问控制  
✅ **错误处理**: 完善的错误类型和用户友好提示  
✅ **测试工具**: 开发和调试辅助功能  

下一步可以开始实现 Phase 2 的UI组件，利用这些API构建聊天界面。