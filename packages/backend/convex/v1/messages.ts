import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { verifyConversationAccess, getUserProfile } from "./helpers/utils";
import { MessageType } from "../schema";
import { R2 } from "@convex-dev/r2";
import { components } from "../_generated/api";

const r2 = new R2(components.r2);

/**
 * 获取会话中的消息列表（支持分页）
 */
export const getConversationMessages = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, limit = 20, cursor } = args;

    try {
      // 验证用户访问权限
      await verifyConversationAccess(ctx, userId, conversationId);
      let query = ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversationId)
        )
        .filter((q) => q.eq(q.field("deleted"), false));

      // 如果有cursor，从指定位置开始查询
      if (cursor) {
        const cursorTimestamp = parseInt(cursor);
        query = query.filter((q) => q.lt(q.field("_creationTime"), cursorTimestamp));
      }


      const messages = await query
        .order("desc")
        .take(limit);
      // 获取发送者信息和回复消息信息
      const messagesWithDetails = await Promise.all(
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

          // 获取消息已读状态（仅群组消息）
          const conversation = await ctx.db.get(conversationId);
          let readStatus = null;

          if (conversation?.type === "group" && message.senderId !== userId) {
            const readRecord = await ctx.db
              .query("messageReadStatus")
              .withIndex("by_message_user", (q) =>
                q.eq("messageId", message._id).eq("userId", userId)
              )
              .first();

            readStatus = readRecord ? "read" : "delivered";
          } else if (message.senderId === userId) {
            // 对于自己发送的消息，检查其他人是否已读
            const readRecords = await ctx.db
              .query("messageReadStatus")
              .withIndex("by_message", (q) => q.eq("messageId", message._id))
              .collect();

            const participants = await ctx.db
              .query("conversationParticipants")
              .withIndex("by_conversation", (q) =>
                q.eq("conversationId", conversationId)
              )
              .filter((q) => q.eq(q.field("leftAt"), undefined))
              .collect();

            const otherParticipants = participants.filter(p => p.userId !== userId);

            if (readRecords.length === otherParticipants.length) {
              readStatus = "read";
            } else if (readRecords.length > 0) {
              readStatus = "delivered";
            } else {
              readStatus = "sent";
            }
          }

          // 如果消息包含图片，生成图片 URL
          let imageUrl: string | undefined;
          if (message.imageKey) {
            try {
              imageUrl = await r2.getUrl(message.imageKey);
            } catch (error) {
              console.error(`Failed to get image URL for key ${message.imageKey}:`, error);
            }
          }

          return {
            ...message,
            imageUrl, // 动态生成的图片 URL
            sender: {
              userId: sender.userId,
              displayName: sender.displayName,
              avatar: sender.avatar,
            },
            replyTo: replyToMessage,
            attachments,
            status: readStatus || "sent",
          };
        })
      );


      // 返回时间正序（最旧的在前）
      const sortedMessages = messagesWithDetails.reverse();

      // 生成下一页的cursor
      const nextCursor = messages.length === limit
        ? messages[messages.length - 1]._creationTime.toString()
        : null;

      return {
        messages: sortedMessages,
        nextCursor,
        hasMore: messages.length === limit,
      };
    } catch (error) {
      console.error("Failed to get conversation messages:", error);
      throw error;
    }
  },
});

/**
 * 发送消息
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    content: v.string(),
    type: v.optional(MessageType),
    replyToId: v.optional(v.id("messages")),
    // 图片相关字段（type='image'时使用）
    imageKey: v.optional(v.string()),
    imageMetadata: v.optional(v.object({
      width: v.number(),
      height: v.number(),
      size: v.number(),
      mimeType: v.string(),
    })),
    uploadStatus: v.optional(v.union(
      v.literal("uploading"),
      v.literal("completed"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    const {
      conversationId,
      senderId,
      content,
      type = "text",
      replyToId,
      imageKey,
      imageMetadata,
      uploadStatus,
    } = args;

    try {
      // 验证用户访问权限
      await verifyConversationAccess(ctx, senderId, conversationId);

      // 内容验证
      if (!content.trim() || content.length > 2000) {
        throw new Error("Invalid message content");
      }

      // 如果是图片消息，验证imageKey存在
      if (type === "image" && !imageKey) {
        throw new Error("Image messages require imageKey");
      }

      // 验证回复消息是否存在且属于当前会话
      if (replyToId) {
        const replyToMessage = await ctx.db.get(replyToId);
        if (!replyToMessage || replyToMessage.conversationId !== conversationId || replyToMessage.deleted) {
          throw new Error("Invalid reply message");
        }
      }

      const now = Date.now();

      // 创建消息
      const messageId = await ctx.db.insert("messages", {
        conversationId,
        senderId,
        content: content.trim(),
        type,
        replyToId,
        imageKey,
        imageMetadata,
        uploadStatus: uploadStatus || (type === "image" ? "completed" : undefined),
        edited: false,
        deleted: false,
      });

      // 如果有图片，更新 images 表中的记录，关联 messageId
      if (imageKey) {
        const image = await ctx.db
          .query("images")
          .withIndex("bucket_key", (q) =>
            q.eq("bucket", r2.config.bucket).eq("key", imageKey)
          )
          .first();

        if (image) {
          await ctx.db.patch(image._id, { messageId });
        }
      }

      // 更新会话最后消息时间和预览
      const messagePreview = type === "text"
        ? content.trim()
        : type === "image"
          ? "[图片]"
          : "[文件]";

      await ctx.db.patch(conversationId, {
        lastMessageAt: now,
        lastMessagePreview: messagePreview,
        updatedAt: now,
      });

      return messageId;
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  },
});

/**
 * 标记消息已读
 */
