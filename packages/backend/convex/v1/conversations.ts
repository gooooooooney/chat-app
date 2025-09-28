import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { 
  verifyConversationAccess, 
  verifyParticipantsFriendship,
  getUnreadCount,
  findExistingDirectConversation 
} from "./helpers/utils";

/**
 * 获取用户的所有会话列表
 * 包含未读消息计数和最后消息信息
 */
export const getUserConversations = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, limit = 20 } = args;
    
    try {
      // 获取用户参与的所有会话
      const participations = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_active", (q) => 
          q.eq("userId", userId).eq("leftAt", undefined)
        )
        .take(limit);
      
      // 获取会话详情和统计信息
      const conversationsWithDetails = await Promise.all(
        participations.map(async (participation) => {
          const conversation = await ctx.db.get(participation.conversationId);
          if (!conversation) return null;
          
          // 获取最后一条消息
          const lastMessage = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => 
              q.eq("conversationId", conversation._id)
            )
            .order("desc")
            .first();
          
          // 获取未读消息数
          const unreadCount = await getUnreadCount(ctx, conversation._id, userId);
          
          // 获取参与者信息（用于显示会话名称和头像）
          const participants = await ctx.db
            .query("conversationParticipants")
            .withIndex("by_conversation", (q) => 
              q.eq("conversationId", conversation._id)
            )
            .filter((q) => q.eq(q.field("leftAt"), undefined))
            .collect();
          
          const participantProfiles = await Promise.all(
            participants.map(async (p) => {
              const profile = await ctx.db
                .query("userProfiles")
                .withIndex("by_userId", (q) => q.eq("userId", p.userId))
                .first();
              return profile;
            })
          );
          
          return {
            ...conversation,
            lastMessage,
            unreadCount,
            participants: participantProfiles.filter(Boolean),
            userRole: participation.role,
            muted: participation.muted || false,
            pinned: participation.pinned || false,
          };
        })
      );
      
      // 过滤掉null值并按最后消息时间排序
      const validConversations = conversationsWithDetails
        .filter(Boolean)
        .sort((a, b) => (b!.lastMessageAt || 0) - (a!.lastMessageAt || 0));
      
      return validConversations;
    } catch (error) {
      console.error("Failed to get user conversations:", error);
      throw new Error("Failed to load conversations");
    }
  },
});

/**
 * 根据ID获取单个会话信息
 */
export const getConversationById = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId } = args;
    
    try {
      // 验证访问权限
      await verifyConversationAccess(ctx, userId, conversationId);
      
      const conversation = await ctx.db.get(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      
      // 获取参与者信息
      const participants = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_conversation", (q) => 
          q.eq("conversationId", conversationId)
        )
        .filter((q) => q.eq(q.field("leftAt"), undefined))
        .collect();
      
      const participantProfiles = await Promise.all(
        participants.map(async (p) => {
          const profile = await ctx.db
            .query("userProfiles")
            .withIndex("by_userId", (q) => q.eq("userId", p.userId))
            .first();
          return profile ? { ...profile, role: p.role } : null;
        })
      );
      
      return {
        ...conversation,
        participants: participantProfiles.filter(Boolean),
      };
    } catch (error) {
      console.error("Failed to get conversation:", error);
      throw error;
    }
  },
});

/**
 * 创建新会话（直接聊天或群组聊天）
 */
