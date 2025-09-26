import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { FriendRequestStatus } from "../schema";
import type {
  UserProfileWithId,
} from "../types";
import { authComponent, createAuth } from "../auth";
import { api } from "../_generated/api";

// 通过邮箱查找用户
export const findUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<UserProfileWithId | null> => {
    // 使用 better-auth 组件查询用户

    const authUsers = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("email"), args.email))
      .collect();

    if (authUsers.length === 0) {
      return null;
    }

    const authUser = authUsers[0];

    // 查找对应的用户资料
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
      .first();

    return userProfile;
  },
});

// 发送好友请求
export const sendFriendRequest = mutation({
  args: {
    fromUserId: v.string(),
    toEmail: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 查找目标用户
    const targetUser = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("email"), args.toEmail))
      .first();

    if (!targetUser) {
      throw new Error("找不到该用户");
    }

    if (targetUser._id === args.fromUserId) {
      throw new Error("不能添加自己为好友");
    }

    // 检查是否已经是好友
    // 因为好友关系按字典序存储，需要按正确顺序查询
    // 例如：alice(user1) 和 bob(user2) 的关系存储为 user1Id="alice", user2Id="bob"
    const [user1Id, user2Id] = [args.fromUserId, targetUser._id].sort();
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
      .withIndex("by_users", (q) => q.eq("fromUserId", args.fromUserId).eq("toUserId", targetUser._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new Error("已发送过好友请求，请等待对方回应");
    }

    // 检查对方是否已向你发送请求
    const reverseRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", (q) => q.eq("fromUserId", targetUser._id).eq("toUserId", args.fromUserId))
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
      const [user1Id, user2Id] = [args.fromUserId, targetUser._id].sort();
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
      toUserId: targetUser._id,
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

// 检查两个用户之间的关系状态
export const checkFriendshipStatus = query({
  args: {
    currentUserId: v.string(),
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.currentUserId === args.targetUserId) {
      return { status: "self" };
    }

    // 检查是否已经是好友
    const [user1Id, user2Id] = [args.currentUserId, args.targetUserId].sort();
    const friendship = await ctx.db
      .query("friendships")
      .withIndex("by_users", (q) => q.eq("user1Id", user1Id).eq("user2Id", user2Id))
      .first();

    if (friendship) {
      return { status: "friend", friendshipId: friendship._id };
    }

    // 检查是否有待处理的请求 (当前用户发送给目标用户)
    const sentRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", (q) => q.eq("fromUserId", args.currentUserId).eq("toUserId", args.targetUserId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (sentRequest) {
      return { status: "sent_pending", requestId: sentRequest._id };
    }

    // 检查是否有待处理的请求 (目标用户发送给当前用户)
    const receivedRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", (q) => q.eq("fromUserId", args.targetUserId).eq("toUserId", args.currentUserId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (receivedRequest) {
      return { status: "received_pending", requestId: receivedRequest._id };
    }

    // 默认是陌生人
    return { status: "stranger" };
  },
});