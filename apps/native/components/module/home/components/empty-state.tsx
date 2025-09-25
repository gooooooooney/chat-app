import React from "react";
import { View, Text } from "react-native";
import { MessageCircle } from "lucide-react-native";

interface EmptyStateProps {
	icon?: React.ComponentType<any>;
	title?: string;
	description?: string;
	iconSize?: number;
	iconColor?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
	icon: Icon = MessageCircle,
	title = "暂无聊天记录",
	description = "开始你的第一次对话吧",
	iconSize = 64,
	iconColor = "#9CA3AF", // text-gray-400
}) => {
	return (
		<View className="flex-1 justify-center items-center px-8">
			{/* 图标 */}
			<View className="mb-6">
				<Icon size={iconSize} color={iconColor} strokeWidth={1.5} />
			</View>

			{/* 标题 */}
			<Text className="text-xl font-semibold text-foreground mb-2 text-center">
				{title}
			</Text>

			{/* 描述 */}
			<Text className="text-base text-muted-foreground text-center leading-6">
				{description}
			</Text>
		</View>
	);
};

// 专门的聊天空状态组件
export const ChatEmptyState: React.FC = () => {
	return (
		<EmptyState
			icon={MessageCircle}
			title="还没有聊天记录"
			description="添加好友开始聊天，或者创建群组与更多人交流吧"
			iconSize={80}
			iconColor="#6B7280"
		/>
	);
};