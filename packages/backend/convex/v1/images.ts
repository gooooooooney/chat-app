import { v } from "convex/values";
import { mutation, action } from "../_generated/server";
import { verifyConversationAccess } from "./helpers/utils";
import { r2, getFileUrl } from "../r2";

/**
 * 生成图片上传 URL
 */
export const generateImageUploadUrl = action({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    // 验证用户权限
    await verifyConversationAccess(ctx, args.userId, args.conversationId);
    
    // 生成唯一的文件键
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const fileKey = `images/${args.conversationId}/${timestamp}_${randomId}_${args.fileName}`;
    
    // 使用 R2 组件生成上传 URL
    const uploadResult = await r2.generateUploadUrl(fileKey);
    
    return {
      uploadUrl: uploadResult.url,
      fileKey,
    };
  },
});

/**
 * 完成图片上传并创建消息
 */
export const completeImageUpload = action({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    fileKey: v.string(),
    metadata: v.object({
      width: v.number(),
      height: v.number(),
      size: v.number(),
      mimeType: v.string(),
    }),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // 验证用户权限
    await verifyConversationAccess(ctx, args.senderId, args.conversationId);
    
    // 获取图片 URL
    const imageUrl = await getFileUrl(args.fileKey);
    
    // 创建图片消息（使用 mutation）
    const messageId = await ctx.runMutation("v1/messages:sendMessage", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      content: `[图片]`,
      type: "image",
      replyToId: args.replyToId,
    });
    
    // 更新消息添加图片信息
    await ctx.runMutation("v1/images:updateMessageWithImage", {
      messageId,
      imageUrl,
      imageKey: args.fileKey,
      imageMetadata: args.metadata,
    });
    
    return messageId;
  },
});

/**
 * 更新消息添加图片信息 (内部 mutation)
 */
export const updateMessageWithImage = mutation({
  args: {
    messageId: v.id("messages"),
    imageUrl: v.string(),
    imageKey: v.string(),
    imageMetadata: v.object({
      width: v.number(),
      height: v.number(),
      size: v.number(),
      mimeType: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      imageUrl: args.imageUrl,
      imageKey: args.imageKey,
      imageMetadata: args.imageMetadata,
      uploadStatus: "completed",
    });
  },
});

/**
 * 获取图片 URL
 */
export const getImageUrl = action({
  args: {
    fileKey: v.string(),
  },
  handler: async (_ctx, args) => {
    return await getFileUrl(args.fileKey);
  },
});