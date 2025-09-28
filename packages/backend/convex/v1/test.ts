import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

/**
 * 测试创建会话和发送消息的完整流程
 * 这个函数用于验证 Phase 1 API 的功能
 */
export const testChatFlow = mutation({
  args: {
    user1Id: v.string(),
    user2Id: v.string(),
    testMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user1Id, user2Id, testMessage = "Hello, this is a test message!" } = args;
    
    try {
      console.log("🧪 Starting chat flow test...");
      
      // 步骤1: 检查用户是否存在
      console.log("📋 Step 1: Checking users exist...");
      const user1 = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", user1Id))
        .first();
      
      const user2 = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", user2Id))
        .first();
      
      if (!user1 || !user2) {
        throw new Error("One or both users do not exist");
      }
      
      console.log(`✅ Users found: ${user1.displayName} & ${user2.displayName}`);
      
      // 步骤2: 检查/创建好友关系
      console.log("🤝 Step 2: Checking friendship...");
      const [friendUser1, friendUser2] = [user1Id, user2Id].sort();
      let friendship = await ctx.db
        .query("friendships")
        .withIndex("by_users", (q) => 
          q.eq("user1Id", friendUser1).eq("user2Id", friendUser2)
        )
        .first();
      
      if (!friendship) {
        console.log("➕ Creating friendship...");
        const friendshipId = await ctx.db.insert("friendships", {
          user1Id: friendUser1,
          user2Id: friendUser2,
          createdAt: Date.now(),
        });
        friendship = await ctx.db.get(friendshipId);
        console.log("✅ Friendship created");
      } else {
        console.log("✅ Friendship already exists");
      }
      
      // 步骤3: 查找或创建直接会话
      console.log("💬 Step 3: Finding or creating conversation...");
      
      // 查找现有会话
      const conversations = await ctx.db
        .query("conversations")
        .filter((q) => q.eq(q.field("type"), "direct"))
        .collect();
      
      let conversation = null;
      for (const conv of conversations) {
        const participants = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation", (q) => 
            q.eq("conversationId", conv._id)
          )
          .filter((q) => q.eq(q.field("leftAt"), undefined))
          .collect();
        
        const participantIds = participants.map(p => p.userId).sort();
        const targetIds = [user1Id, user2Id].sort();
        
        if (participantIds.length === 2 && 
            participantIds[0] === targetIds[0] && 
            participantIds[1] === targetIds[1]) {
          conversation = conv;
          break;
        }
      }
      
      if (!conversation) {
        console.log("➕ Creating new conversation...");
        const now = Date.now();
        
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdBy: user1Id,
          archived: false,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        });
        
        // 添加参与者
        await Promise.all([
          ctx.db.insert("conversationParticipants", {
            conversationId,
            userId: user1Id,
            role: "member",
            joinedAt: now,
            muted: false,
            pinned: false,
          }),
          ctx.db.insert("conversationParticipants", {
            conversationId,
            userId: user2Id,
            role: "member",
            joinedAt: now,
            muted: false,
            pinned: false,
          }),
        ]);
        
        conversation = await ctx.db.get(conversationId);
        console.log("✅ Conversation created");
      } else {
        console.log("✅ Conversation already exists");
      }
      
      // 步骤4: 发送测试消息
      console.log("📨 Step 4: Sending test message...");
      const now = Date.now();
      
      const messageId = await ctx.db.insert("messages", {
        conversationId: conversation!._id,
        senderId: user1Id,
        content: testMessage,
        type: "text",
        edited: false,
        deleted: false,
        createdAt: now,
      });
      
      // 更新会话最后消息时间
      await ctx.db.patch(conversation!._id, {
        lastMessageAt: now,
        lastMessagePreview: testMessage,
        updatedAt: now,
      });
      
      console.log("✅ Message sent");
      
      // 步骤5: 验证消息可以被接收者看到
      console.log("👀 Step 5: Verifying message visibility...");
      
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => 
          q.eq("conversationId", conversation!._id)
        )
        .filter((q) => q.eq(q.field("deleted"), undefined))
        .collect();
      
      console.log(`✅ Found ${messages.length} messages in conversation`);
      
      // 步骤6: 模拟user2标记消息已读
      console.log("📖 Step 6: Marking message as read...");
      
      await ctx.db.insert("messageReadStatus", {
        messageId,
        userId: user2Id,
        readAt: Date.now(),
      });
      
      console.log("✅ Message marked as read");
      
      // 返回测试结果
      const result = {
        success: true,
        conversationId: conversation!._id,
        messageId,
        participants: [
          { userId: user1Id, displayName: user1.displayName },
          { userId: user2Id, displayName: user2.displayName },
        ],
        messageCount: messages.length,
        testMessage,
        timestamp: Date.now(),
      };
      
      console.log("🎉 Chat flow test completed successfully!");
      console.log("📊 Test result:", result);
      
      return result;
      
    } catch (error) {
      console.error("❌ Chat flow test failed:", error);
      throw error;
    }
  },
});

/**
 * 获取测试结果和统计信息
 */
