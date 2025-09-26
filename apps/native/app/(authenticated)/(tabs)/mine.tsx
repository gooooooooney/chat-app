import { Container } from "@/components/container";
import { useQuery } from "convex/react";
import { ScrollView, View, ActivityIndicator, Alert } from "react-native";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";
import { api } from "@chat-app/backend/convex/_generated/api";
import { authClient, getErrorMessage } from "@/lib/auth-client";
import { useRouter } from "expo-router";

export default function Mine() {
  const { signOut } = authClient
  const currentUser = useQuery(api.auth.getCurrentUser);
  const router = useRouter();
  const userProfile = useQuery(
    api.v1.chat.getUserProfile,
    currentUser?.userId ? { userId: currentUser.userId } : "skip"
  );

  if (!currentUser) {
    return (
      <Container>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">加载中...</Text>
        </View>
      </Container>
    );
  }

  const handleSignOut = async () => {
    try {
      const res = await signOut();
      if (res.error && res.error.code) {
        Alert.alert("退出登录失败", getErrorMessage({
          code: res.error.code,
          msg: res.error.message
        }) || "请稍后再试");
      }
      router.push("/sign-in");
    } catch (error) {
      console.error("退出登录失败:", error);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };

  return (
    <Container>
      <ScrollView className="flex-1 p-6">
        <View className="py-8">
          <Text variant="h2" className="text-center mb-8">
            我的
          </Text>

          <Card className="mb-6">
            <CardHeader>
              <View className="flex-row items-center gap-4">
                <Avatar alt={userProfile?.displayName || currentUser.name} className="size-16">
                  {userProfile?.avatar ? (
                    <AvatarImage source={{ uri: userProfile.avatar }} />
                  ) : (
                    <AvatarFallback>
                      <Text className="text-lg font-semibold">
                        {getInitials(userProfile?.displayName || currentUser.name)}
                      </Text>
                    </AvatarFallback>
                  )}
                </Avatar>
                <View className="flex-1">
                  <Text variant="large" className="mb-1">
                    {userProfile?.displayName || currentUser.name || "未设置昵称"}
                  </Text>
                  <Text variant="muted" className="mb-1">
                    {currentUser.email}
                  </Text>
                </View>
              </View>
            </CardHeader>

            {userProfile?.bio && (
              <CardContent>
                <Separator className="mb-4" />
                <Text variant="muted">个人简介</Text>
                <Text className="mt-2">{userProfile.bio}</Text>
              </CardContent>
            )}
          </Card>

          <View className="gap-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onPress={() => {
                // TODO: 导航到编辑资料页面
                console.log("编辑资料");
              }}
            >
              <Text>编辑资料</Text>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onPress={() => {
                // TODO: 导航到设置页面
                console.log("设置");
              }}
            >
              <Text>设置</Text>
            </Button>

            <Separator className="my-4" />

            <Button
              variant="destructive"
              className="w-full"
              onPress={handleSignOut}
            >
              <Text>退出登录</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
