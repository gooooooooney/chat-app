import { QueryCtx, MutationCtx } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";

/**
 * 验证用户是否有权限访问指定会话
 */
export async function verifyConversationAccess(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  conversationId: Id<"conversations">
): Promise<Doc<"conversationParticipants">> {
  const participant = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_conversation_user", (q) => 
      q.eq("conversationId", conversationId).eq("userId", userId)
    )
    .first();
    
  if (!participant || participant.leftAt) {
    throw new Error("Access denied: User is not a participant in this conversation");
  }
  
  return participant;
}

/**
 * 验证所有参与者之间都是好友关系
 */
export async function verifyParticipantsFriendship(
  ctx: QueryCtx | MutationCtx,
  participants: string[]
): Promise<void> {
  // 对于1v1聊天，验证两个用户是否是好友
  if (participants.length === 2) {
    const friendship = await checkFriendship(ctx, participants[0], participants[1]);
    if (!friendship) {
      throw new Error(`Users ${participants[0]} and ${participants[1]} are not friends`);
    }
    return;
  }
  
  // 对于群组聊天，验证所有参与者之间都是好友关系（可选择性实施）
  // 注意：这里可以根据业务需求调整验证策略
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const friendship = await checkFriendship(ctx, participants[i], participants[j]);
      if (!friendship) {
        // 群组聊天可以允许非好友关系，这里只是警告
        console.warn(`Users ${participants[i]} and ${participants[j]} are not friends`);
      }
    }
  }
}

/**
 * 检查两个用户之间是否存在好友关系
 */
export async function checkFriendship(
  ctx: QueryCtx | MutationCtx,
  userId1: string,
  userId2: string
): Promise<Doc<"friendships"> | null> {
  // 确保按字典序排列用户ID
  const [user1Id, user2Id] = [userId1, userId2].sort();
  
  const friendship = await ctx.db
    .query("friendships")
    .withIndex("by_users", (q) => 
      q.eq("user1Id", user1Id).eq("user2Id", user2Id)
    )
    .first();
  
  return friendship;
}

/**
 * 获取用户资料信息
 */
export async function getUserProfile(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<Doc<"userProfiles">> {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  
  if (!profile) {
    // 如果没有找到用户资料，返回默认信息
    return {
      _id: "" as Id<"userProfiles">,
      _creationTime: Date.now(),
      userId,
      displayName: "Unknown User",
      avatar: undefined,
      bio: undefined,
      statusMessage: undefined,
      presence: "offline",
      lastSeenAt: undefined,
      updatedAt: Date.now(),
      email: undefined,
    };
  }
  
  return profile;
}

/**
 * 获取会话的未读消息数量
 */
export async function getUnreadCount(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  userId: string
): Promise<number> {
  // 获取用户在会话中的参与信息
  const participation = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_conversation_user", (q) => 
      q.eq("conversationId", conversationId).eq("userId", userId)
    )
    .first();
  
  if (!participation || participation.leftAt) {
    return 0;
  }
  
  // 获取用户最后阅读时间后的消息
  const lastReadAt = participation.lastReadAt || participation.joinedAt;
  
  const unreadMessages = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) => 
      q.eq("conversationId", conversationId)
    )
    .filter((q) => 
      q.and(
        q.gt(q.field("createdAt"), lastReadAt),
        q.neq(q.field("senderId"), userId), // 不包括自己发送的消息
        q.eq(q.field("deleted"), undefined) // 不包括已删除的消息
      )
    )
    .collect();
  
  // 对于群组聊天，检查具体的阅读状态
  const conversation = await ctx.db.get(conversationId);
  if (conversation?.type === "group") {
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
    
    return unreadCount;
  }
  
  // 对于直接聊天，返回消息数量
  return unreadMessages.length;
}

/**
 * 查找现有的直接聊天会话
 */
export async function findExistingDirectConversation(
  ctx: QueryCtx,
  participants: string[]
): Promise<Doc<"conversations"> | null> {
  if (participants.length !== 2) {
    return null;
  }
  
  const [userId1, userId2] = participants.sort();
  
  // 查找包含这两个用户的直接会话
  const conversations = await ctx.db
    .query("conversations")
    .filter((q) => q.eq(q.field("type"), "direct"))
    .collect();
  
  for (const conversation of conversations) {
    const participants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation", (q) => 
        q.eq("conversationId", conversation._id)
      )
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .collect();
    
    const participantIds = participants.map(p => p.userId).sort();
    
    if (participantIds.length === 2 && 
        participantIds[0] === userId1 && 
        participantIds[1] === userId2) {
      return conversation;
    }
  }
  
  return null;
}

