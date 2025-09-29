import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { GroupAvatars } from "./GroupAvatars";
import type { ChatListItemProps } from "../types";

/**
 * 聊天列表项组件
 */
export const ChatListItem: React.FC<ChatListItemProps> = ({ item, onPress }) => {
	const handlePress = () => {
		onPress(item);
	};

	// 获取用户名称的首字母作为备用头像
	const getInitials = (name: string) => {
		return name.charAt(0).toUpperCase();
	};

	return (
		<TouchableOpacity
			onPress={handlePress}
			className="flex-row items-center px-4 py-3 bg-background border-b border-border/40"
			activeOpacity={0.7}
		>
			{/* 头像 */}
			<View className="relative">
				{item.isGroup && item.groupAvatars ? (
					// 群组多头像显示
					<GroupAvatars avatars={item.groupAvatars} groupName={item.name} />
				) : (
					// 单个用户头像显示
					<>
						<Avatar alt={item.name} className="w-12 h-12">
							<AvatarImage source={{ uri: item.avatar }} />
							<AvatarFallback className="bg-muted">
								<Text className="text-foreground font-medium">
									{getInitials(item.name)}
								</Text>
							</AvatarFallback>
						</Avatar>
						{/* 在线状态指示器 - 只对个人聊天显示 */}
						{item.isOnline && (
							<View className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
						)}
					</>
				)}
			</View>

			{/* 聊天内容区域 */}
			<View className="flex-1 ml-3">
				{/* 顶部行：名称和时间 */}
				<View className="flex-row justify-between items-center mb-1">
					<Text
						className="text-base font-medium text-foreground"
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{item.name}
					</Text>
					<Text className="text-sm text-muted-foreground">
						{item.timestamp}
					</Text>
				</View>

				{/* 底部行：最后消息和未读数量 */}
				<View className="flex-row justify-between items-center">
					<Text
						className="flex-1 text-sm text-muted-foreground"
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{item.lastMessage}
					</Text>

					{/* 未读消息数量徽章 */}
					{!!item.unreadCount && item.unreadCount > 0 && (
						<View className="ml-2 min-w-[20px] h-5 bg-red-500 rounded-full items-center justify-center px-1.5">
							<Text className="text-xs text-white font-medium">
								{item.unreadCount > 99 ? "99+" : item.unreadCount}
							</Text>
						</View>
					)}
				</View>
			</View>
		</TouchableOpacity>
	);
};