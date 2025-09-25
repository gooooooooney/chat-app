import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  TextInput,
  Pressable,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Stack, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Search, UserPlus, ArrowLeft, User, SearchIcon, XIcon } from "lucide-react-native";
import { Container } from "@/components/container";
import { Icon } from "@/components/ui/icon";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@chat-app/backend/convex/_generated/api";
import type { UserProfileWithId } from "@chat-app/backend/convex/types";

/**
 * 添加好友页面
 */
const AddFriend: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    user: UserProfileWithId;
    status: "stranger" | "sent_pending" | "received_pending" | "friend" | "self";
  }>>([]);

  const convex = useConvex()
  // 获取当前用户信息
  const currentUser = useQuery(api.auth.getCurrentUser);
  const sendFriendRequestMutation = useMutation(api.v1.users.sendFriendRequest);

  // 处理返回按钮点击
  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // 处理搜索
  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("提示", "请输入好友的自定义ID");
      return;
    }

    if (!currentUser?._id) {
      Alert.alert("错误", "用户未登录");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSearching(true);

    const findUserQuery = await convex.query(api.v1.users.findUserByCustomId, {
      customId: searchText.trim()
    });

    console.log(findUserQuery)
    if (findUserQuery && findUserQuery?.userId) {
      const friendshipStatusQuery = await convex.query(api.v1.users.checkFriendshipStatus, {
        currentUserId: currentUser._id,
        targetUserId: findUserQuery.userId
      });

      if (friendshipStatusQuery) {
        setSearchResults([{
          user: findUserQuery,
          status: friendshipStatusQuery.status as any
        }]);
      }
    } else {
      setSearchResults([]);
      Alert.alert("未找到用户", "请检查ID是否正确");
    }

    setIsSearching(false);
  }, [searchText, currentUser]);

  // 处理添加好友
  const handleAddFriend = useCallback(async (user: UserProfileWithId) => {
    if (!currentUser?._id) {
      Alert.alert("错误", "用户未登录");
      return;
    }

    if (!user.customId) {
      Alert.alert("错误", "目标用户没有设置自定义ID");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Alert.alert(
      "添加好友",
      `确定要添加 ${user.displayName || user.customId} 为好友吗？`,
      [
        {
          text: "取消",
          style: "cancel",
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        },
        {
          text: "添加",
          onPress: async () => {
            try {
              const result = await sendFriendRequestMutation({
                fromUserId: currentUser._id,
                toCustomId: user.customId!,
                message: "您好，我想添加您为好友"
              });

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "成功",
                result.autoAccepted ? "已成为好友！" : "好友请求已发送",
                [{
                  text: "好的",
                  onPress: () => {
                    // 重新搜索更新状态
                    if (searchText.trim()) {
                      handleSearch();
                    }
                  }
                }]
              );

            } catch (error) {
              console.error('添加好友错误:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("错误", error instanceof Error ? error.message : "添加好友失败，请重试");
            }
          },
        },
      ]
    );
  }, [currentUser, sendFriendRequestMutation, searchText, handleSearch]);

  // 清空搜索
  const handleClearSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchText("");
    setSearchResults([]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "添加好友",
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "600",
            color: "#000000",
          },
          headerStyle: {
            backgroundColor: "#ffffff",
          },
          headerLeft: () => (
            <Pressable
              onPress={handleGoBack}
              className="p-2 -ml-2"
            >
              <ArrowLeft size={24} color="#000000" />
            </Pressable>
          ),
        }}
      />

      <Container>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 搜索区域 */}
            <View className="px-4 pt-4 pb-6">
              {/* 搜索提示 */}
              <Text className="text-base text-muted-foreground mb-4 leading-5">
                请输入好友的自定义ID（只支持英文、数字和下划线）
              </Text>

              {/* 搜索输入框 */}
              <View className="relative">
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="输入好友的自定义ID"
                  placeholderTextColor="#9CA3AF"
                  className="bg-background leading-5 border border-border rounded-lg px-4 py-3 pr-12 text-base text-foreground"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />

                {/* 清除按钮 */}
                {searchText.length > 0 && (
                  <Pressable
                    onPress={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  >
                    <Icon as={XIcon} size={16} className="text-primary" />
                  </Pressable>
                )}
              </View>

              {/* 搜索按钮 */}
              <Pressable
                onPress={handleSearch}
                className="bg-primary rounded-lg px-4 py-3 mt-4 flex-row items-center justify-center gap-2 active:bg-primary/90"
                disabled={isSearching || !searchText.trim()}
                style={{
                  opacity: isSearching || !searchText.trim() ? 0.5 : 1,
                }}
              >
                <Icon as={SearchIcon} size={18} className="text-primary-foreground" />
                <Text className="text-primary-foreground font-medium text-base">
                  {isSearching ? "搜索中..." : "搜索"}
                </Text>
              </Pressable>
            </View>

            {/* 搜索结果 */}
            {searchResults.length > 0 && (
              <View className="px-4">
                <Text className="text-sm text-muted-foreground mb-3">
                  搜索结果
                </Text>

                {searchResults.map((result) => (
                  <View
                    key={result.user._id}
                    className="bg-card rounded-lg p-4 mb-3 border border-border"
                  >
                    <View className="flex-row items-center justify-between">
                      {/* 用户信息 */}
                      <View className="flex-row items-center gap-3 flex-1">
                        {/* 头像 */}
                        <View className="bg-muted rounded-full p-3">
                          <User size={24} color="#6B7280" />
                        </View>

                        {/* 名称和状态 */}
                        <View className="flex-1">
                          <Text className="text-foreground text-base font-medium">
                            {result.user.displayName || result.user.customId}
                          </Text>
                          <Text className="text-muted-foreground text-sm mt-1">
                            ID: {result.user.customId}
                          </Text>
                          {result.user.bio && (
                            <Text className="text-muted-foreground text-xs mt-1">
                              {result.user.bio}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* 操作按钮 */}
                      {result.status === "stranger" && (
                        <Pressable
                          onPress={() => handleAddFriend(result.user)}
                          className="bg-primary rounded-lg px-4 py-2 flex-row items-center gap-2 active:bg-primary/90"
                        >
                          <UserPlus size={16} color="#ffffff" />
                          <Text className="text-primary-foreground text-sm font-medium">
                            添加
                          </Text>
                        </Pressable>
                      )}

                      {result.status === "sent_pending" && (
                        <View className="bg-orange-100 rounded-lg px-4 py-2">
                          <Text className="text-orange-700 text-sm">
                            已发送
                          </Text>
                        </View>
                      )}

                      {result.status === "received_pending" && (
                        <View className="bg-blue-100 rounded-lg px-4 py-2">
                          <Text className="text-blue-700 text-sm">
                            待处理
                          </Text>
                        </View>
                      )}

                      {result.status === "friend" && (
                        <View className="bg-green-100 rounded-lg px-4 py-2">
                          <Text className="text-green-700 text-sm">
                            已是好友
                          </Text>
                        </View>
                      )}

                      {result.status === "self" && (
                        <View className="bg-gray-100 rounded-lg px-4 py-2">
                          <Text className="text-gray-700 text-sm">
                            自己
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 使用说明 */}
            <View className="px-4 pt-6 pb-8">
              <View className="bg-muted/50 rounded-lg p-4">
                <Text className="text-muted-foreground text-sm leading-5">
                  💡 使用小贴士{"\n"}
                  • 输入好友的自定义ID（英文、数字、下划线组合）{"\n"}
                  • 确保ID准确，区分大小写{"\n"}
                  • 如果对方也向你发送了好友请求，会自动成为好友{"\n"}
                  • 发送请求后等待对方同意即可开始聊天
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Container>
    </>
  );
};

export default AddFriend;