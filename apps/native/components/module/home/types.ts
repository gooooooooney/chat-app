// 聊天记录数据结构类型定义
export interface ChatItem {
	id: string;
	name: string;
	lastMessage: string;
	timestamp: string;
	avatar: string;
	isGroup: boolean;
	unreadCount?: number;
	isOnline?: boolean;
	groupAvatars?: string[]; // 群组成员头像列表
}

// 群组头像组件属性
export interface GroupAvatarsProps {
	avatars: string[];
	groupName: string;
}

// 聊天列表项组件属性
export interface ChatListItemProps {
	item: ChatItem;
	onPress: (item: ChatItem) => void;
}