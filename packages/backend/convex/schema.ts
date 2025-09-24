import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// 用户在线状态类型
export const PresenceStatus = v.union(
  v.literal("online"),
  v.literal("away"), 
  v.literal("offline")
);

// 会话类型
export const ConversationType = v.union(
  v.literal("direct"), 
  v.literal("group")
);

// 用户在会话中的角色
export const ParticipantRole = v.union(
  v.literal("owner"),   // 群主
  v.literal("admin"),   // 管理员
  v.literal("member")   // 普通成员
);

// 消息类型
export const MessageType = v.union(
  v.literal("text"),        // 纯文本消息
  v.literal("image"),       // 图片消息
  v.literal("file"),        // 文件消息
  v.literal("system")       // 系统消息（如用户加入/离开）
);

// 附件类型
export const AttachmentType = v.union(
  v.literal("image"),
  v.literal("file"),
  v.literal("audio"),
  v.literal("video")
);

// 上传状态
export const UploadStatus = v.union(
  v.literal("uploading"),
  v.literal("completed"), 
  v.literal("failed")
);

// 好友请求状态
export const FriendRequestStatus = v.union(
  v.literal("pending"),     // 待处理
  v.literal("accepted"),    // 已接受
  v.literal("rejected"),    // 已拒绝
  v.literal("cancelled")    // 已取消
);