export const markMessagesAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, messageIds } = args;

    try {
      // 验证访问权限
      await verifyConversationAccess(ctx, userId, conversationId);

      const now = Date.now();

      // 批量创建已读记录
      await Promise.all(
        messageIds.map(async (messageId) => {
          // 检查消息是否属于当前会话
          const message = await ctx.db.get(messageId);
          if (!message || message.conversationId !== conversationId) {
            return;
          }

          // 不需要标记自己的消息为已读
          if (message.senderId === userId) {
            return;
          }

          // 检查是否已经标记为已读
          const existing = await ctx.db
            .query("messageReadStatus")
            .withIndex("by_message_user", (q) =>
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

      // 更新用户在会话中的最后阅读时间
      const participation = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversationId", conversationId).eq("userId", userId)
        )
        .first();

      if (participation) {
        await ctx.db.patch(participation._id, {
          lastReadAt: now,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
      throw error;
    }
  },
});

/**
 * 编辑消息
 */
export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.string(),
    newContent: v.string(),
  },
  handler: async (ctx, args) => {
    const { messageId, userId, newContent } = args;

    try {
      const message = await ctx.db.get(messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      // 只有发送者可以编辑消息
      if (message.senderId !== userId) {
        throw new Error("Only the sender can edit this message");
      }

      // 已删除的消息不能编辑
      if (message.deleted) {
        throw new Error("Cannot edit deleted message");
      }

      // 验证新内容
      if (!newContent.trim() || newContent.length > 2000) {
        throw new Error("Invalid message content");
      }

      const now = Date.now();

      // 更新消息内容
      await ctx.db.patch(messageId, {
        content: newContent.trim(),
        edited: true,
        editedAt: now,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to edit message:", error);
      throw error;
    }
  },
});

/**
 * 删除消息
 */
export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { messageId, userId } = args;

    try {
      const message = await ctx.db.get(messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      // 验证删除权限（发送者或管理员）
      let canDelete = message.senderId === userId;

      if (!canDelete) {
        // 检查是否是群组管理员
        const participation = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation_user", (q) =>
            q.eq("conversationId", message.conversationId).eq("userId", userId)
          )
          .first();

        canDelete = !!(participation && ["owner", "admin"].includes(participation.role));
      }

      if (!canDelete) {
        throw new Error("Insufficient permissions to delete this message");
      }

      const now = Date.now();

      // 标记消息为已删除
      await ctx.db.patch(messageId, {
        deleted: true,
        deletedAt: now,
        content: "", // 清空内容
      });

      // 删除相关的已读状态记录
      const readStatuses = await ctx.db
        .query("messageReadStatus")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .collect();

      await Promise.all(
        readStatuses.map(status => ctx.db.delete(status._id))
      );

      return { success: true };
    } catch (error) {
      console.error("Failed to delete message:", error);
      throw error;
    }
  },
});

/**
 * 获取消息统计信息
 */
export const getMessageStats = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId } = args;

    try {
      // 验证访问权限
      await verifyConversationAccess(ctx, userId, conversationId);

      // 获取总消息数
      const totalMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversationId)
        )
        .filter((q) => q.eq(q.field("deleted"), false))
        .collect();

      // 获取未读消息数
      const unreadMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversationId)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("deleted"), false),
            q.neq(q.field("senderId"), userId)
          )
        )
        .collect();

      let unreadCount = 0;
      for (const message of unreadMessages) {
        const readStatus = await ctx.db
          .query("messageReadStatus")
          .withIndex("by_message_user", (q) =>
            q.eq("messageId", message._id).eq("userId", userId)
          )
          .first();

        if (!readStatus) {
          unreadCount++;
        }
      }

      // 获取我发送的消息数
      const myMessages = totalMessages.filter(m => m.senderId === userId);

      return {
        totalCount: totalMessages.length,
        unreadCount,
        myMessageCount: myMessages.length,
        lastMessageAt: Math.max(...totalMessages.map(m => m._creationTime), 0),
      };
    } catch (error) {
      console.error("Failed to get message stats:", error);
      throw error;
    }
  },
});

/**
 * 搜索消息
 */
export const searchMessages = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, query: searchQuery, limit = 20 } = args;

    try {
      // 验证访问权限
      await verifyConversationAccess(ctx, userId, conversationId);

      if (!searchQuery.trim()) {
        return [];
      }

      // 获取所有消息并在内存中过滤（简单实现）
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversationId)
        )
        .filter((q) => q.eq(q.field("deleted"), false))
        .collect();

      // 简单的文本搜索
      const searchResults = messages
        .filter(message =>
          message.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, limit);

      // 获取发送者信息
      const resultsWithSenders = await Promise.all(
        searchResults.map(async (message) => {
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

      return resultsWithSenders;
    } catch (error) {
      console.error("Failed to search messages:", error);
      throw error;
    }
  },
});