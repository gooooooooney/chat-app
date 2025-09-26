import { TabBarIcon } from "@/components/tabbar-icon";
import { Icon } from "@/components/ui/icon";
import { useColorScheme } from "@/lib/use-color-scheme";
import { Tabs } from "expo-router";
import { MessageCircleIcon, UserRound, UsersRoundIcon } from "lucide-react-native";

export default function TabLayout() {
	const { isDarkColorScheme } = useColorScheme();

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
						<Icon as={UsersRoundIcon} color={color} />
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
