import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Plus, UserPlus } from "lucide-react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 聊天页面标题组件
 */
export const ChatHeader: React.FC = () => {
	// 处理添加好友点击事件
	const handleAddFriend = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		router.push("/(app)/(authenticated)/(pages)/add-friend");
	};

	return (
		<View className="px-4 pt-2 pb-3 bg-background border-b border-border/20">
			{/* 标题栏 */}
			<View className="flex-row items-center justify-between">
				{/* 页面标题 */}
				<Text className="text-2xl font-bold text-foreground">
					微信
				</Text>

				{/* 右侧操作区域 */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<TouchableOpacity
							className="p-2 rounded-full active:bg-accent"
							activeOpacity={0.7}
						>
							<Plus
								size={24}
								color="#000000"
								className="text-foreground"
							/>
						</TouchableOpacity>
					</DropdownMenuTrigger>

					<DropdownMenuContent
						side="bottom"
						align="end"
						className="w-48"
					>
						<DropdownMenuItem onPress={handleAddFriend}>
							<View className="flex-row items-center gap-3">
								<UserPlus
									size={18}
									color="#666666"
									className="text-muted-foreground"
								/>
								<Text className="text-base text-foreground">
									添加好友
								</Text>
							</View>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</View>
		</View>
	);
};