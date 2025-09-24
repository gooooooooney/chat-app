import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { FriendRequestStatus } from "./schema";
import type { 
  UserProfileWithId,
} from "./types";

// 验证自定义ID格式
function validateCustomId(customId: string): boolean {
  // 只允许英文字母、数字和下划线，长度3-20位
  const regex = /^[a-zA-Z0-9_]{3,20}$/;
  return regex.test(customId);
}

// 设置或更新自定义ID
export const setCustomId = mutation({
  args: {
    userId: v.string(),
    customId: v.string(),
  },
  handler: async (ctx, args) => {
    // 验证格式
    if (!validateCustomId(args.customId)) {
      throw new Error("自定义ID只能包含英文字母、数字和下划线，长度3-20位");
    }

    // 检查ID是否已被使用
    const existingUser = await ctx.db
      .query("userProfiles")
      .withIndex("by_customId", (q) => q.eq("customId", args.customId))
      .first();

    if (existingUser && existingUser.userId !== args.userId) {
      throw new Error("该自定义ID已被使用");
    }

    // 获取当前用户资料
    const currentUser = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!currentUser) {
      throw new Error("用户资料不存在");
    }

    // 更新自定义ID
    await ctx.db.patch(currentUser._id, {
      customId: args.customId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// 通过自定义ID查找用户
export const findUserByCustomId = query({
  args: { customId: v.string() },
  handler: async (ctx, args): Promise<UserProfileWithId | null> => {
    if (!validateCustomId(args.customId)) {
      return null;
    }

    return await ctx.db
      .query("userProfiles")
      .withIndex("by_customId", (q) => q.eq("customId", args.customId))
      .first();
  },
});

// 检查自定义ID是否可用
export const checkCustomIdAvailability = query({
  args: { customId: v.string() },
  handler: async (ctx, args): Promise<{ available: boolean; reason?: string }> => {
    if (!validateCustomId(args.customId)) {
      return { 
        available: false, 
        reason: "自定义ID只能包含英文字母、数字和下划线，长度3-20位" 
      };
    }

    const existingUser = await ctx.db
      .query("userProfiles")
      .withIndex("by_customId", (q) => q.eq("customId", args.customId))
      .first();

    if (existingUser) {
      return { available: false, reason: "该自定义ID已被使用" };
    }

    return { available: true };
  },
});

// 发送好友请求
export const sendFriendRequest = mutation({
  args: {
    fromUserId: v.string(),
    toCustomId: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 查找目标用户
    const targetUser = await ctx.db
      .query("userProfiles")
      .withIndex("by_customId", (q) => q.eq("customId", args.toCustomId))
      .first();

    if (!targetUser) {
      throw new Error("找不到该用户");
    }

    if (targetUser.userId === args.fromUserId) {
      throw new Error("不能添加自己为好友");
    }

    // 检查是否已经是好友
    // 因为好友关系按字典序存储，需要按正确顺序查询
    // 例如：alice(user1) 和 bob(user2) 的关系存储为 user1Id="alice", user2Id="bob"
    const [user1Id, user2Id] = [args.fromUserId, targetUser.userId].sort();
    const existingFriendship = await ctx.db
      .query("friendships")
      .withIndex("by_users", (q) => q.eq("user1Id", user1Id).eq("user2Id", user2Id))
      .first();

    if (existingFriendship) {
      throw new Error("你们已经是好友了");
    }

    // 检查是否已有待处理的请求
    const existingRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", (q) => q.eq("fromUserId", args.fromUserId).eq("toUserId", targetUser.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new Error("已发送过好友请求，请等待对方回应");
    }

    // 检查对方是否已向你发送请求
    const reverseRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", (q) => q.eq("fromUserId", targetUser.userId).eq("toUserId", args.fromUserId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (reverseRequest) {
      // 直接接受对方的请求，建立好友关系
      await ctx.db.patch(reverseRequest._id, {
        status: "accepted",
        updatedAt: Date.now(),
      });

      // 创建好友关系
      // 重要：必须按字典序排列，确保数据一致性
      // 无论谁先添加谁，最终存储的记录格式都是一样的
      const [user1Id, user2Id] = [args.fromUserId, targetUser.userId].sort();
      await ctx.db.insert("friendships", {
        user1Id,  // 字典序较小的用户ID
        user2Id,  // 字典序较大的用户ID
        createdAt: Date.now(),
      });

      return { 
        success: true, 
        message: "已与该用户成为好友！",
        autoAccepted: true 
      };
    }

    // 创建新的好友请求
    await ctx.db.insert("friendRequests", {
      fromUserId: args.fromUserId,
      toUserId: targetUser.userId,
      status: "pending",
      message: args.message,
      createdAt: Date.now(),
    });

    return { 
      success: true, 
      message: "好友请求已发送",
      autoAccepted: false 
    };
  },
});

// 获取收到的好友请求
export const getReceivedFriendRequests = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("friendRequests")
      .withIndex("by_toUser_status", (q) => q.eq("toUserId", args.userId).eq("status", "pending"))
      .collect();

    // 获取发送者信息
    const requestsWithSender = await Promise.all(
      requests.map(async (request) => {
        const sender = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", request.fromUserId))
          .first();
        
        return {
          ...request,
          sender,
        };
      })
    );

    return requestsWithSender.filter(r => r.sender);
  },
});