export default defineSchema({
  // 用户扩展信息表 - 补充 better-auth 基础用户信息
  userProfiles: defineTable({
    // better-auth 的用户ID
    userId: v.string(), 
    // 自定义用户ID（唯一，只能是英文，用于添加好友）
    customId: v.optional(v.string()),
    // 显示名称
    displayName: v.optional(v.string()),
    // 头像URL（预留接口，可连接文件存储）
    avatar: v.optional(v.string()),
    // 个人简介
    bio: v.optional(v.string()),
    // 状态消息
    statusMessage: v.optional(v.string()),
    // 在线状态
    presence: v.optional(PresenceStatus),
    // 最后在线时间
    lastSeenAt: v.optional(v.number()),
    // 创建时间
    createdAt: v.number(),
    // 更新时间
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_customId", ["customId"]),

  // 会话表 - 支持1v1和群组聊天
  conversations: defineTable({
    // 会话类型：direct(1v1) 或 group(群组)
    type: ConversationType,
    // 会话名称（群组聊天使用，1v1可为空）
    name: v.optional(v.string()),
    // 会话描述（群组聊天使用）
    description: v.optional(v.string()),
    // 会话头像（群组聊天使用，预留图片接口）
    avatar: v.optional(v.string()),
    // 创建者ID
    createdBy: v.string(),
    // 是否已归档
    archived: v.optional(v.boolean()),
    // 最后消息时间（用于排序）
    lastMessageAt: v.optional(v.number()),
    // 最后消息内容预览
    lastMessagePreview: v.optional(v.string()),
    // 创建时间
    createdAt: v.number(),
    // 更新时间
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_lastMessageAt", ["lastMessageAt"])
    .index("by_createdBy", ["createdBy"]),

  // 会话参与者表 - 管理用户在会话中的关系
  conversationParticipants: defineTable({
    // 会话ID
    conversationId: v.id("conversations"),
    // 参与者用户ID
    userId: v.string(),
    // 用户在会话中的角色
    role: ParticipantRole,
    // 加入时间
    joinedAt: v.number(),
    // 最后阅读的消息ID（用于计算未读消息数）
    lastReadMessageId: v.optional(v.id("messages")),
    // 最后阅读时间
    lastReadAt: v.optional(v.number()),
    // 离开时间（可选，表示用户离开群组）
    leftAt: v.optional(v.number()),
    // 是否静音
    muted: v.optional(v.boolean()),
    // 是否置顶
    pinned: v.optional(v.boolean()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_user_active", ["userId", "leftAt"]), // 查询用户的活跃会话

  // 消息表 - 存储所有聊天消息
  messages: defineTable({
    // 所属会话ID
    conversationId: v.id("conversations"),
    // 发送者ID
    senderId: v.string(),
    // 消息内容
    content: v.string(),
    // 消息类型
    type: MessageType,
    // 回复的消息ID（可选）
    replyToId: v.optional(v.id("messages")),
    // 转发的原消息ID（可选）
    forwardedFromId: v.optional(v.id("messages")),
    // 是否已编辑
    edited: v.optional(v.boolean()),
    // 编辑时间
    editedAt: v.optional(v.number()),
    // 是否已删除
    deleted: v.optional(v.boolean()),
    // 删除时间
    deletedAt: v.optional(v.number()),
    // 创建时间
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_sender", ["senderId", "createdAt"])
    .index("by_conversation_type", ["conversationId", "type"])
    .index("by_replyTo", ["replyToId"]),

  // 消息附件表 - 存储消息的附件信息
  messageAttachments: defineTable({
    // 所属消息ID
    messageId: v.id("messages"),
    // 附件类型
    type: AttachmentType,
    // 原始文件名
    filename: v.string(),
    // MIME类型
    mimeType: v.string(),
    // 文件大小（字节）
    size: v.number(),
    // 存储ID（Convex File Storage ID或其他云存储标识）
    storageId: v.optional(v.string()),
    // 访问URL（可选，可能由storageId动态生成）
    url: v.optional(v.string()),
    // 缩略图URL（图片/视频使用）
    thumbnailUrl: v.optional(v.string()),
    // 图片/视频尺寸
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    // 音频/视频时长（秒）
    duration: v.optional(v.number()),
    // 上传状态
    uploadStatus: v.optional(UploadStatus),
    // 创建时间
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_type", ["type"])
    .index("by_uploadStatus", ["uploadStatus"]),

  // 消息阅读状态表 - 跟踪群组消息的详细阅读状态
  messageReadStatus: defineTable({
    // 消息ID
    messageId: v.id("messages"),
    // 阅读者用户ID  
    userId: v.string(),
    // 阅读时间
    readAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_user", ["userId"])
    .index("by_message_user", ["messageId", "userId"]),

  // 好友关系表
  // 设计说明：好友关系是双向的，但我们只存储一条记录避免重复
  // 通过将两个用户ID按字母顺序排列，确保 A-B 和 B-A 的关系只存储为一条记录
  friendships: defineTable({
    // 用户1 ID（字典序较小的用户ID）
    // 例如：如果用户ID是 "alice" 和 "bob"，则 user1Id = "alice"
    // 这样可以避免存储重复的好友关系记录
    user1Id: v.string(),
    
    // 用户2 ID（字典序较大的用户ID）  
    // 例如：如果用户ID是 "alice" 和 "bob"，则 user2Id = "bob"
    // 无论是alice添加bob还是bob添加alice，最终都存储为同一条记录
    user2Id: v.string(),
    
    // 成为好友的时间
    createdAt: v.number(),
  })
    // 按user1Id查询：快速找到某个用户作为"较小ID"的所有好友关系
    .index("by_user1", ["user1Id"])
    // 按user2Id查询：快速找到某个用户作为"较大ID"的所有好友关系  
    .index("by_user2", ["user2Id"])
    // 复合索引：检查两个特定用户之间是否已存在好友关系，防止重复
    .index("by_users", ["user1Id", "user2Id"]),

  // 好友请求表
  friendRequests: defineTable({
    // 发送者ID
    fromUserId: v.string(),
    // 接收者ID
    toUserId: v.string(),
    // 请求状态
    status: FriendRequestStatus,
    // 请求消息
    message: v.optional(v.string()),
    // 创建时间
    createdAt: v.number(),
    // 更新时间（接受/拒绝时）
    updatedAt: v.optional(v.number()),
  })
    .index("by_fromUser", ["fromUserId"])
    .index("by_toUser", ["toUserId"])
    .index("by_users", ["fromUserId", "toUserId"])
    .index("by_toUser_status", ["toUserId", "status"]),

  // 保留原有的 todos 表（如需要）
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
});