import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@chat-app/backend/convex/_generated/api";
import { formatTime } from "../utils/formatTime";
import type { ChatItem } from "../types";

/**
 * 聊天数据获取和转换Hook
 */
export const useChatData = () => {
	// 获取当前用户信息
	const currentUser = useQuery(api.auth.getCurrentUser);
	const userId = currentUser?._id;

	// 获取用户会话列表  
	const conversations = useQuery(
		api.v1.chat.getUserConversations,
		userId ? { userId } : "skip"
	);

	// 将Convex数据转换为ChatItem格式
	const chatData = useMemo(() => {
		if (!conversations || !userId) return [];

		return conversations.map((convWithParticipant) => {
			const { conversation, participant } = convWithParticipant;

			// 计算显示名称和头像
			let name = "未知聊天";
			let avatar = "";
			let isGroup = conversation.type === "group";
			let groupAvatars: string[] = [];

			if (isGroup) {
				// 群组聊天
				name = conversation.name || "群聊";
				avatar = conversation.avatar || "";
				// TODO: 获取群组成员头像
				groupAvatars = []; // 暂时为空，后续实现
			} else {
				// 1v1聊天 - 需要获取对方的信息
				// TODO: 获取对方用户的资料信息
				name = "私聊"; // 临时名称
			}

			// 计算时间显示
			const lastMessageTime = conversation.lastMessageAt || conversation.createdAt;
			const timestamp = formatTime(lastMessageTime);

			return {
				id: conversation._id,
				name,
				lastMessage: conversation.lastMessagePreview || "暂无消息",
				timestamp,
				avatar,
				isGroup,
				groupAvatars,
				unreadCount: 0, // TODO: 计算未读消息数量
				isOnline: false, // TODO: 获取在线状态
			} as ChatItem;
		});
	}, [conversations, userId]);

	return {
		userId,
		chatData,
		isLoading: !conversations && userId,
	};
};