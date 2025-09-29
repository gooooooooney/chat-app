import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@chat-app/backend/convex/_generated/api";
import { Container } from "@/components/container";
import { Icon } from "@/components/ui/icon";
import {
  ArrowLeftIcon,
  MessageCircleIcon,
  UserIcon,
  ClockIcon,
  CalendarIcon,
  MailIcon
} from "lucide-react-native";
import { NAV_THEME } from "@/lib/theme";

export default function FriendDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ friendUserId: string }>();
  const { friendUserId } = params;

  // 获取当前用户信息
  const { data: currentUser, isPending: isCurrentUserPending } = useQuery(
    convexQuery(api.auth.getCurrentUser, {})
  );
  const currentUserId = currentUser?._id;

  const { mutateAsync: createConversation, isPending: isCreateConversationPending } = useMutation({
    mutationFn: useConvexMutation(api.v1.conversations.createConversation),
    mutationKey: ["createConversation"]
  })

  // 获取好友详情
  const {
    data: friendDetail,
    isPending: isFriendDetailPending,
    error: friendDetailError
  } = useQuery(
    convexQuery(
      api.v1.users.getFriendDetail,
      currentUserId && friendUserId
        ? { currentUserId, friendUserId }
        : "skip"
    )
  );

  const isLoading = isCurrentUserPending || isFriendDetailPending;

  // 格式化时间
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "未知";
    return new Date(timestamp).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formatPresence = (presence?: string) => {
    switch (presence) {
      case "online":
        return "在线";
      case "away":
        return "离开";
      case "offline":
        return "离线";
      default:
        return "未知";
    }
  };

  const getPresenceColor = (presence?: string) => {
    switch (presence) {
      case "online":
        return "#22c55e"; // green
      case "away":
        return "#f59e0b"; // amber
      case "offline":
        return "#64748b"; // gray
      default:
        return "#64748b";
    }
  };


  // 或者，如果需要先创建/获取会话
  const handleStartChat = async (friendUserId: string) => {
    try {
      // 先获取或创建会话
      const conversationId = await createConversation({
        type: "direct",
        participants: [currentUserId as string, friendUserId],
        createdBy: currentUserId as string,
        name: friendDetail?.displayName
      });
      console.log("Started chat with conversationId:", conversationId);
      return conversationId;

    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  // 发消息按钮处理
  const handleSendMessage = async () => {
    const conversationId = await handleStartChat(friendUserId);
    if (conversationId) {
      // 然后导航
      router.push(`/chat/${conversationId}`);
    }
  };

  // 处理错误
  if (friendDetailError) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "好友详情",
            headerLeft: () => (
              <Pressable onPress={() => router.back()} className="p-2">
                <Icon as={ArrowLeftIcon} size={24} />
              </Pressable>
            ),
          }}
        />
        <Container>
          <View className="flex-1 justify-center items-center">
            <Icon as={UserIcon} size={48} className="text-muted-foreground mb-4" />
            <Text className="text-lg text-foreground mb-2">无法查看详情</Text>
            <Text className="text-muted-foreground text-center">
              {(friendDetailError)?.message || "只有好友才能查看详细信息"}
            </Text>
          </View>
        </Container>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "好友详情",
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="p-2">
              <Icon as={ArrowLeftIcon} size={24} />
            </Pressable>
          ),
        }}
      />
      <Container>
        {isLoading ? (
          // Loading状态
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={NAV_THEME.light.colors.text} />
          </View>
        ) : (
          <ScrollView className="flex-1">
            {/* 头像和基本信息 */}
            <View className="items-center py-8 bg-card">
              <View className="w-24 h-24 bg-primary rounded-full items-center justify-center mb-4">
                {friendDetail?.avatar ? (
                  // TODO: 实现头像图片显示
                  <Text className="text-primary-foreground font-bold text-2xl">
                    {friendDetail.displayName?.charAt(0).toUpperCase() || "?"}
                  </Text>
                ) : (
                  <Text className="text-primary-foreground font-bold text-2xl">
                    {friendDetail?.displayName?.charAt(0).toUpperCase() || "?"}
                  </Text>
                )}
              </View>

              <Text className="text-2xl font-bold text-foreground mb-2">
                {friendDetail?.displayName || "未知用户"}
              </Text>

              {/* 在线状态 */}
              <View className="flex-row items-center mb-4">
                <View
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: getPresenceColor(friendDetail?.presence) }}
                />
                <Text className="text-muted-foreground">
                  {formatPresence(friendDetail?.presence)}
                </Text>
              </View>

              {/* 状态消息 */}
              {friendDetail?.statusMessage && (
                <Text className="text-center text-muted-foreground italic px-6">
                  "{friendDetail.statusMessage}"
                </Text>
              )}
            </View>

            {/* 详细信息 */}
            <View className="p-6 space-y-6">
              {/* 个人简介 */}
              {friendDetail?.bio && (
                <View>
                  <Text className="text-lg font-semibold text-foreground mb-2">
                    个人简介
                  </Text>
                  <Text className="text-muted-foreground leading-6">
                    {friendDetail.bio}
                  </Text>
                </View>
              )}

              {/* 好友信息 */}
              <View>
                <Text className="text-lg font-semibold text-foreground mb-4">
                  好友信息
                </Text>

                <View className="space-y-3">
                  {/* 邮箱信息 */}
                  {friendDetail?.email && (
                    <View className="flex-row items-center">
                      <Icon as={MailIcon} size={20} className="text-muted-foreground mr-3" />
                      <View>
                        <Text className="text-sm text-muted-foreground">邮箱</Text>
                        <Text className="text-foreground">
                          {friendDetail.email}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 成为好友时间 */}
                  <View className="flex-row items-center">
                    <Icon as={CalendarIcon} size={20} className="text-muted-foreground mr-3" />
                    <View>
                      <Text className="text-sm text-muted-foreground">成为好友时间</Text>
                      <Text className="text-foreground">
                        {formatDate(friendDetail?.friendshipInfo?.friendsSince)}
                      </Text>
                    </View>
                  </View>

                  {/* 最后在线时间 */}
                  {friendDetail?.lastSeenAt && (
                    <View className="flex-row items-center">
                      <Icon as={ClockIcon} size={20} className="text-muted-foreground mr-3" />
                      <View>
                        <Text className="text-sm text-muted-foreground">最后在线</Text>
                        <Text className="text-foreground">
                          {formatDate(friendDetail.lastSeenAt)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* 底部占位，为悬浮按钮留空间 */}
            <View className="h-20" />
          </ScrollView>
        )}

        {/* 发消息按钮 - 悬浮在底部 */}
        {!isLoading && friendDetail && (
          <View className="absolute bottom-6 left-6 right-6">
            <Pressable
              className="bg-primary rounded-lg py-4 flex-row items-center justify-center"
              onPress={handleSendMessage}
            >
              <Icon as={MessageCircleIcon} size={20} className="text-primary-foreground mr-2" />
              <Text className="text-primary-foreground font-semibold text-lg">
                发消息
              </Text>
            </Pressable>
          </View>
        )}
      </Container>
    </>
  );
}