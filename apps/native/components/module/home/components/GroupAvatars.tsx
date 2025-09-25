import React from "react";
import { View, Text } from "react-native";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { GroupAvatarsProps } from "../types";

/**
 * 群组头像组件 - 显示重叠的多个头像
 */
export const GroupAvatars: React.FC<GroupAvatarsProps> = ({ avatars, groupName }) => {
	// 最多显示3个头像
	const displayAvatars = avatars.slice(0, 3);

	const getAvatarStyle = (index: number): string => {
		switch (index) {
			case 0:
				return "absolute top-0 left-0 w-7 h-7 z-30";
			case 1:
				return "absolute top-0 right-0 w-7 h-7 z-20";
			case 2:
				return "absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-7 z-10";
			default:
				return "w-7 h-7";
		}
	};

	return (
		<View className="w-12 h-12 relative">
			{displayAvatars.map((avatar, index) => (
				<Avatar alt={groupName} key={index} className={getAvatarStyle(index)}>
					<AvatarImage source={{ uri: avatar }} />
					<AvatarFallback className="bg-muted">
						<Text className="text-xs text-foreground font-medium">
							{groupName.charAt(index).toUpperCase()}
						</Text>
					</AvatarFallback>
				</Avatar>
			))}
		</View>
	);
};