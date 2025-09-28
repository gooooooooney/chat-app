import React, { useCallback, useMemo } from "react";
import { Container } from "@/components/container";
import { Icon } from "@/components/ui/icon";
import { Tabs, useFocusEffect } from "expo-router";
import { UsersRoundIcon, UserPlusIcon } from "lucide-react-native";
import { ScrollView, Text, View, ActivityIndicator, Pressable, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@chat-app/backend/convex/_generated/api";
import { LegendList, LegendListRenderItemProps } from "@legendapp/list";
import { NAV_THEME } from "@/lib/theme";
import { useNotification } from "@/contexts/NotificationContext";
import { Id } from "@chat-app/backend/convex/_generated/dataModel";

export default function ContactsScreen() {
	const queryClient = useQueryClient();
	const { markContactsAsViewed, resetContactsView } = useNotification();

	// 获取当前用户信息
	const { data: currentUser, isPending: isCurrentUserPending } = useQuery(
		convexQuery(api.auth.getCurrentUser, {})
	);
	const userId = currentUser?._id;

	// 获取收到的好友请求
	const { data: friendRequests, isPending: isFriendRequestsPending } = useQuery(
		convexQuery(api.v1.users.getReceivedFriendRequests, userId ? { userId } : "skip")
	);

	// 当页面获得焦点时，标记联系人页面为已查看
	useFocusEffect(
		useCallback(() => {
			markContactsAsViewed();
		}, [markContactsAsViewed])
	);

	// 获取好友列表
	const { data: friends, isPending: isFriendsPending } = useQuery(
		convexQuery(api.v1.users.getFriendsList, userId ? { userId } : "skip")
	);

	// 响应好友请求的mutation
	const respondToFriendRequestMutation = useMutation({
		mutationFn: useConvexMutation(api.v1.users.respondToFriendRequest),
		onSuccess: () => {
			// 刷新相关数据
			queryClient.invalidateQueries({ queryKey: ["convex", "api.v1.users.getReceivedFriendRequests"] });
			queryClient.invalidateQueries({ queryKey: ["convex", "api.v1.users.getFriendsList"] });
			// 如果还有其他好友请求，重置查看状态以便badge重新显示
			setTimeout(() => {
				if (friendRequests && friendRequests.length > 1) {
					resetContactsView();
				}
			}, 100);
		},
		onError: (error: any) => {
			Alert.alert("操作失败", error?.message || "请稍后重试");
		},
	});

	// 处理好友请求
	const handleFriendRequest = useCallback((requestId: Id<"friendRequests">, action: "accept" | "reject") => {
		if (!userId) return;

		respondToFriendRequestMutation.mutate({
			requestId,
			userId,
			action,
		});
	}, [userId, respondToFriendRequestMutation]);

	// 按字母排序的好友列表
	const sortedFriends = useMemo(() => {
		if (!friends) return [];
		return friends
			.filter(friend => friend?.displayName)
			.sort((a, b) => {
				const nameA = a?.displayName || '';
				const nameB = b?.displayName || '';
				return nameA.localeCompare(nameB, 'zh-CN');
			});
	}, [friends]);

	// 渲染好友请求项
	const renderFriendRequest = useCallback(({ item }: LegendListRenderItemProps<any>) => {
		return (
			<View className="flex-row items-center p-4 bg-card border-b border-border">
				<View className="w-12 h-12 bg-muted rounded-full items-center justify-center mr-3">
					<Icon as={UserPlusIcon} size={20} className="text-muted-foreground" />
				</View>
				<View className="flex-1">
					<Text className="text-foreground font-medium">
						{item.sender?.displayName || item.sender?.email || "未知用户"}
					</Text>
					<Text className="text-sm text-muted-foreground">
						{item.message || "请求添加为好友"}
					</Text>
				</View>
				<View className="flex-row space-x-2">
					<Pressable
						className="bg-primary px-4 py-2 rounded-md"
						onPress={() => handleFriendRequest(item._id, "accept")}
						disabled={respondToFriendRequestMutation.isPending}
					>
						<Text className="text-primary-foreground text-sm">接受</Text>
					</Pressable>
					<Pressable
						className="bg-muted px-4 py-2 rounded-md"
						onPress={() => handleFriendRequest(item._id, "reject")}
						disabled={respondToFriendRequestMutation.isPending}
					>
						<Text className="text-muted-foreground text-sm">拒绝</Text>
					</Pressable>
				</View>
			</View>
		);
	}, [handleFriendRequest, respondToFriendRequestMutation.isPending]);

	// 渲染好友列表项
	const renderFriend = useCallback(({ item }: LegendListRenderItemProps<any>) => {
		return (
			<View className="flex-row items-center p-4 bg-card border-b border-border">
				<View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
					<Text className="text-primary-foreground font-bold text-lg">
						{item.displayName?.charAt(0).toUpperCase() || "?"}
					</Text>
				</View>
				<View className="flex-1">
					<Text className="text-foreground font-medium">
						{item.displayName || item.email}
					</Text>
					{/* <Text className="text-sm text-muted-foreground">
						{item._id && `ID: ${item._id}`}
					</Text> */}
				</View>
			</View>
		);
	}, []);

	return (
		<>
			<Tabs.Screen
			/>
			<Container>
				{!userId && !isCurrentUserPending ? (
					// 未登录状态
					<View className="flex-1 justify-center items-center">
						<Text className="text-muted-foreground">请先登录</Text>
					</View>
				) : (isCurrentUserPending || isFriendRequestsPending || isFriendsPending) ? (
					// Loading状态
					<View className="flex-1 justify-center items-center">
						<ActivityIndicator size="large" color={NAV_THEME.light.colors.text} />
					</View>
				) : (
					<ScrollView className="flex-1">
						{/* 新的朋友请求部分 */}
						{friendRequests && friendRequests.length > 0 && (
							<View className="mb-4">
								<Text className="text-lg font-bold text-foreground p-4 pb-2">
									新的朋友 ({friendRequests.length})
								</Text>
								<LegendList
									data={friendRequests}
									renderItem={renderFriendRequest}
									keyExtractor={(item) => item._id}
									recycleItems={false}
									scrollEnabled={false}
								/>
							</View>
						)}

						{/* 联系人列表部分 */}
						<View className="flex-1">
							<Text className="text-lg font-bold text-foreground p-4 pb-2">
								我的好友 ({sortedFriends.length})
							</Text>
							{sortedFriends.length === 0 ? (
								<View className="flex-1 justify-center items-center py-12">
									<Icon as={UsersRoundIcon} size={48} className="text-muted-foreground mb-4" />
									<Text className="text-muted-foreground text-center">
										还没有好友{'\n'}去添加一些好友吧！
									</Text>
								</View>
							) : (
								<LegendList
									data={sortedFriends}
									renderItem={renderFriend}
									keyExtractor={(item) => item?._id || ''}
									recycleItems={true}
									scrollEnabled={false}
								/>
							)}
						</View>
					</ScrollView>
				)}
			</Container>
		</>
	);
}