export const getTestStats = query({
  args: {},
  handler: async (ctx) => {
    try {
      // 统计用户数量
      const usersCount = await ctx.db
        .query("userProfiles")
        .collect()
        .then(users => users.length);
      
      // 统计好友关系数量
      const friendshipsCount = await ctx.db
        .query("friendships")
        .collect()
        .then(friendships => friendships.length);
      
      // 统计会话数量
      const conversationsCount = await ctx.db
        .query("conversations")
        .collect()
        .then(conversations => conversations.length);
      
      // 统计消息数量
      const messagesCount = await ctx.db
        .query("messages")
        .filter((q) => q.eq(q.field("deleted"), undefined))
        .collect()
        .then(messages => messages.length);
      
      // 统计好友请求数量
      const friendRequestsCount = await ctx.db
        .query("friendRequests")
        .collect()
        .then(requests => requests.length);
      
      // 获取最近的会话
      const recentConversations = await ctx.db
        .query("conversations")
        .order("desc")
        .take(5);
      
      // 获取最近的消息
      const recentMessages = await ctx.db
        .query("messages")
        .filter((q) => q.eq(q.field("deleted"), undefined))
        .order("desc")
        .take(5);
      
      return {
        stats: {
          users: usersCount,
          friendships: friendshipsCount,
          conversations: conversationsCount,
          messages: messagesCount,
          friendRequests: friendRequestsCount,
        },
        recentActivity: {
          conversations: recentConversations,
          messages: recentMessages,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Failed to get test stats:", error);
      throw error;
    }
  },
});

/**
 * 清理测试数据
 * 注意：这个函数会删除所有测试相关的数据，仅在开发环境使用
 */
export const cleanupTestData = mutation({
  args: {
    confirmCleanup: v.boolean(),
    targetUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.confirmCleanup) {
      throw new Error("Must confirm cleanup by setting confirmCleanup to true");
    }
    
    console.log("🧹 Starting test data cleanup...");
    
    try {
      let deletedCount = 0;
      
      if (args.targetUserId) {
        console.log(`🎯 Cleaning up data for user: ${args.targetUserId}`);
        
        // 删除用户参与的会话中的消息
        const participations = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
          .collect();
        
        for (const participation of participations) {
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => 
              q.eq("conversationId", participation.conversationId)
            )
            .collect();
          
          for (const message of messages) {
            await ctx.db.delete(message._id);
            deletedCount++;
          }
          
          // 删除参与者记录
          await ctx.db.delete(participation._id);
          deletedCount++;
          
          // 如果会话没有其他参与者，删除会话
          const remainingParticipants = await ctx.db
            .query("conversationParticipants")
            .withIndex("by_conversation", (q) => 
              q.eq("conversationId", participation.conversationId)
            )
            .collect();
          
          if (remainingParticipants.length === 0) {
            await ctx.db.delete(participation.conversationId);
            deletedCount++;
          }
        }
        
        // 删除用户的好友关系
        const friendships1 = await ctx.db
          .query("friendships")
          .withIndex("by_user1", (q) => q.eq("user1Id", args.targetUserId))
          .collect();
        
        const friendships2 = await ctx.db
          .query("friendships")
          .withIndex("by_user2", (q) => q.eq("user2Id", args.targetUserId))
          .collect();
        
        for (const friendship of [...friendships1, ...friendships2]) {
          await ctx.db.delete(friendship._id);
          deletedCount++;
        }
        
        // 删除好友请求
        const sentRequests = await ctx.db
          .query("friendRequests")
          .withIndex("by_fromUser", (q) => q.eq("fromUserId", args.targetUserId))
          .collect();
        
        const receivedRequests = await ctx.db
          .query("friendRequests")
          .withIndex("by_toUser", (q) => q.eq("toUserId", args.targetUserId))
          .collect();
        
        for (const request of [...sentRequests, ...receivedRequests]) {
          await ctx.db.delete(request._id);
          deletedCount++;
        }
        
      } else {
        console.log("🧹 Cleaning up ALL test data...");
        
        // 删除所有消息已读状态
        const readStatuses = await ctx.db.query("messageReadStatus").collect();
        for (const status of readStatuses) {
          await ctx.db.delete(status._id);
          deletedCount++;
        }
        
        // 删除所有消息
        const messages = await ctx.db.query("messages").collect();
        for (const message of messages) {
          await ctx.db.delete(message._id);
          deletedCount++;
        }
        
        // 删除所有会话参与者
        const participants = await ctx.db.query("conversationParticipants").collect();
        for (const participant of participants) {
          await ctx.db.delete(participant._id);
          deletedCount++;
        }
        
        // 删除所有会话
        const conversations = await ctx.db.query("conversations").collect();
        for (const conversation of conversations) {
          await ctx.db.delete(conversation._id);
          deletedCount++;
        }
        
        // 删除所有好友关系
        const friendships = await ctx.db.query("friendships").collect();
        for (const friendship of friendships) {
          await ctx.db.delete(friendship._id);
          deletedCount++;
        }
        
        // 删除所有好友请求
        const friendRequests = await ctx.db.query("friendRequests").collect();
        for (const request of friendRequests) {
          await ctx.db.delete(request._id);
          deletedCount++;
        }
      }
      
      console.log(`✅ Cleanup completed! Deleted ${deletedCount} records.`);
      
      return {
        success: true,
        deletedCount,
        timestamp: Date.now(),
      };
      
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
      throw error;
    }
  },
});

/**
 * 创建测试用户
 */
export const createTestUsers = mutation({
  args: {
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const count = args.count || 2;
    
    console.log(`👥 Creating ${count} test users...`);
    
    const users = [];
    const now = Date.now();
    
    for (let i = 1; i <= count; i++) {
      const userId = `test_user_${i}_${now}`;
      const email = `testuser${i}@test.com`;
      
      const userProfileId = await ctx.db.insert("userProfiles", {
        userId,
        displayName: `Test User ${i}`,
        email,
        bio: `This is test user ${i}`,
        statusMessage: "Testing the chat system",
        presence: "online",
        lastSeenAt: now,
        updatedAt: now,
      });
      
      users.push({
        _id: userProfileId,
        userId,
        displayName: `Test User ${i}`,
        email,
      });
    }
    
    console.log(`✅ Created ${users.length} test users`);
    
    return {
      success: true,
      users,
      count: users.length,
    };
  },
});