export const createConversation = mutation({
  args: {
    type: v.union(v.literal("direct"), v.literal("group")),
    participants: v.array(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const { type, participants, name, description, createdBy } = args;
    
    try {
      // 验证参与者关系（确保都是好友）
      await verifyParticipantsFriendship(ctx, participants);
      
      // 对于直接聊天，检查是否已存在
      if (type === "direct" && participants.length === 2) {
        const existing = await findExistingDirectConversation(ctx, participants);
        if (existing) {
          return existing._id;
        }
      }
      
      // 验证群组聊天参数
      if (type === "group") {
        if (!name || name.trim().length === 0) {
          throw new Error("Group name is required");
        }
        if (participants.length < 2) {
          throw new Error("Group chat requires at least 2 participants");
        }
      }
      
      const now = Date.now();
      
      // 创建会话
      const conversationId = await ctx.db.insert("conversations", {
        type,
        name: name?.trim(),
        description: description?.trim(),
        createdBy,
        archived: false,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
      
      // 创建参与者记录
      await Promise.all(
        participants.map(async (participantId) => {
          const role = participantId === createdBy ? "owner" : "member";
          
          await ctx.db.insert("conversationParticipants", {
            conversationId,
            userId: participantId,
            role: role as "owner" | "member",
            joinedAt: now,
            muted: false,
            pinned: false,
          });
        })
      );
      
      // 创建系统消息（群组聊天）
      if (type === "group") {
        const creatorProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", createdBy))
          .first();
        
        const systemMessage = `${creatorProfile?.displayName || "User"} created this group`;
        
        await ctx.db.insert("messages", {
          conversationId,
          senderId: createdBy,
          content: systemMessage,
          type: "system",
          createdAt: now,
        });
      }
      
      return conversationId;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      throw error;
    }
  },
});

/**
 * 添加用户到群组会话
 */
export const addParticipants = mutation({
  args: {
    conversationId: v.id("conversations"),
    userIds: v.array(v.string()),
    addedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const { conversationId, userIds, addedBy } = args;
    
    try {
      // 验证操作者权限
      const adderParticipation = await verifyConversationAccess(ctx, addedBy, conversationId);
      
      const conversation = await ctx.db.get(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      
      // 只有群组聊天可以添加参与者
      if (conversation.type !== "group") {
        throw new Error("Can only add participants to group conversations");
      }
      
      // 检查权限（只有管理员和群主可以添加成员）
      if (!["owner", "admin"].includes(adderParticipation.role)) {
        throw new Error("Insufficient permissions to add participants");
      }
      
      const now = Date.now();
      
      // 添加新参与者
      const addedParticipants = [];
      for (const userId of userIds) {
        // 检查用户是否已是参与者
        const existing = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation_user", (q) => 
            q.eq("conversationId", conversationId).eq("userId", userId)
          )
          .first();
        
        if (!existing || existing.leftAt) {
          if (existing && existing.leftAt) {
            // 重新加入群组
            await ctx.db.patch(existing._id, {
              leftAt: undefined,
              joinedAt: now,
              role: "member",
            });
          } else {
            // 新加入群组
            await ctx.db.insert("conversationParticipants", {
              conversationId,
              userId,
              role: "member",
              joinedAt: now,
              muted: false,
              pinned: false,
            });
          }
          addedParticipants.push(userId);
        }
      }
      
      // 创建系统消息
      if (addedParticipants.length > 0) {
        const adderProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", addedBy))
          .first();
        
        const addedProfiles = await Promise.all(
          addedParticipants.map(userId =>
            ctx.db
              .query("userProfiles")
              .withIndex("by_userId", (q) => q.eq("userId", userId))
              .first()
          )
        );
        
        const addedNames = addedProfiles
          .filter(Boolean)
          .map(p => p!.displayName || "User")
          .join(", ");
        
        const systemMessage = `${adderProfile?.displayName || "User"} added ${addedNames} to the group`;
        
        await ctx.db.insert("messages", {
          conversationId,
          senderId: addedBy,
          content: systemMessage,
          type: "system",
          createdAt: now,
        });
        
        // 更新会话最后消息时间
        await ctx.db.patch(conversationId, {
          lastMessageAt: now,
          lastMessagePreview: systemMessage,
          updatedAt: now,
        });
      }
      
      return { addedCount: addedParticipants.length };
    } catch (error) {
      console.error("Failed to add participants:", error);
      throw error;
    }
  },
});

/**
 * 离开会话
 */
export const leaveConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId } = args;
    
    try {
      const participation = await verifyConversationAccess(ctx, userId, conversationId);
      
      const conversation = await ctx.db.get(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      
      // 直接聊天不允许离开
      if (conversation.type === "direct") {
        throw new Error("Cannot leave direct conversations");
      }
      
      const now = Date.now();
      
      // 标记用户离开
      await ctx.db.patch(participation._id, {
        leftAt: now,
      });
      
      // 创建系统消息
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      
      const systemMessage = `${userProfile?.displayName || "User"} left the group`;
      
      await ctx.db.insert("messages", {
        conversationId,
        senderId: userId,
        content: systemMessage,
        type: "system",
        createdAt: now,
      });
      
      // 更新会话最后消息时间
      await ctx.db.patch(conversationId, {
        lastMessageAt: now,
        lastMessagePreview: systemMessage,
        updatedAt: now,
      });
      
      return { success: true };
    } catch (error) {
      console.error("Failed to leave conversation:", error);
      throw error;
    }
  },
});

/**
 * 更新会话设置（静音、置顶等）
 */
export const updateConversationSettings = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    muted: v.optional(v.boolean()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, muted, pinned } = args;
    
    try {
      const participation = await verifyConversationAccess(ctx, userId, conversationId);
      
      const updates: Partial<typeof participation> = {};
      if (muted !== undefined) updates.muted = muted;
      if (pinned !== undefined) updates.pinned = pinned;
      
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(participation._id, updates);
      }
      
      return { success: true };
    } catch (error) {
      console.error("Failed to update conversation settings:", error);
      throw error;
    }
  },
});