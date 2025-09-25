import React, { useCallback } from "react";
import { View, Text } from "react-native";
import { LegendList, LegendListRenderItemProps } from "@legendapp/list";
import { Container } from "@/components/container";
import { ChatEmptyState } from "@/components/module/home/components/empty-state";
import { ChatHeader } from "./components/ChatHeader";
import { ChatListItem } from "./components/ChatListItem";
import { useChatData } from "./hooks/useChatData";
import type { ChatItem } from "./types";

/**
 * 聊天列表主屏幕
 */
export const ChatListScreen: React.FC = () => {
	const { userId, chatData, isLoading } = useChatData();

	// 聊天项点击处理
	const handleChatPress = useCallback((item: ChatItem) => {
		console.log("点击聊天:", item.name);
		// TODO: 导航到聊天详情页面
	}, []);

	// 渲染聊天列表项
	const renderChatItem = useCallback(({ item }: LegendListRenderItemProps<ChatItem>) => {
		return <ChatListItem item={item} onPress={handleChatPress} />;
	}, [handleChatPress]);

	return (
		<Container>
			{/* 页面标题 */}
			<ChatHeader />

			{/* 聊天记录列表 */}
			{!userId ? (
				// 未登录状态
				<View className="flex-1 justify-center items-center">
					<Text className="text-muted-foreground">请先登录</Text>
				</View>
			) : isLoading ? (
				// Loading状态
				<View className="flex-1 justify-center items-center">
					<Text className="text-muted-foreground">加载中...</Text>
				</View>
			) : chatData.length === 0 ? (
				// 空状态
				<ChatEmptyState />
			) : (
				// 有数据时显示列表
				<LegendList
					data={chatData}
					renderItem={renderChatItem}
					keyExtractor={(item) => item.id}
					recycleItems={true}
					maintainVisibleContentPosition
					className="flex-1"
				/>
			)}
		</Container>
	);
};