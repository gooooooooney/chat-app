import { Container } from "@/components/container";
import { Icon } from "@/components/ui/icon";
import { Tabs } from "expo-router";
import { UsersRoundIcon } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";

export default function TabTwo() {
	return (
		<>
			<Tabs.Screen
				name="contacts"
				options={{
					title: "通讯录",
					tabBarIcon: ({ color }) => (
						<Icon as={UsersRoundIcon} color={color} />
					),
				}}
			/>
			<Container>
				<ScrollView className="flex-1 p-6">
					<View className="py-8">
						<Text className="text-3xl font-bold text-foreground mb-2">
							Tab Two
						</Text>
						<Text className="text-lg text-muted-foreground">
							Discover more features and content
						</Text>
					</View>
				</ScrollView>
			</Container>
		</>
	);
}
