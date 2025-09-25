import { Container } from "@/components/container";
import { Text, View, TouchableOpacity } from "react-native";
import { LegendList, LegendListRenderItemProps } from "@legendapp/list";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCallback } from "react";
import { api } from "@chat-app/backend/convex/_generated/api";

// 聊天记录数据结构类型定义
interface ChatItem {
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

// 静态聊天记录数据
const mockChatData: ChatItem[] = [
	{
		id: "1",
		name: "张三",
		lastMessage: "好的，明天见！",
		timestamp: "14:32",
		avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		isGroup: false,
		unreadCount: 2,
		isOnline: true,
	},
	{
		id: "2",
		name: "产品团队",
		lastMessage: "李四: 新功能已经上线了",
		timestamp: "13:45",
		avatar: "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		isGroup: true,
		unreadCount: 5,
		groupAvatars: [
			"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
			"https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
			"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		],
	},
	{
		id: "3",
		name: "王小美",
		lastMessage: "收到！谢谢～",
		timestamp: "12:20",
		avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		isGroup: false,
		isOnline: false,
	},
	{
		id: "4",
		name: "技术讨论组",
		lastMessage: "赵六: 这个问题我来处理",
		timestamp: "11:30",
		avatar: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		isGroup: true,
		groupAvatars: [
			"https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
			"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
			"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		],
	},
	{
		id: "5",
		name: "陈总",
		lastMessage: "会议资料我发给你了",
		timestamp: "昨天",
		avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		isGroup: false,
	},
	{
		id: "6",
		name: "家人群",
		lastMessage: "妈妈: 今晚回来吃饭吗？",
		timestamp: "昨天",
		avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		isGroup: true,
		unreadCount: 1,
		groupAvatars: [
			"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
			"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		],
	},
	{
		id: "7",
		name: "小李",
		lastMessage: "好的，了解了",
		timestamp: "周五",
		avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
		isGroup: false,
	},
];

export default function ChatListScreen() {
	// 群组头像组件 - 显示重叠的多个头像
	const GroupAvatars = ({ avatars, groupName }: { avatars: string[]; groupName: string }) => {
		// 最多显示3个头像
		const displayAvatars = avatars.slice(0, 3);

		return (
			<View className="w-12 h-12 relative">
				{displayAvatars.map((avatar, index) => {
					// 计算每个头像的位置偏移
					const getAvatarStyle = (index: number) => {
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
						<Avatar alt={groupName} key={index} className={getAvatarStyle(index)}>
							<AvatarImage source={{ uri: avatar }} />
							<AvatarFallback className="bg-muted">
								<Text className="text-xs text-foreground font-medium">
									{groupName.charAt(index).toUpperCase()}
								</Text>
							</AvatarFallback>
						</Avatar>
					);
				})}
			</View>
		);
	};

	// 聊天列表项组件 - 使用 useCallback 避免 Hook 规则错误
	const renderChatItem = useCallback(({ item }: LegendListRenderItemProps<ChatItem>) => {
		const handlePress = () => {
			console.log("点击聊天:", item.name);
			// TODO: 导航到聊天详情页面
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
						{item.unreadCount && item.unreadCount > 0 && (
							<View className="ml-2 min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center px-1.5">
								<Text className="text-xs text-white font-medium">
									{item.unreadCount > 99 ? "99+" : item.unreadCount}
								</Text>
							</View>
						)}
					</View>
				</View>
			</TouchableOpacity>
		);
	}, []);
	return (
		<Container>
			{/* 页面标题 */}
			<View className="px-4 pt-2 pb-3 bg-background border-b border-border/20">
				<Text className="text-2xl font-bold text-foreground">
					将聊
				</Text>
			</View>

			{/* 聊天记录列表 */}
			<LegendList
				data={mockChatData}
				renderItem={renderChatItem}
				keyExtractor={(item) => item.id}
				recycleItems={true}
				maintainVisibleContentPosition
				className="flex-1"
			/>
		</Container>
	);
}
