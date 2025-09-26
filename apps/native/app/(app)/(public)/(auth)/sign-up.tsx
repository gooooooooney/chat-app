import { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity, ScrollView,
    Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Container } from "@/components/container";
import { Input } from "@/components/input";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { api } from "@chat-app/backend/convex/_generated/api";
import { getErrorMessage } from "@/lib/auth-client";



export default function SignUp() {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const signUpWithEmail = useMutation(api.v1.auth.signUpWithEmail);
    const handleSignUp = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert("错误", "请填写所有必填字段");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("错误", "密码确认不匹配");
            return;
        }

        if (password.length < 8) {
            Alert.alert("错误", "密码至少需要8个字符");
            return;
        }

        setIsLoading(true);
        try {
            const res = await signUpWithEmail({
                email,
                password,
                name,
            });
            console.log(res)
            if (res.error?.code) {
                Alert.alert("注册失败", getErrorMessage({ code: res.error.code, msg: res.error.message }) || "请检查您的信息2");
            } else {
                router.push("/(app)/(authenticated)/(tabs)");
            }

        } catch (error: any) {
            Alert.alert("注册失败", error?.message || "请检查您的信息");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container>
            <KeyboardAwareScrollView
                ScrollViewComponent={ScrollView}
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"

            >
                <View className="flex-1 justify-center px-6 py-12">
                    {/* Logo/Brand Section */}
                    <View className="items-center mb-10">
                        <View className="w-20 h-20 bg-primary rounded-full items-center justify-center mb-4">
                            <Ionicons name="person-add" size={40} color="white" />
                        </View>
                        <Text className="text-3xl font-bold text-foreground text-center">
                            创建账户
                        </Text>
                        <Text className="text-base text-muted-foreground text-center mt-2">
                            加入我们，开始您的聊天之旅
                        </Text>
                    </View>

                    {/* Form Section */}
                    <View className="gap-y-2">
                        {/* Name Input */}
                        <Input
                            label="姓名"
                            placeholder="输入您的姓名"
                            value={name}
                            onChangeText={setName}
                            leftIcon="person-outline"
                            autoCapitalize="words"
                            textContentType="name"
                            accessibilityLabel="姓名输入框"
                            accessibilityHint="请输入您的姓名"
                        />

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
                            placeholder="至少8个字符"
                            value={password}
                            onChangeText={setPassword}
                            leftIcon="lock-closed-outline"
                            rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
                            onRightIconPress={() => setShowPassword(!showPassword)}
                            rightIconAccessibilityLabel={showPassword ? "隐藏密码" : "显示密码"}
                            secureTextEntry={!showPassword}
                            textContentType="newPassword"
                            accessibilityLabel="密码输入框"
                            accessibilityHint="请输入至少8个字符的密码"
                        />

                        {/* Confirm Password Input */}
                        <Input
                            label="确认密码"
                            placeholder="再次输入密码"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            leftIcon="shield-checkmark-outline"
                            rightIcon={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                            onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            rightIconAccessibilityLabel={showConfirmPassword ? "隐藏确认密码" : "显示确认密码"}
                            secureTextEntry={!showConfirmPassword}
                            textContentType="newPassword"
                            accessibilityLabel="确认密码输入框"
                            accessibilityHint="请再次输入密码进行确认"
                        />

                        {/* Password Requirements */}
                        <View className="bg-muted/50 rounded-lg p-4 mt-3">
                            <Text className="text-xs text-muted-foreground mb-2">
                                密码要求：
                            </Text>
                            <View className="flex-row items-center">
                                <Ionicons
                                    name={password.length >= 8 ? "checkmark-circle" : "ellipse-outline"}
                                    size={16}
                                    color={password.length >= 8 ? "#22C55E" : "#6B7280"}
                                />
                                <Text className={`text-sm ml-2 ${password.length >= 8 ? "text-green-600" : "text-muted-foreground"}`}>
                                    至少8个字符
                                </Text>
                            </View>
                        </View>

                        {/* Sign Up Button */}
                        <TouchableOpacity
                            className={`w-full rounded-lg py-4 items-center mt-6 ${isLoading
                                ? "bg-muted"
                                : "bg-primary active:bg-primary/90"
                                }`}
                            onPress={handleSignUp}
                            // disabled={isLoading}
                            accessibilityLabel="创建账户按钮"
                            accessibilityHint="点击创建新账户"
                            accessibilityRole="button"
                        // accessibilityState={{ disabled: isLoading }}
                        >
                            <Text className={cn("text-primary-foreground font-semibold text-base", isLoading && "text-primary/50")}>
                                {isLoading ? "注册中..." : "创建账户"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Sign In Link */}
                    <View className="mt-8 flex-row justify-center items-center">
                        <Text className="text-muted-foreground text-base">已有账户？</Text>
                        <TouchableOpacity
                            onPress={() => router.replace("/sign-in")}
                            className="ml-2 py-2"
                        >
                            <Text className="text-primary font-medium text-base">立即登录</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Terms and Privacy */}
                    <View className="mt-6 px-4">
                        <Text className="text-sm text-muted-foreground text-center leading-relaxed">
                            注册即表示您同意我们的{" "}
                            <Text className="text-primary">服务条款</Text> 和{" "}
                            <Text className="text-primary">隐私政策</Text>
                        </Text>
                    </View>
                </View>
            </KeyboardAwareScrollView>
        </Container>
    );
}