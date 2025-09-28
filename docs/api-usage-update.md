# API 使用方式更新

## 变更说明

根据要求，已删除 `packages/backend/convex/v1/index.ts` 文件，现在必须使用具体的 API 路径来调用后端函数。

## 更新前后对比

### 更新前 (已删除)
```typescript
// ❌ 不再支持 - 已删除 v1/index.ts
import { api } from '@/convex/_generated/api';

const conversation = useQuery(api.v1.getConversationById, { ... });
const messages = useQuery(api.v1.getConversationMessages, { ... });
const sendMessage = useMutation(api.v1.sendMessage);
```

### 更新后 (正确方式)
```typescript
// ✅ 使用具体的 API 路径
import { api } from '@chat-app/backend/convex/_generated/api';

const conversation = useQuery(api.v1.conversations.getConversationById, { ... });
const messages = useQuery(api.v1.messages.getConversationMessages, { ... });
const sendMessage = useMutation(api.v1.messages.sendMessage);
```

## API 路径映射

### 会话管理 API
```typescript
// 会话相关功能在 api.v1.conversations 下
api.v1.conversations.getUserConversations
api.v1.conversations.getConversationById
api.v1.conversations.createConversation
api.v1.conversations.addParticipants
api.v1.conversations.leaveConversation
api.v1.conversations.updateConversationSettings
```

### 消息管理 API
```typescript
// 消息相关功能在 api.v1.messages 下
api.v1.messages.getConversationMessages
api.v1.messages.sendMessage
api.v1.messages.markMessagesAsRead
api.v1.messages.editMessage
api.v1.messages.deleteMessage
api.v1.messages.getMessageStats
api.v1.messages.searchMessages
```

### 实时订阅 API
```typescript
// 实时订阅功能在 api.v1.subscriptions 下
api.v1.subscriptions.subscribeToConversationMessages
api.v1.subscriptions.subscribeToUserConversations
api.v1.subscriptions.subscribeToMessageReadStatus
api.v1.subscriptions.subscribeToUserPresence
api.v1.subscriptions.subscribeToConversationParticipants
api.v1.subscriptions.getConnectionStatus
api.v1.subscriptions.subscribeToFriendRequests
```

### 用户管理 API
```typescript
// 用户管理功能在 api.v1.users 下
api.v1.users.findUserByEmail
api.v1.users.sendFriendRequest
api.v1.users.getReceivedFriendRequests
api.v1.users.respondToFriendRequest
api.v1.users.getFriendsList
api.v1.users.removeFriend
api.v1.users.checkFriendshipStatus
api.v1.users.getFriendDetail
```

### 测试工具 API
```typescript
// 测试工具在 api.v1.test 下
api.v1.test.testChatFlow
api.v1.test.getTestStats
api.v1.test.cleanupTestData
api.v1.test.createTestUsers
```

## 已更新的文件

1. **`apps/native/hooks/useChat.ts`** - 更新为使用具体 API 路径
2. **`apps/native/components/chat/ChatScreen.tsx`** - 更新导入路径
3. **`apps/native/utils/navigation.ts`** - 更新导入路径
4. **`packages/backend/convex/v1/index.ts`** - ❌ 已删除

## 导入路径统一

所有 Convex 相关的导入现在使用完整路径：
```typescript
import { api } from '@chat-app/backend/convex/_generated/api';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';
```

## 使用示例

### 完整的聊天 Hook 示例
```typescript
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@chat-app/backend/convex/_generated/api';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';

export function useChat({ conversationId, userId }: UseChatProps) {
  // 获取会话信息
  const conversation = useQuery(api.v1.conversations.getConversationById, {
    conversationId,
    userId
  });

  // 获取消息列表
  const messagesData = useQuery(api.v1.messages.getConversationMessages, {
    conversationId,
    userId,
    limit: 50,
  });

  // 发送消息
  const sendMessage = useMutation(api.v1.messages.sendMessage);

  // 标记消息已读
  const markAsRead = useMutation(api.v1.messages.markMessagesAsRead);

  // ... 其他逻辑
}
```

## 编译验证

✅ 所有更改已通过 Convex 编译验证：
```bash
npx convex dev --once
✔ Convex functions ready!
```

这种更改确保了 API 调用的明确性和类型安全，避免了通过 index 文件的间接导入可能带来的问题。