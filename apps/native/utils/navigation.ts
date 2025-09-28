import { router } from 'expo-router';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';

/**
 * 导航到聊天页面
 */
export function navigateToChat(conversationId: Id<"conversations"> | string) {
  router.push(`/(app)/(authenticated)/(pages)/chat/${conversationId}`);
}

/**
 * 导航到好友详情页面
 */
export function navigateToFriendDetail(friendUserId: string) {
  router.push(`/(app)/(authenticated)/(pages)/friend-detail?userId=${friendUserId}`);
}

/**
 * 导航到添加好友页面
 */
export function navigateToAddFriend() {
  router.push('/(app)/(authenticated)/(pages)/add-friend');
}

/**
 * 返回上一页
 */
export function navigateBack() {
  router.back();
}

/**
 * 返回首页
 */
export function navigateToHome() {
  router.push('/(app)/(authenticated)/(tabs)/');
}