// 响应好友请求
export const respondToFriendRequest = mutation({
  args: {
    requestId: v.id("friendRequests"),
    userId: v.string(),
    action: v.union(v.literal("accept"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("好友请求不存在");
    }

    if (request.toUserId !== args.userId) {
      throw new Error("无权限处理此请求");
    }

    if (request.status !== "pending") {
      throw new Error("请求已被处理");
    }

    const newStatus = args.action === "accept" ? "accepted" : "rejected";

    // 更新请求状态
    await ctx.db.patch(args.requestId, {
      status: newStatus,
      updatedAt: Date.now(),
    });

    // 如果接受，创建好友关系
    if (args.action === "accept") {
      // 创建规范化的好友关系记录
      // 按字典序排列，确保数据一致性
      const [user1Id, user2Id] = [request.fromUserId, request.toUserId].sort();
      await ctx.db.insert("friendships", {
        user1Id,  // 字典序较小的用户ID
        user2Id,  // 字典序较大的用户ID  
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// 获取好友列表
export const getFriendsList = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // 因为好友关系按字典序存储，当前用户可能出现在user1Id或user2Id位置
    // 需要分别查询两种情况
    
    // 情况1：当前用户ID较小，存储在user1Id位置
    const friendships1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1", (q) => q.eq("user1Id", args.userId))
      .collect();

    // 情况2：当前用户ID较大，存储在user2Id位置  
    const friendships2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2", (q) => q.eq("user2Id", args.userId))
      .collect();

    // 提取好友ID
    // 从friendships1中提取user2Id（因为当前用户是user1Id）
    // 从friendships2中提取user1Id（因为当前用户是user2Id）
    const friendIds = [
      ...friendships1.map(f => f.user2Id),  // 当前用户在user1Id位置，好友在user2Id
      ...friendships2.map(f => f.user1Id),  // 当前用户在user2Id位置，好友在user1Id
    ];

    // 获取好友信息
    const friends = await Promise.all(
      friendIds.map(async (friendId) => {
        return await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", friendId))
          .first();
      })
    );

    return friends.filter(Boolean);
  },
});

// 删除好友
export const removeFriend = mutation({
  args: {
    userId: v.string(),
    friendId: v.string(),
  },
  handler: async (ctx, args) => {
    // 按字典序排列用户ID，确保能找到正确的好友关系记录
    // 无论是A删除B还是B删除A，查询的都是同一条记录
    const [user1Id, user2Id] = [args.userId, args.friendId].sort();
    
    const friendship = await ctx.db
      .query("friendships")
      .withIndex("by_users", (q) => q.eq("user1Id", user1Id).eq("user2Id", user2Id))
      .first();

    if (!friendship) {
      throw new Error("好友关系不存在");
    }

    // 删除好友关系记录
    await ctx.db.delete(friendship._id);
    return { success: true };
  },
});