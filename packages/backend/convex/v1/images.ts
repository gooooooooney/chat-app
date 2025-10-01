import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { authComponent } from "../auth";
import { Id } from "../_generated/dataModel";

/**
 * 生成图片上传 URL（供客户端使用）
 * 客户端流程：
 * 1. 调用此函数获取 uploadUrl 和 imageKey
 * 2. 直接上传到 uploadUrl
 * 3. 调用 completeImageUpload 完成上传并创建消息
 */
export const generateImageUploadUrl = mutation({
  args: {
    conversationId: v.id("conversations"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    // 验证用户认证
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Must be logged in to upload images");
    }

    // 验证用户是会话参与者
    const participant = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user.id)
      )
      .first();

    if (!participant || participant.leftAt) {
      throw new Error("Forbidden: You are not a member of this conversation");
    }

    // 生成唯一的文件键
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const sanitizedFileName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const imageKey = `images/${args.conversationId}/${timestamp}_${randomId}_${sanitizedFileName}`;

    // 调用 r2.generateUploadUrl
    const result = await ctx.runMutation(api.r2.generateUploadUrl, {
      key: imageKey,
    });

    return {
      uploadUrl: result,
      imageKey,
    };
  },
});

/**
 * 完成图片上传并创建消息
 * 在客户端上传完成后调用，同步元数据并创建消息
 */
export const completeImageUpload = mutation({
  args: {
    conversationId: v.id("conversations"),
    imageKey: v.string(),
    imageMetadata: v.object({
      width: v.number(),
      height: v.number(),
      size: v.number(),
      mimeType: v.string(),
    }),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // 验证用户认证
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Must be logged in");
    }

    // 同步 R2 元数据到 images 表
    await ctx.runMutation(api.r2.syncMetadata, {
      key: args.imageKey,
    });

    // 创建图片消息
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user.id,
      content: "[图片]",
      type: "image",
      imageKey: args.imageKey,
      imageMetadata: args.imageMetadata,
      uploadStatus: "completed",
      replyToId: args.replyToId,
    });

    // 更新会话的最后消息时间
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview: "[图片]",
      updatedAt: Date.now(),
    });

    // 关联图片和消息
    const image = await ctx.db
      .query("images")
      .withIndex("by_imageKey", (q) => q.eq("imageKey", args.imageKey))
      .first();

    if (image) {
      await ctx.db.patch(image._id, {
        messageId,
      });
    }

    return messageId;
  },
});

/**
 * 获取图片 URL
 * 根据 imageKey 动态生成访问 URL
 */
export const getImageUrl = query({
  args: {
    imageKey: v.string(),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db
      .query("images")
      .withIndex("by_imageKey", (q) => q.eq("imageKey", args.imageKey))
      .first();

    if (!image) {
      return null;
    }

    // 通过 action 调用 r2.getUrl
    return await ctx.runAction(internal.images.getImageUrlAction, {
      imageKey: args.imageKey,
    });
  },
});

/**
 * 内部 action 用于获取 R2 URL
 */
export const getImageUrlAction = action({
  args: {
    imageKey: v.string(),
  },
  handler: async (ctx, args) => {
    // 使用 r2 组件的 getUrl 方法
    const images = await ctx.runQuery(api.r2.listImages, {});
    const image = images.find((img) => img.key === args.imageKey);
    return image?.url || null;
  },
});

/**
 * 获取消息的图片 URL（带元数据）
 */
export const getMessageImages = query({
  args: {
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.messageIds.map(async (messageId) => {
        const message = await ctx.db.get(messageId);
        if (!message || !message.imageKey) {
          return null;
        }

        const image = await ctx.db
          .query("images")
          .withIndex("by_imageKey", (q) => q.eq("imageKey", message.imageKey!))
          .first();

        if (!image) {
          return null;
        }

        // 获取 URL
        const url = await ctx.runAction(internal.images.getImageUrlAction, {
          imageKey: message.imageKey,
        });

        return {
          messageId,
          imageKey: message.imageKey,
          url,
          metadata: message.imageMetadata || image.metadata,
        };
      })
    );

    return results.filter((r) => r !== null);
  },
});

/**
 * 删除图片（同时删除 R2 和数据库记录）
 */
export const deleteImage = mutation({
  args: {
    imageKey: v.string(),
  },
  handler: async (ctx, args) => {
    // 验证用户认证
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // 查找图片记录
    const image = await ctx.db
      .query("images")
      .withIndex("by_imageKey", (q) => q.eq("imageKey", args.imageKey))
      .first();

    if (!image) {
      throw new Error("Image not found");
    }

    // 验证权限（只有上传者可以删除）
    if (image.uploadedBy !== user.id) {
      throw new Error("Forbidden: You can only delete your own images");
    }

    // 调用 r2.deleteObject（会触发 onDelete 回调清理数据库）
    await ctx.runMutation(api.r2.deleteObject, {
      key: args.imageKey,
    });

    return { success: true };
  },
});

/**
 * 获取用户上传的所有图片
 */
export const getUserImages = query({
  args: {
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = args.userId || user?.id;

    if (!userId) {
      throw new Error("User ID required");
    }

    let query = ctx.db
      .query("images")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", userId));

    if (args.limit) {
      query = query.take(args.limit);
    }

    return await query.collect();
  },
});

/**
 * 更新图片说明
 */
export const updateImageCaption = mutation({
  args: {
    imageId: v.id("images"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    if (image.uploadedBy !== user.id) {
      throw new Error("Forbidden: You can only update your own images");
    }

    await ctx.db.patch(args.imageId, {
      caption: args.caption,
    });

    return { success: true };
  },
});
