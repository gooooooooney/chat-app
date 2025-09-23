import { useState } from "react";
import {
    View,
    Text,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authClient, getErrorMessage } from "@/lib/auth-client";
import { Container } from "@/components/container";
import { Input } from "@/components/input";
import { useRouter } from "expo-router";
import { cn } from "@/lib/utils";

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("错误", "请填写所有必填字段");
            return;
        }

        setIsLoading(true);
        try {
            const res = await authClient.signIn.email({
                email,
                password,
            });
            console.log(res)
            if (res.error?.code) {
                Alert.alert("登录失败", getErrorMessage({
                    code: res.error.code,
                    msg: res.error.message
                }) || "请检查您的凭据");
            }
        } catch (error: any) {
            Alert.alert("登录失败", error?.message || "请检查您的凭据");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container>
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="flex-1 justify-center px-6 py-12">
                        {/* Logo/Brand Section */}
                        <View className="items-center mb-12">
                            <View className="w-20 h-20 bg-primary rounded-full items-center justify-center mb-4">
                                <Ionicons name="chatbubbles" size={40} color="white" />
                            </View>
                            <Text className="text-3xl font-bold text-foreground text-center">
                                欢迎回来
                            </Text>
                            <Text className="text-base text-muted-foreground text-center mt-2">
                                登录您的账户继续使用
                            </Text>
                        </View>

                        {/* Form Section */}
                        <View className="gap-y-2">
                            {/* Email Input */}
                            <Input
                                label="邮箱地址"
                                placeholder="输入您的邮箱"
                                value={email}
                                onChangeText={setEmail}
                                leftIcon="mail-outline"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                textContentType="emailAddress"
                                accessibilityLabel="邮箱地址输入框"
                                accessibilityHint="请输入您的邮箱地址"
                            />

                            {/* Password Input */}
                            <Input
                                label="密码"
                                placeholder="输入您的密码"
                                value={password}
                                onChangeText={setPassword}
                                leftIcon="lock-closed-outline"
                                rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
                                onRightIconPress={() => setShowPassword(!showPassword)}
                                rightIconAccessibilityLabel={showPassword ? "隐藏密码" : "显示密码"}
                                secureTextEntry={!showPassword}
                                textContentType="password"
                                accessibilityLabel="密码输入框"
                                accessibilityHint="请输入您的密码"
                            />

                            {/* Forgot Password Link */}
                            <View className="items-end mt-2">
                                <Pressable onPress={() => router.push("/forgot-password")} className="py-2">
                                    <Text className="text-primary font-medium text-base">忘记密码？</Text>
                                </Pressable>
                            </View>

                            {/* Login Button */}
                            <Pressable
                                className={`w-full rounded-lg py-4 items-center mt-6 ${isLoading
                                    ? "bg-muted "
                                    : "bg-primary active:bg-primary/90"
                                    }`}
                                onPress={handleLogin}
                                disabled={isLoading}
                                accessibilityLabel="登录按钮"
                                accessibilityHint="点击登录您的账户"
                                accessibilityRole="button"
                                accessibilityState={{ disabled: isLoading }}
                            >
                                <Text className={cn("text-primary-foreground font-semibold text-base", isLoading && "text-primary/50")}>
                                    {isLoading ? "登录中..." : "登录"}
                                </Text>
                            </Pressable>
                        </View>

                        {/* Sign Up Link */}
                        <View className="mt-8 flex-row justify-center items-center">
                            <Text className="text-muted-foreground">还没有账户？</Text>
                            <Pressable
                                onPress={() => router.replace("/sign-up")}
                                className="ml-1"
                            >
                                <Text className="text-primary font-medium">立即注册</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Container>
    );
}