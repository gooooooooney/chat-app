/**
 * Chat API v1 - Export all chat-related functions
 * 
 * This file exports all the chat system APIs for easy import in the frontend.
 * Phase 1 implementation includes:
 * - Conversation management
 * - Message handling  
 * - Real-time subscriptions
 * - User management (existing)
 * - Testing utilities
 */

// Conversation Management APIs
export {
  getUserConversations,
  getConversationById,
  createConversation,
  addParticipants,
  leaveConversation,
  updateConversationSettings,
} from "./conversations";

// Message Management APIs
export {
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  getMessageStats,
  searchMessages,
} from "./messages";

// Real-time Subscription APIs
export {
  subscribeToConversationMessages,
  subscribeToUserConversations,
  subscribeToMessageReadStatus,
  subscribeToUserPresence,
  subscribeToConversationParticipants,
  getConnectionStatus,
  subscribeToFriendRequests,
} from "./subscriptions";

// User Management APIs (existing)
export {
  findUserByEmail,
  sendFriendRequest,
  getReceivedFriendRequests,
  respondToFriendRequest,
  getFriendsList,
  removeFriend,
  checkFriendshipStatus,
  getFriendDetail,
} from "./users";

// Testing APIs (development only)
export {
  testChatFlow,
  getTestStats,
  cleanupTestData,
  createTestUsers,
} from "./test";

// Utility functions and types
export * from "./helpers/utils";
export * from "./types/errors";

/**
 * API Usage Examples:
 * 
 * // Frontend usage with Convex React hooks:
 * import { useQuery, useMutation } from "convex/react";
 * import { api } from "@/convex/_generated/api";
 * 
 * // Get user conversations
 * const conversations = useQuery(api.v1.getUserConversations, { 
 *   userId: currentUserId 
 * });
 * 
 * // Send a message
 * const sendMessage = useMutation(api.v1.sendMessage);
 * await sendMessage({
 *   conversationId,
 *   senderId: currentUserId,
 *   content: "Hello!",
 *   type: "text"
 * });
 * 
 * // Subscribe to new messages
 * const newMessages = useQuery(api.v1.subscribeToConversationMessages, {
 *   conversationId,
 *   userId: currentUserId,
 *   since: lastMessageTimestamp
 * });
 */

/**
 * Phase 1 Implementation Status:
 * 
 * ✅ Core Features Implemented:
 * - Conversation creation (direct & group)
 * - Message sending/receiving
 * - Real-time message subscriptions
 * - Message read status tracking
 * - User permission validation
 * - Friend relationship verification
 * - Error handling with custom error types
 * - Testing utilities
 * 
 * 📋 Database Schema Support:
 * - conversations: ✅ Full support
 * - conversationParticipants: ✅ Full support  
 * - messages: ✅ Full support
 * - messageReadStatus: ✅ Full support
 * - userProfiles: ✅ Integrated with existing
 * - friendships: ✅ Integrated with existing
 * - friendRequests: ✅ Integrated with existing
 * 
 * 🔄 Real-time Features:
 * - New message notifications: ✅
 * - Conversation list updates: ✅
 * - Read status updates: ✅
 * - User presence updates: ✅
 * - Participant changes: ✅
 * 
 * 🔒 Security Features:
 * - Access control validation: ✅
 * - Friend relationship verification: ✅
 * - Message content validation: ✅
 * - Permission-based operations: ✅
 * - Error handling: ✅
 * 
 * 🧪 Testing & Development:
 * - End-to-end test flow: ✅
 * - Test data creation: ✅
 * - Statistics and monitoring: ✅
 * - Cleanup utilities: ✅
 */