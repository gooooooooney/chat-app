import { v } from "convex/values";
import { mutation, MutationCtx, query, QueryCtx } from "../_generated/server";
import { MessageType } from "../schema";
import type {
  ConversationWithParticipant,
  UserProfileWithId,
  ConversationWithId,
  MessageWithId,
  ConversationDetail,
  MessageWithAttachments
} from "../types";

// 创建用户资料
export const createUserProfile = mutation({
  args: {
    userId: v.string(),
    displayName: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      throw new Error("用户资料已存在");
    }

    const now = Date.now();
    return await ctx.db.insert("userProfiles", {
      userId: args.userId,
      displayName: args.displayName,
      avatar: args.avatar,
      updatedAt: now,
    });
  },
});

// 获取用户资料
export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<UserProfileWithId | null> => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// 通过邮箱创建1v1会话
export const createDirectConversationByEmail = mutation({
  args: {
    userId: v.string(),
    targetEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // 查找目标用户
    const authUser = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("email"), args.targetEmail))
      .first();
    if (!authUser) {
      throw new Error("找不到该用户");
    }

    const targetUser = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
      .first();
    if (!targetUser) {
      throw new Error("找不到该用户的资料");
    }

    if (targetUser.userId === args.userId) {
      throw new Error("不能和自己创建会话");
    }

    // 检查是否是好友
    const [user1Id, user2Id] = [args.userId, targetUser.userId].sort();
    const friendship = await ctx.db
      .query("friendships")
      .withIndex("by_users", (q) => q.eq("user1Id", user1Id).eq("user2Id", user2Id))
      .first();

    if (!friendship) {
      throw new Error("只能和好友创建私聊");
    }

    // 使用现有的创建会话逻辑
    return await createDirectConversationInternal(ctx, args.userId, targetUser.userId);
  },
});

// 内部函数：创建1v1会话
async function createDirectConversationInternal(ctx: MutationCtx, userId1: string, userId2: string) {
  // 检查是否已存在1v1会话
  const existingParticipants = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_user", (q) => q.eq("userId", userId1))
    .collect();

  for (const participant of existingParticipants) {
    const conversation = await ctx.db.get(participant.conversationId);
    if (conversation?.type === "direct") {
      const otherParticipant = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_conversation", (q) => q.eq("conversationId", participant.conversationId))
        .filter((q) => q.neq(q.field("userId"), userId1))
        .first();

      if (otherParticipant?.userId === userId2) {
        return participant.conversationId;
      }
    }
  }

  // 创建新的1v1会话
  const now = Date.now();
  const conversationId = await ctx.db.insert("conversations", {
    type: "direct",
    createdBy: userId1,
    createdAt: now,
    updatedAt: now,
  });

  // 添加两个参与者
  await ctx.db.insert("conversationParticipants", {
    conversationId,
    userId: userId1,
    role: "member",
    joinedAt: now,
  });

  await ctx.db.insert("conversationParticipants", {
    conversationId,
    userId: userId2,
    role: "member",
    joinedAt: now,
  });

  return conversationId;
}

// 创建1v1会话（保留原有API）
export const createDirectConversation = mutation({
  args: {
    userId1: v.string(),
    userId2: v.string(),
  },
  handler: async (ctx, args) => {
    // 检查是否已存在1v1会话
    const existingParticipants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", args.userId1))
      .collect();

    for (const participant of existingParticipants) {
      const conversation = await ctx.db.get(participant.conversationId);
      if (conversation?.type === "direct") {
        const otherParticipant = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation", (q) => q.eq("conversationId", participant.conversationId))
          .filter((q) => q.neq(q.field("userId"), args.userId1))
          .first();

        if (otherParticipant?.userId === args.userId2) {
          return participant.conversationId;
        }
      }
    }

    // 创建新的1v1会话
    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      type: "direct",
      createdBy: args.userId1,
      createdAt: now,
      updatedAt: now,
    });

    // 添加两个参与者
    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId: args.userId1,
      role: "member",
      joinedAt: now,
    });

    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId: args.userId2,
      role: "member",
      joinedAt: now,
    });

    return conversationId;
  },
});

// 发送消息
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    content: v.string(),
    type: v.optional(MessageType),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // 验证用户是否是会话参与者
    const participant = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.senderId)
      )
      .first();

    if (!participant || participant.leftAt) {
      throw new Error("无权限发送消息到此会话");
    }

    const now = Date.now();

    // 创建消息
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      content: args.content,
      type: args.type || "text",
      replyToId: args.replyToId,
      createdAt: now,
    });

    // 更新会话的最后消息时间
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessagePreview: args.content.length > 100
        ? args.content.substring(0, 100) + "..."
        : args.content,
      updatedAt: now,
    });

    return messageId;
  },
});

// 获取会话消息
export const getConversationMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MessageWithId[]> => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(args.limit || 50);
  },
});

// 获取用户的会话列表
export const getUserConversations = query({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<ConversationWithParticipant[]> => {
    const participants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // 过滤出活跃参与者（没有离开时间的）
    const activeParticipants = participants.filter(p => !p.leftAt);

    const conversations = await Promise.all(
      activeParticipants.map(async (participant) => {
        const conversation = await ctx.db.get(participant.conversationId);
        return { conversation, participant };
      })
    );

    return conversations
      .filter((c): c is ConversationWithParticipant => c.conversation !== null)
      .sort((a, b) => (b.conversation.lastMessageAt || b.conversation.createdAt) - (a.conversation.lastMessageAt || a.conversation.createdAt));
  },
});

// 获取会话详情（包含参与者和未读消息数）
export const getConversationDetail = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<ConversationDetail | null> => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    const participant = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId)
      )
      .first();

    if (!participant || participant.leftAt) return null;

    // 获取最后一条消息
    const lastMessage = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .first();

    // 计算未读消息数
    let unreadCount = 0;
    if (participant.lastReadMessageId) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .collect();

      const lastReadIndex = messages.findIndex(m => m._id === participant.lastReadMessageId);
      if (lastReadIndex !== -1) {
        unreadCount = lastReadIndex;
      }
    } else {
      // 如果从未读过，计算所有消息
      unreadCount = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .collect()
        .then(messages => messages.length);
    }

    // 获取其他参与者
    const otherParticipants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.neq(q.field("userId"), args.userId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .collect();

    return {
      conversation,
      participant,
      lastMessage: lastMessage || undefined,
      unreadCount,
      otherParticipants,
    };
  },
});

// 获取消息及其附件
export const getMessageWithAttachments = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args): Promise<MessageWithAttachments | null> => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;

    const attachments = await ctx.db
      .query("messageAttachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    return {
      message,
      attachments,
    };
  },
});

// 标记消息为已读
export const markMessageAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // 更新参与者的最后阅读消息
    const participant = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId)
      )
      .first();

    if (!participant) {
      throw new Error("用户不是此会话的参与者");
    }

    await ctx.db.patch(participant._id, {
      lastReadMessageId: args.messageId,
      lastReadAt: Date.now(),
    });

    // 记录详细的阅读状态
    const existingReadStatus = await ctx.db
      .query("messageReadStatus")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId)
      )
      .first();

    if (!existingReadStatus) {
      await ctx.db.insert("messageReadStatus", {
        messageId: args.messageId,
        userId: args.userId,
        readAt: Date.now(),
      });
    }
  },
});