# Phase 1: 后端API设计与实现

> 基于Convex的聊天系统后端API设计文档

## 1. 概述

本阶段重点设计和实现聊天系统的后端API，基于现有的Convex架构扩展支持实时聊天功能。

## 2. 数据模型设计

### 2.1 现有Schema优化

基于现有的 `packages/backend/convex/schema.ts`，需要确保以下表结构支持聊天功能：

```typescript
// conversations 表结构验证
conversations: defineTable({
  type: v.union(v.literal("direct"), v.literal("group")),
  participants: v.array(v.string()),
  name: v.optional(v.string()),
  avatar: v.optional(v.string()),
  lastMessageAt: v.number(),
  lastMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_participant", ["participants"])
.index("by_lastMessage", ["lastMessageAt"]),

// messages 表结构验证
messages: defineTable({
  conversationId: v.id("conversations"),
  senderId: v.string(),
  content: v.string(),
  type: v.union(
    v.literal("text"), 
    v.literal("image"), 
    v.literal("file"), 
    v.literal("system")
  ),
  replyToId: v.optional(v.id("messages")),
  attachments: v.optional(v.array(v.object({
    url: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  }))),
  status: v.union(
    v.literal("sending"),
    v.literal("sent"),
    v.literal("delivered"),
    v.literal("read"),
    v.literal("failed")
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_conversation", ["conversationId", "createdAt"])
.index("by_sender", ["senderId"])
.index("by_reply", ["replyToId"]),

// messageReadStatus 表结构验证
messageReadStatus: defineTable({
  messageId: v.id("messages"),
  userId: v.string(),
  readAt: v.number(),
})
.index("by_message", ["messageId"])
.index("by_user", ["userId"])
.index("by_message_user", ["messageId", "userId"]),
```

## 3. 核心API设计

### 3.1 会话管理API

#### 3.1.1 获取用户会话列表

```typescript
// packages/backend/convex/v1/conversations.ts
export const getUserConversations = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, limit = 20 } = args;
    
    // 查找用户参与的所有会话
    const conversations = await ctx.db
      .query("conversations")
      .filter(q => q.eq(q.field("participants"), userId))
      .order("desc")
      .take(limit);
    
    // 获取每个会话的最后一条消息和未读数
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", q => q.eq("conversationId", conv._id))
          .order("desc")
          .first();
        
        const unreadCount = await getUnreadCount(ctx, conv._id, userId);
        
        return {
          ...conv,
          lastMessage,
          unreadCount,
        };
      })
    );
    
    return conversationsWithDetails;
  },
});
```

#### 3.1.2 创建新会话

```typescript
export const createConversation = mutation({
  args: {
    type: v.union(v.literal("direct"), v.literal("group")),
    participants: v.array(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { type, participants, name } = args;
    
    // 验证参与者关系（确保都是好友）
    await verifyParticipantsFriendship(ctx, participants);
    
    // 对于直接聊天，检查是否已存在
    if (type === "direct" && participants.length === 2) {
      const existing = await findExistingDirectConversation(ctx, participants);
      if (existing) {
        return existing._id;
      }
    }
    
    const conversationId = await ctx.db.insert("conversations", {
      type,
      participants: participants.sort(), // 确保顺序一致
      name,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    // 创建参与者记录
    await Promise.all(
      participants.map(participantId =>
        ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: participantId,
          role: "member",
          joinedAt: Date.now(),
        })
      )
    );
    
    return conversationId;
  },
});
```

### 3.2 消息管理API

#### 3.2.1 获取会话消息

```typescript
// packages/backend/convex/v1/messages.ts
export const getConversationMessages = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, limit = 20 } = args;
    
    // 验证用户访问权限
    await verifyConversationAccess(ctx, userId, conversationId);
    
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", q => q.eq("conversationId", conversationId))
      .order("desc")
      .take(limit);
    
    // 获取发送者信息
    const messagesWithSenders = await Promise.all(
      messages.map(async (message) => {
        const sender = await getUserProfile(ctx, message.senderId);
        return {
          ...message,
          sender: {
            userId: sender.userId,
            displayName: sender.displayName,
            avatar: sender.avatar,
          },
        };
      })
    );
    
    return messagesWithSenders.reverse(); // 返回时间正序
  },
});
```

#### 3.2.2 发送消息

```typescript
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    content: v.string(),
    type: v.optional(v.union(
      v.literal("text"), 
      v.literal("image"), 
      v.literal("file")
    )),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const { conversationId, senderId, content, type = "text", replyToId } = args;
    
    // 验证用户访问权限
    await verifyConversationAccess(ctx, senderId, conversationId);
    
    // 内容验证
    if (!content.trim() || content.length > 2000) {
      throw new Error("Invalid message content");
    }
    
    const now = Date.now();
    
    // 创建消息
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      senderId,
      content: content.trim(),
      type,
      replyToId,
      status: "sent",
      createdAt: now,
      updatedAt: now,
    });
    
    // 更新会话最后消息时间
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessage: content.trim(),
      updatedAt: now,
    });
    
    return messageId;
  },
});
```

#### 3.2.3 标记消息已读

```typescript
export const markMessagesAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, messageIds } = args;
    
    // 验证访问权限
    await verifyConversationAccess(ctx, userId, conversationId);
    
    const now = Date.now();
    
    // 批量创建已读记录
    await Promise.all(
      messageIds.map(async (messageId) => {
        // 检查是否已经标记为已读
        const existing = await ctx.db
          .query("messageReadStatus")
          .withIndex("by_message_user", q => 
            q.eq("messageId", messageId).eq("userId", userId)
          )
          .first();
        
        if (!existing) {
          await ctx.db.insert("messageReadStatus", {
            messageId,
            userId,
            readAt: now,
          });
        }
      })
    );
    
    return { success: true };
  },
});
```

