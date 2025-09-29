// 聊天应用的 TypeScript 类型定义
// 这些类型可以在前端中使用，与 schema 保持同步

import { WithoutSystemFields } from "convex/server";
import { Doc } from "./_generated/dataModel";
import { PresenceStatus, ConversationType, ParticipantRole, MessageType, AttachmentType, UploadStatus, FriendRequestStatus } from "./schema";
import { Infer } from "convex/values";

// 导出 literal 类型用于类型检查
export type PresenceStatus = Infer<typeof PresenceStatus>;

export type ConversationType = Infer<typeof ConversationType>;

export type ParticipantRole = Infer<typeof ParticipantRole>;

export type MessageType = Infer<typeof MessageType>;

export type AttachmentType = Infer<typeof AttachmentType>;

export type UploadStatus = Infer<typeof UploadStatus>;

export type FriendRequestStatus = Infer<typeof FriendRequestStatus>;

// 用户资料接口
export type UserProfileWithId = Doc<"userProfiles">

export type UserProfile = WithoutSystemFields<UserProfileWithId>

// 会话接口
export type ConversationWithId = Doc<"conversations">;
export type Conversation = WithoutSystemFields<ConversationWithId>;

// 参与者接口
export type ConversationParticipantWithId = Doc<"conversationParticipants">;
export type ConversationParticipant = WithoutSystemFields<ConversationParticipantWithId>;

// 消息接口
export type MessageWithId = Doc<"messages">;
export type Message = WithoutSystemFields<MessageWithId>;

// 附件接口
export type MessageAttachmentWithId = Doc<"messageAttachments">;
export type MessageAttachment = WithoutSystemFields<MessageAttachmentWithId>;

// 阅读状态接口
export type MessageReadStatusWithId = Doc<"messageReadStatus">;
export type MessageReadStatus = WithoutSystemFields<MessageReadStatusWithId>;

// 扩展的会话接口（包含参与者信息）
export interface ConversationWithParticipant {
  conversation: ConversationWithId;
  participant: ConversationParticipantWithId;
}

// 扩展的消息接口（包含附件信息）
export interface MessageWithAttachments {
  message: MessageWithId;
  attachments: MessageAttachmentWithId[];
}

// 好友关系接口
export type FriendshipWithId = Doc<"friendships">;
export type Friendship = WithoutSystemFields<FriendshipWithId>;

// 好友请求接口
export type FriendRequestWithId = Doc<"friendRequests">;
export type FriendRequest = WithoutSystemFields<FriendRequestWithId>;

// 扩展的会话接口（包含参与者和最后消息信息）
export interface ConversationDetail {
  conversation: ConversationWithId;
  participant: ConversationParticipantWithId;
  lastMessage?: MessageWithId;
  unreadCount: number;
  otherParticipants: ConversationParticipantWithId[];
}

// 带有发送者信息的好友请求
export interface FriendRequestWithSender {
  _id: string;
  _creationTime: number;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  message?: string;
  updatedAt?: number;
  sender: UserProfileWithId | null;
}