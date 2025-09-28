import { TabBarIcon } from "@/components/tabbar-icon";
import { Icon } from "@/components/ui/icon";
import { IconWithBadge } from "@/components/icon-with-badge";
import { useColorScheme } from "@/lib/use-color-scheme";
import { Tabs } from "expo-router";
import { MessageCircleIcon, UserRound, UsersRoundIcon } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@chat-app/backend/convex/_generated/api";
import { useNotification } from "@/contexts/NotificationContext";

export default function TabLayout() {
	const { isDarkColorScheme } = useColorScheme();
	const { hasViewedContacts } = useNotification();

	// 获取当前用户信息
	const { data: currentUser } = useQuery(
		convexQuery(api.auth.getCurrentUser, {})
	);
	const userId = currentUser?._id;

	// 获取收到的好友请求数量
	const { data: friendRequests } = useQuery(
		convexQuery(api.v1.users.getReceivedFriendRequests, userId ? { userId } : "skip")
	);

	const friendRequestCount = friendRequests?.length || 0;
	// 只有在用户还没有查看过联系人页面且有好友请求时才显示badge
	const showBadge = !hasViewedContacts && friendRequestCount > 0;

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: isDarkColorScheme
					? "hsl(217.2 91.2% 59.8%)"
					: "hsl(221.2 83.2% 53.3%)",
				tabBarInactiveTintColor: isDarkColorScheme
					? "hsl(215 20.2% 65.1%)"
					: "hsl(215.4 16.3% 46.9%)",
				tabBarStyle: {
					backgroundColor: isDarkColorScheme
						? "hsl(222.2 84% 4.9%)"
						: "hsl(0 0% 100%)",
					borderTopColor: isDarkColorScheme
						? "hsl(217.2 32.6% 17.5%)"
						: "hsl(214.3 31.8% 91.4%)",
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "聊天",
					tabBarIcon: ({ color }) => <Icon as={MessageCircleIcon} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="contacts"
				options={{
					title: "通讯录",
					tabBarIcon: ({ color }) => (
						<IconWithBadge
							as={UsersRoundIcon}
							color={color}
							badgeCount={showBadge ? friendRequestCount : 0}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="mine"
				options={{
					title: "我的",
					tabBarIcon: ({ color }) => (
						<Icon as={UserRound} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