### 3.3 辅助函数

#### 3.3.1 权限验证

```typescript
// packages/backend/convex/v1/helpers/access-control.ts
export const verifyConversationAccess = async (
  ctx: QueryCtx | MutationCtx,
  userId: string,
  conversationId: Id<"conversations">
) => {
  const participant = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_conversation_user", q => 
      q.eq("conversationId", conversationId).eq("userId", userId)
    )
    .first();
    
  if (!participant || participant.leftAt) {
    throw new Error("Access denied: User is not a participant in this conversation");
  }
  
  return participant;
};

export const verifyParticipantsFriendship = async (
  ctx: QueryCtx | MutationCtx,
  participants: string[]
) => {
  // 验证所有参与者之间都是好友关系
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const friendship = await checkFriendship(ctx, participants[i], participants[j]);
      if (!friendship) {
        throw new Error(`Users ${participants[i]} and ${participants[j]} are not friends`);
      }
    }
  }
};
```

#### 3.3.2 实用工具函数

```typescript
// packages/backend/convex/v1/helpers/utils.ts
export const getUnreadCount = async (
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  userId: string
) => {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_conversation", q => q.eq("conversationId", conversationId))
    .collect();
  
  let unreadCount = 0;
  
  for (const message of messages) {
    if (message.senderId === userId) continue; // 跳过自己的消息
    
    const readStatus = await ctx.db
      .query("messageReadStatus")
      .withIndex("by_message_user", q => 
        q.eq("messageId", message._id).eq("userId", userId)
      )
      .first();
    
    if (!readStatus) {
      unreadCount++;
    }
  }
  
  return unreadCount;
};

export const findExistingDirectConversation = async (
  ctx: QueryCtx,
  participants: string[]
) => {
  const sortedParticipants = participants.sort();
  
  return await ctx.db
    .query("conversations")
    .filter(q => 
      q.and(
        q.eq(q.field("type"), "direct"),
        q.eq(q.field("participants"), sortedParticipants)
      )
    )
    .first();
};
```

## 4. 实时订阅API

### 4.1 新消息监听

```typescript
export const subscribeToConversationMessages = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, since = 0 } = args;
    
    // 验证访问权限
    await verifyConversationAccess(ctx, userId, conversationId);
    
    // 获取指定时间后的新消息
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", q => q.eq("conversationId", conversationId))
      .filter(q => q.gt(q.field("createdAt"), since))
      .order("asc")
      .collect();
    
    return messages;
  },
});
```

### 4.2 会话列表变更监听

```typescript
export const subscribeToUserConversations = query({
  args: {
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, since = 0 } = args;
    
    const conversations = await ctx.db
      .query("conversations")
      .filter(q => 
        q.and(
          q.eq(q.field("participants"), userId),
          q.gt(q.field("updatedAt"), since)
        )
      )
      .order("desc")
      .collect();
    
    return conversations;
  },
});
```

## 5. API错误处理

### 5.1 统一错误类型

```typescript
// packages/backend/convex/v1/types/errors.ts
export class ChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

export const ChatErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  INVALID_CONTENT: 'INVALID_CONTENT',
  NOT_FRIENDS: 'NOT_FRIENDS',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;
```

### 5.2 错误处理中间件

```typescript
// packages/backend/convex/v1/middleware/error-handler.ts
export const withErrorHandling = <T extends any[], R>(
  handler: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ChatError) {
        throw error;
      }
      
      // 记录未知错误
      console.error('Unexpected error in chat API:', error);
      throw new ChatError(
        'Internal server error',
        ChatErrorCodes.UNAUTHORIZED,
        500
      );
    }
  };
};
```

## 6. 性能优化

### 6.1 查询优化

- 使用合适的索引加速查询
- 实现分页以避免大量数据传输
- 缓存用户资料信息减少重复查询

### 6.2 数据库索引策略

```typescript
// 关键索引设计
conversations
  .index("by_participant", ["participants"])
  .index("by_lastMessage", ["lastMessageAt"])

messages
  .index("by_conversation_time", ["conversationId", "createdAt"])
  .index("by_sender", ["senderId"])

messageReadStatus
  .index("by_message_user", ["messageId", "userId"])
```

## 7. 测试策略

### 7.1 单元测试

- 每个API函数的独立测试
- 边界情况和错误场景测试
- 权限验证测试

### 7.2 集成测试

- 完整的聊天流程测试
- 实时订阅功能测试
- 并发访问测试

## 8. 部署考虑

### 8.1 环境变量

```bash
# Convex环境配置
CONVEX_DEPLOYMENT_URL=
CONVEX_DEPLOY_KEY=

# 功能开关
ENABLE_GROUP_CHAT=true
MAX_MESSAGE_LENGTH=2000
MAX_PARTICIPANTS_PER_GROUP=50
```

### 8.2 监控指标

- API响应时间
- 错误率
- 消息发送成功率
- 并发用户数

---

## 总结

Phase 1专注于构建稳定、高性能的后端API基础，为后续的前端实现提供可靠的数据接口。通过合理的数据模型设计、完善的权限控制和实时查询支持，确保聊天系统的核心功能能够正常运行。