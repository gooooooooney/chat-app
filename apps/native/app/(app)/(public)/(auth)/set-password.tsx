import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Input } from "../../../../components/input";
import { authClient } from "../../../../lib/auth-client";

export default function SetPasswordScreen() {
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [resetSuccess, setResetSuccess] = useState(false);
	const [tokenValid, setTokenValid] = useState(true);
	const [devMode, setDevMode] = useState(false);
	const [manualToken, setManualToken] = useState("");

	const { token } = useLocalSearchParams<{ token: string }>();

	useEffect(() => {
		// 检查是否有token参数
		if (!token && !devMode) {
			// 在开发环境中，提供一个开发模式选项
			if (__DEV__) {
				Alert.alert(
					"没有重置令牌",
					"要进入开发测试模式吗？",
					[
						{
							text: "取消",
							onPress: () => router.push("/sign-in"),
						},
						{
							text: "开发模式",
							onPress: () => setDevMode(true),
						},
					]
				);
			} else {
				setTokenValid(false);
				Alert.alert("错误", "重置链接无效或已过期", [
					{
						text: "确定",
						onPress: () => router.push("/sign-in"),
					},
				]);
			}
		}
	}, [token, devMode]);

	const handleResetPassword = async () => {
		if (!newPassword || !confirmPassword) {
			Alert.alert("错误", "请填写所有密码字段");
			return;
		}

		if (newPassword.length < 8) {
			Alert.alert("错误", "密码长度至少为8位");
			return;
		}

		if (newPassword !== confirmPassword) {
			Alert.alert("错误", "两次输入的密码不一致");
			return;
		}

		const currentToken = token || manualToken;
		if (!currentToken) {
			Alert.alert("错误", "请提供重置令牌");
			return;
		}

		setLoading(true);
		try {
			const { error } = await authClient.resetPassword({
				newPassword,
				token: currentToken,
			});

			if (error) {
				if (error.message?.includes("invalid") || error.message?.includes("expired")) {
					Alert.alert("错误", "重置链接无效或已过期，请重新申请重置密码");
				} else {
					Alert.alert("错误", error.message || "重置密码失败");
				}
				return;
			}

			setResetSuccess(true);
		} catch (error) {
			console.error("Reset password error:", error);
			Alert.alert("错误", "重置密码失败，请稍后重试");
		} finally {
			setLoading(false);
		}
	};

	// 密码重置成功页面
	if (resetSuccess) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					className="flex-1"
				>
					<ScrollView contentContainerStyle={{ flexGrow: 1 }}>
						<View className="flex-1 justify-center px-6">
							{/* Header */}
							<View className="items-center mb-8">
								<View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
									<Ionicons name="checkmark" size={40} color="#10B981" />
								</View>
								<Text className="text-3xl font-bold text-foreground text-center mb-3">
									密码重置成功
								</Text>
								<Text className="text-muted-foreground text-center text-base leading-6">
									您的密码已成功重置
								</Text>
								<Text className="text-muted-foreground text-center text-base leading-6 mt-2">
									现在可以使用新密码登录了
								</Text>
							</View>

							{/* Actions */}
							<TouchableOpacity
								onPress={() => router.push("/sign-in")}
								className="w-full py-4 rounded-lg bg-primary"
								accessibilityLabel="立即登录"
								accessibilityRole="button"
							>
								<Text className="text-primary-foreground text-center text-base font-medium">
									立即登录
								</Text>
							</TouchableOpacity>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		);
	}

	// Token无效页面
	if (!tokenValid) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-1 justify-center px-6">
					<View className="items-center mb-8">
						<View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-6">
							<Ionicons name="close" size={40} color="#EF4444" />
						</View>
						<Text className="text-3xl font-bold text-foreground text-center mb-3">
							链接无效
						</Text>
						<Text className="text-muted-foreground text-center text-base leading-6">
							重置链接无效或已过期
						</Text>
						<Text className="text-muted-foreground text-center text-base leading-6 mt-2">
							请重新申请密码重置
						</Text>
					</View>

					<TouchableOpacity
						onPress={() => router.push("/reset-password")}
						className="w-full py-4 rounded-lg bg-primary mb-4"
						accessibilityLabel="重新申请重置"
						accessibilityRole="button"
					>
						<Text className="text-primary-foreground text-center text-base font-medium">
							重新申请重置
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() => router.push("/sign-in")}
						className="w-full py-4 rounded-lg border border-border"
						accessibilityLabel="返回登录"
						accessibilityRole="button"
					>
						<Text className="text-primary text-center text-base font-medium">
							返回登录
						</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	// 设置新密码页面
	return (
		<SafeAreaView className="flex-1 bg-background">
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				className="flex-1"
			>
				<ScrollView contentContainerStyle={{ flexGrow: 1 }}>
					<View className="flex-1 justify-center px-6">
						{/* Header */}
						<View className="items-center mb-8">
							<View className="w-20 h-20 bg-primary/10 rounded-full items-center justify-center mb-6">
								<Ionicons name="key" size={32} color="#3B82F6" />
							</View>
							<Text className="text-3xl font-bold text-foreground text-center mb-3">
								设置新密码
							</Text>
							<Text className="text-muted-foreground text-center text-base leading-6">
								请为您的账户设置一个新的安全密码
							</Text>
						</View>

						{/* Form */}
						<View className="space-y-6 mb-8">
							{/* 开发模式下显示token输入框 */}
							{devMode && (
								<View>
									<Input
										label="重置令牌 (开发模式)"
										leftIcon="key"
										placeholder="请输入重置令牌进行测试"
										value={manualToken}
										onChangeText={setManualToken}
										autoCapitalize="none"
										autoCorrect={false}
										accessibilityLabel="重置令牌输入框"
										accessibilityHint="输入从后端控制台复制的重置令牌"
									/>
									<Text className="text-xs text-muted-foreground mt-1">
										从后端控制台复制重置令牌，或使用 "test-token" 进行测试
									</Text>
								</View>
							)}

							<Input
								label="新密码"
								leftIcon="lock-closed"
								rightIcon={showPassword ? "eye-off" : "eye"}
								onRightIconPress={() => setShowPassword(!showPassword)}
								rightIconAccessibilityLabel={showPassword ? "隐藏密码" : "显示密码"}
								placeholder="请输入新密码"
								value={newPassword}
								onChangeText={setNewPassword}
								secureTextEntry={!showPassword}
								autoCapitalize="none"
								autoCorrect={false}
								accessibilityLabel="新密码输入框"
								accessibilityHint="输入至少8位的新密码"
							/>

							<Input
								label="确认新密码"
								leftIcon="lock-closed"
								rightIcon={showConfirmPassword ? "eye-off" : "eye"}
								onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
								rightIconAccessibilityLabel={showConfirmPassword ? "隐藏密码" : "显示密码"}
								placeholder="请再次输入新密码"
								value={confirmPassword}
								onChangeText={setConfirmPassword}
								secureTextEntry={!showConfirmPassword}
								autoCapitalize="none"
								autoCorrect={false}
								accessibilityLabel="确认密码输入框"
								accessibilityHint="再次输入相同的新密码"
							/>
						</View>

						{/* Password requirements */}
						<View className="bg-card p-4 rounded-lg border border-border mb-6">
							<Text className="text-sm font-medium text-foreground mb-2">
								密码要求：
							</Text>
							<Text className="text-sm text-muted-foreground mb-1">
								• 至少8个字符
							</Text>
							<Text className="text-sm text-muted-foreground mb-1">
								• 包含字母和数字
							</Text>
							<Text className="text-sm text-muted-foreground">
								• 避免使用常见密码
							</Text>
						</View>

						{/* Reset Password Button */}
						<TouchableOpacity
							onPress={handleResetPassword}
							disabled={loading || !newPassword || !confirmPassword || (devMode && !manualToken)}
							className={`w-full py-4 rounded-lg bg-primary mb-6 ${loading || !newPassword || !confirmPassword || (devMode && !manualToken) ? "opacity-50" : ""
								}`}
							accessibilityLabel="重置密码"
							accessibilityRole="button"
						>
							<Text className="text-primary-foreground text-center text-base font-semibold">
								{loading ? "重置中..." : "重置密码"}
							</Text>
						</TouchableOpacity>

						{/* Back to Sign In */}
						<View className="flex-row justify-center items-center">
							<Text className="text-muted-foreground text-sm">
								不想重置？
							</Text>
							<TouchableOpacity
								onPress={() => router.push("/sign-in")}
								className="ml-1"
								accessibilityLabel="返回登录"
								accessibilityRole="button"
							>
								<Text className="text-primary text-sm font-medium">
									返回登录
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}