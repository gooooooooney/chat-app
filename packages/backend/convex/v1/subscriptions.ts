import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { verifyConversationAccess, getUserProfile, getUnreadCount } from "./helpers/utils";

/**
 * 订阅会话中的新消息
 * 用于实时获取指定时间后的新消息
 */
export const subscribeToConversationMessages = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, since = 0 } = args;
    
    try {
      // 验证访问权限
      await verifyConversationAccess(ctx, userId, conversationId);
      
      // 获取指定时间后的新消息
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => 
          q.eq("conversationId", conversationId)
        )
        .filter((q) => 
          q.and(
            q.gt(q.field("createdAt"), since),
            q.eq(q.field("deleted"), undefined)
          )
        )
        .order("asc")
        .collect();
      
      // 获取发送者信息
      const messagesWithSenders = await Promise.all(
        messages.map(async (message) => {
          const sender = await getUserProfile(ctx, message.senderId);
          
          // 获取回复的消息信息
          let replyToMessage = null;
          if (message.replyToId) {
            replyToMessage = await ctx.db.get(message.replyToId);
            if (replyToMessage && !replyToMessage.deleted) {
              const replyToSender = await getUserProfile(ctx, replyToMessage.senderId);
              replyToMessage = {
                ...replyToMessage,
                sender: {
                  userId: replyToSender.userId,
                  displayName: replyToSender.displayName,
                  avatar: replyToSender.avatar,
                },
              };
            } else {
              replyToMessage = null;
            }
          }
          
          // 获取消息附件
          const attachments = await ctx.db
            .query("messageAttachments")
            .withIndex("by_message", (q) => q.eq("messageId", message._id))
            .collect();
          
          return {
            ...message,
            sender: {
              userId: sender.userId,
              displayName: sender.displayName,
              avatar: sender.avatar,
            },
            replyTo: replyToMessage,
            attachments,
          };
        })
      );
      
      return messagesWithSenders;
    } catch (error) {
      console.error("Failed to subscribe to conversation messages:", error);
      throw error;
    }
  },
});

/**
 * 订阅用户的会话列表变更
 * 用于实时获取会话列表的更新
 */
export const subscribeToUserConversations = query({
  args: {
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, since = 0 } = args;
    
    try {
      // 获取用户参与的会话
      const participations = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_active", (q) => 
          q.eq("userId", userId).eq("leftAt", undefined)
        )
        .collect();
      
      // 获取有更新的会话
      const updatedConversations = [];
      
      for (const participation of participations) {
        const conversation = await ctx.db.get(participation.conversationId);
        if (!conversation) continue;
        
        // 检查会话是否在指定时间后有更新
        if (conversation.updatedAt > since) {
          // 获取最后一条消息
          const lastMessage = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => 
              q.eq("conversationId", conversation._id)
            )
            .filter((q) => q.eq(q.field("deleted"), undefined))
            .order("desc")
            .first();
          
          // 获取未读消息数
          const unreadCount = await getUnreadCount(ctx, conversation._id, userId);
          
          // 获取参与者信息
          const participants = await ctx.db
            .query("conversationParticipants")
            .withIndex("by_conversation", (q) => 
              q.eq("conversationId", conversation._id)
            )
            .filter((q) => q.eq(q.field("leftAt"), undefined))
            .collect();
          
          const participantProfiles = await Promise.all(
            participants.map(async (p) => {
              const profile = await getUserProfile(ctx, p.userId);
              return profile;
            })
          );
          
          updatedConversations.push({
            ...conversation,
            lastMessage,
            unreadCount,
            participants: participantProfiles,
            userRole: participation.role,
            muted: participation.muted || false,
            pinned: participation.pinned || false,
          });
        }
      }
      
      // 按最后消息时间排序
      updatedConversations.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      
      return updatedConversations;
    } catch (error) {
      console.error("Failed to subscribe to user conversations:", error);
      throw error;
    }
  },
});

/**
 * 订阅消息的已读状态变更
 * 用于实时更新消息的已读状态
 */
export const subscribeToMessageReadStatus = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, since = 0 } = args;
    
    try {
      // 验证访问权限
      await verifyConversationAccess(ctx, userId, conversationId);
      
      // 获取指定时间后的已读状态更新
      const readStatusUpdates = await ctx.db
        .query("messageReadStatus")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.gt(q.field("readAt"), since))
        .collect();
      
      // 过滤出属于当前会话的已读状态
      const relevantUpdates = [];
      
      for (const readStatus of readStatusUpdates) {
        const message = await ctx.db.get(readStatus.messageId);
        if (message && message.conversationId === conversationId) {
          relevantUpdates.push({
            messageId: readStatus.messageId,
            userId: readStatus.userId,
            readAt: readStatus.readAt,
          });
        }
      }
      
      return relevantUpdates;
    } catch (error) {
      console.error("Failed to subscribe to message read status:", error);
      throw error;
    }
  },
});

/**
 * 订阅用户在线状态变更
 * 用于实时获取会话参与者的在线状态
 */