/**
 * 获取用户的好友列表
 */
export async function getUserFriends(
  ctx: QueryCtx,
  userId: string
): Promise<Doc<"userProfiles">[]> {
  // 查找用户作为user1Id的好友关系
  const friendships1 = await ctx.db
    .query("friendships")
    .withIndex("by_user1", (q) => q.eq("user1Id", userId))
    .collect();
  
  // 查找用户作为user2Id的好友关系
  const friendships2 = await ctx.db
    .query("friendships")
    .withIndex("by_user2", (q) => q.eq("user2Id", userId))
    .collect();
  
  // 收集所有好友的用户ID
  const friendIds = [
    ...friendships1.map(f => f.user2Id),
    ...friendships2.map(f => f.user1Id)
  ];
  
  // 获取好友的用户资料
  const friends = await Promise.all(
    friendIds.map(friendId => getUserProfile(ctx, friendId))
  );
  
  return friends.filter(Boolean);
}

/**
 * 检查用户是否在线
 */
export async function isUserOnline(
  ctx: QueryCtx,
  userId: string
): Promise<boolean> {
  const profile = await getUserProfile(ctx, userId);
  
  if (!profile.presence || !profile.lastSeenAt) {
    return false;
  }
  
  // 如果状态是在线且最后在线时间在5分钟内，认为用户在线
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return profile.presence === "online" && profile.lastSeenAt > fiveMinutesAgo;
}

/**
 * 更新用户在线状态
 */
export async function updateUserPresence(
  ctx: MutationCtx,
  userId: string,
  presence: "online" | "away" | "offline"
): Promise<void> {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  
  if (profile) {
    await ctx.db.patch(profile._id, {
      presence,
      lastSeenAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

/**
 * 获取会话的参与者列表
 */
export async function getConversationParticipants(
  ctx: QueryCtx,
  conversationId: Id<"conversations">
): Promise<Array<Doc<"userProfiles"> & { role: string; joinedAt: number }>> {
  const participants = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_conversation", (q) => 
      q.eq("conversationId", conversationId)
    )
    .filter((q) => q.eq(q.field("leftAt"), undefined))
    .collect();
  
  const participantProfiles = await Promise.all(
    participants.map(async (p) => {
      const profile = await getUserProfile(ctx, p.userId);
      return {
        ...profile,
        role: p.role,
        joinedAt: p.joinedAt,
      };
    })
  );
  
  return participantProfiles;
}

/**
 * 检查用户在会话中的权限级别
 */
export async function getUserPermissionLevel(
  ctx: QueryCtx,
  userId: string,
  conversationId: Id<"conversations">
): Promise<"owner" | "admin" | "member" | null> {
  const participation = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_conversation_user", (q) => 
      q.eq("conversationId", conversationId).eq("userId", userId)
    )
    .first();
  
  if (!participation || participation.leftAt) {
    return null;
  }
  
  return participation.role;
}

/**
 * 生成会话显示名称
 */
export async function getConversationDisplayName(
  ctx: QueryCtx,
  conversation: Doc<"conversations">,
  currentUserId: string
): Promise<string> {
  if (conversation.type === "group") {
    return conversation.name || "Group Chat";
  }
  
  // 对于直接聊天，返回对方的显示名称
  const participants = await getConversationParticipants(ctx, conversation._id);
  const otherParticipant = participants.find(p => p.userId !== currentUserId);
  
  return otherParticipant?.displayName || "Direct Chat";
}

/**
 * 批量获取用户资料
 */
export async function getUserProfiles(
  ctx: QueryCtx,
  userIds: string[]
): Promise<Record<string, Doc<"userProfiles">>> {
  const profiles = await Promise.all(
    userIds.map(userId => getUserProfile(ctx, userId))
  );
  
  const profileMap: Record<string, Doc<"userProfiles">> = {};
  profiles.forEach(profile => {
    profileMap[profile.userId] = profile;
  });
  
  return profileMap;
}