export const subscribeToUserPresence = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, since = 0 } = args;
    
    try {
      // 验证访问权限
      await verifyConversationAccess(ctx, userId, conversationId);
      
      // 获取会话参与者
      const participants = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_conversation", (q) => 
          q.eq("conversationId", conversationId)
        )
        .filter((q) => q.eq(q.field("leftAt"), undefined))
        .collect();
      
      // 获取参与者的在线状态更新
      const presenceUpdates = [];
      
      for (const participant of participants) {
        if (participant.userId === userId) continue; // 跳过自己
        
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", participant.userId))
          .first();
        
        if (profile && profile.updatedAt > since) {
          presenceUpdates.push({
            userId: profile.userId,
            displayName: profile.displayName,
            avatar: profile.avatar,
            presence: profile.presence,
            lastSeenAt: profile.lastSeenAt,
            updatedAt: profile.updatedAt,
          });
        }
      }
      
      return presenceUpdates;
    } catch (error) {
      console.error("Failed to subscribe to user presence:", error);
      throw error;
    }
  },
});

/**
 * 订阅会话参与者变更
 * 用于实时获取会话成员的加入/离开事件
 */
export const subscribeToConversationParticipants = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, since = 0 } = args;
    
    try {
      // 验证访问权限
      await verifyConversationAccess(ctx, userId, conversationId);
      
      // 获取指定时间后加入的参与者
      const newParticipants = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_conversation", (q) => 
          q.eq("conversationId", conversationId)
        )
        .filter((q) => q.gt(q.field("joinedAt"), since))
        .collect();
      
      // 获取指定时间后离开的参与者
      const leftParticipants = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_conversation", (q) => 
          q.eq("conversationId", conversationId)
        )
        .filter((q) => 
          q.and(
            q.neq(q.field("leftAt"), undefined),
            q.gt(q.field("leftAt"), since)
          )
        )
        .collect();
      
      // 获取参与者的用户信息
      const participantUpdates = [];
      
      for (const participant of newParticipants) {
        const profile = await getUserProfile(ctx, participant.userId);
        participantUpdates.push({
          type: "joined" as const,
          userId: profile.userId,
          displayName: profile.displayName,
          avatar: profile.avatar,
          role: participant.role,
          joinedAt: participant.joinedAt,
        });
      }
      
      for (const participant of leftParticipants) {
        const profile = await getUserProfile(ctx, participant.userId);
        participantUpdates.push({
          type: "left" as const,
          userId: profile.userId,
          displayName: profile.displayName,
          avatar: profile.avatar,
          role: participant.role,
          leftAt: participant.leftAt,
        });
      }
      
      // 按时间排序
      participantUpdates.sort((a, b) => {
        const timeA = a.type === "joined" ? a.joinedAt : a.leftAt!;
        const timeB = b.type === "joined" ? b.joinedAt : b.leftAt!;
        return timeA - timeB;
      });
      
      return participantUpdates;
    } catch (error) {
      console.error("Failed to subscribe to conversation participants:", error);
      throw error;
    }
  },
});

/**
 * 获取实时连接状态
 * 用于检查实时连接的健康状态
 */
export const getConnectionStatus = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = args;
    
    try {
      // 更新用户的最后在线时间
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      
      if (profile) {
        await ctx.db.patch(profile._id, {
          lastSeenAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      
      return {
        connected: true,
        timestamp: Date.now(),
        userId,
      };
    } catch (error) {
      console.error("Failed to get connection status:", error);
      return {
        connected: false,
        timestamp: Date.now(),
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * 订阅好友请求变更
 * 用于实时获取新的好友请求
 */
export const subscribeToFriendRequests = query({
  args: {
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, since = 0 } = args;
    
    try {
      // 获取接收到的好友请求
      const receivedRequests = await ctx.db
        .query("friendRequests")
        .withIndex("by_toUser_status", (q) => 
          q.eq("toUserId", userId).eq("status", "pending")
        )
        .filter((q) => q.gt(q.field("createdAt"), since))
        .collect();
      
      // 获取发送的好友请求状态更新
      const sentRequests = await ctx.db
        .query("friendRequests")
        .withIndex("by_fromUser", (q) => q.eq("fromUserId", userId))
        .filter((q) => 
          q.and(
            q.gt(q.field("updatedAt"), since),
            q.neq(q.field("status"), "pending")
          )
        )
        .collect();
      
      // 获取发送者/接收者信息
      const requestsWithProfiles = await Promise.all([
        ...receivedRequests.map(async (request) => {
          const fromProfile = await getUserProfile(ctx, request.fromUserId);
          return {
            ...request,
            type: "received" as const,
            fromUser: {
              userId: fromProfile.userId,
              displayName: fromProfile.displayName,
              avatar: fromProfile.avatar,
            },
          };
        }),
        ...sentRequests.map(async (request) => {
          const toProfile = await getUserProfile(ctx, request.toUserId);
          return {
            ...request,
            type: "sent" as const,
            toUser: {
              userId: toProfile.userId,
              displayName: toProfile.displayName,
              avatar: toProfile.avatar,
            },
          };
        }),
      ]);
      
      // 按创建时间排序
      requestsWithProfiles.sort((a, b) => b.createdAt - a.createdAt);
      
      return requestsWithProfiles;
    } catch (error) {
      console.error("Failed to subscribe to friend requests:", error);
      throw error;
    }
  },
});