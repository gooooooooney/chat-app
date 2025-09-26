import React, { useState } from "react";
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
import { Link, router } from "expo-router";
import { Input } from "../../../../components/input";
import { authClient } from "../../../../lib/auth-client";
import { useConvex, useQuery } from "convex/react";
import { api } from "@chat-app/backend/convex/_generated/api";

export default function ResetPasswordScreen() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [emailSent, setEmailSent] = useState(false);

	const convex = useConvex();

	const [token, setToken] = useState<string | null>(null);

	const handleRequestReset = async () => {
		if (!email) {
			Alert.alert("错误", "请输入邮箱地址");
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			Alert.alert("错误", "请输入有效的邮箱地址");
			return;
		}

		setLoading(true);
		try {
			const { error } = await authClient.requestPasswordReset({
				email,
				redirectTo: `willchat://set-password`, // 使用深度链接跳转到应用内的设置密码页面
			});

			if (error) {
				Alert.alert("错误", error.message || "发送重置邮件失败");
				return;
			}

			setEmailSent(true);
		} catch (error) {
			console.error("Password reset request error:", error);
			Alert.alert("错误", "发送重置邮件失败，请稍后重试");
		} finally {
			setLoading(false);
		}
	};

	const handleResendEmail = async () => {
		setEmailSent(false);
		await handleRequestReset();
	};

	// 开发环境专用：直接使用token跳转到设置密码页面
	const handleGetToken = async () => {
		console.log("🔍 查询token:开始1");

		const tokenQuery = await convex.query(api.auth.getLatestResetToken);
		console.log("🔍 查询成功，结果:", tokenQuery);
		if (tokenQuery?.token) {
			setToken(tokenQuery.token);
			Alert.alert("开发提示", `获取到Token: ${tokenQuery.token}`);
		} else {
			console.log("⚠️ token为空:", tokenQuery);
			Alert.alert("开发提示", "请先发送重置邮件以生成token");
		}
	};
	const handleDevModeJump = async () => {
		const token = "C7klzh1DaAdsc9xabQfoY6ZN"
		if (token) {
			router.push(`/set-password?token=${encodeURIComponent(token)}`);
		} else {
			Alert.alert("开发提示", "请先发送重置邮件以生成token");
		}
	};

	// 邮件发送成功页面
	if (emailSent) {
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
									<Ionicons name="mail" size={32} color="#10B981" />
								</View>
								<Text className="text-3xl font-bold text-foreground text-center mb-3">
									邮件已发送
								</Text>
								<Text className="text-muted-foreground text-center text-base leading-6">
									我们已向 {email} 发送了密码重置链接
								</Text>
								<Text className="text-muted-foreground text-center text-base leading-6 mt-2">
									请检查您的邮箱并点击链接重置密码
								</Text>
							</View>

							{/* Instructions */}
							<View className="bg-card p-4 rounded-lg border border-border mb-6">
								<Text className="text-sm font-medium text-foreground mb-2">
									没有收到邮件？
								</Text>
								<Text className="text-sm text-muted-foreground mb-3">
									• 检查垃圾邮件文件夹
								</Text>
								<Text className="text-sm text-muted-foreground mb-3">
									• 确认邮箱地址正确
								</Text>
								<Text className="text-sm text-muted-foreground">
									• 等待几分钟后重试
								</Text>
							</View>

							{/* Actions */}
							<View className="gap-4">
								<TouchableOpacity
									onPress={handleResendEmail}
									disabled={loading}
									className={`w-full py-4 rounded-lg border border-border ${loading ? "opacity-50" : ""
										}`}
									accessibilityLabel="重新发送邮件"
									accessibilityRole="button"
								>
									<Text className="text-primary text-center text-base font-medium">
										{loading ? "发送中..." : "重新发送邮件"}
									</Text>
								</TouchableOpacity>

								{__DEV__ && (
									<TouchableOpacity
										onPress={handleGetToken}
										className="w-full py-3 rounded-lg border border-orange-300 bg-orange-50"
										accessibilityLabel="开发模式：直接跳转"
										accessibilityRole="button"
									>
										<Text className="text-orange-600 text-center text-sm font-medium">
											GetToken
										</Text>
									</TouchableOpacity>
								)}
								{/* 开发模式：直接跳转按钮 */}
								{__DEV__ && (
									<TouchableOpacity
										onPress={handleDevModeJump}
										className="w-full py-3 rounded-lg border border-orange-300 bg-orange-50"
										accessibilityLabel="开发模式：直接跳转"
										accessibilityRole="button"
									>
										<Text className="text-orange-600 text-center text-sm font-medium">
											🚀 开发模式：使用Token直接跳转
											{token ? " ✅" : " (无可用Token)"}
										</Text>
									</TouchableOpacity>
								)}

								<TouchableOpacity
									onPress={() => router.push("/sign-in")}
									className="w-full py-4 rounded-lg bg-primary"
									accessibilityLabel="返回登录"
									accessibilityRole="button"
								>
									<Text className="text-primary-foreground text-center text-base font-medium">
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

	// 重置密码请求页面
	return (
		<SafeAreaView className="flex-1 bg-background">
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				className="flex-1"
			>
				<ScrollView contentContainerStyle={{ flexGrow: 1 }}>
					<View className="flex-1 justify-center px-6">
						{/* Back button */}
						<TouchableOpacity
							onPress={() => router.back()}
							className="absolute top-4 left-6 p-2"
							accessibilityLabel="返回"
							accessibilityRole="button"
						>
							<Ionicons name="arrow-back" size={24} color="#6B7280" />
						</TouchableOpacity>

						{/* Header */}
						<View className="items-center mb-8">
							<View className="w-20 h-20 bg-primary/10 rounded-full items-center justify-center mb-6">
								<Ionicons name="lock-closed" size={32} color="#3B82F6" />
							</View>
							<Text className="text-3xl font-bold text-foreground text-center mb-3">
								重置密码
							</Text>
							<Text className="text-muted-foreground text-center text-base leading-6">
								请输入您的邮箱地址，我们将向您发送密码重置链接
							</Text>
						</View>

						{/* Form */}
						<View className="gap-4 mb-8">
							<Input
								label="邮箱地址"
								leftIcon="mail"
								placeholder="请输入您的邮箱"
								value={email}
								onChangeText={setEmail}
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								autoComplete="email"
								accessibilityLabel="邮箱地址输入框"
								accessibilityHint="输入您注册时使用的邮箱地址"
							/>
						</View>

						{/* Send Reset Email Button */}
						<TouchableOpacity
							onPress={handleRequestReset}
							disabled={loading || !email}
							className={`w-full py-4 rounded-lg bg-primary mb-6 ${loading || !email ? "opacity-50" : ""
								}`}
							accessibilityLabel="发送重置邮件"
							accessibilityRole="button"
						>
							<Text className="text-primary-foreground text-center text-base font-semibold">
								{loading ? "发送中..." : "发送重置邮件"}
							</Text>
						</TouchableOpacity>

						{/* 开发模式：直接跳转按钮 */}
						{__DEV__ && (
							<TouchableOpacity
								onPress={handleDevModeJump}
								className="w-full py-3 rounded-lg border border-orange-300 bg-orange-50 mb-4"
								accessibilityLabel="开发模式：直接跳转"
								accessibilityRole="button"
							>
								<Text className="text-orange-600 text-center text-sm font-medium">
									🚀 开发模式：使用Token直接跳转
									{token ? " ✅" : " (需要先发送邮件)"}
								</Text>
							</TouchableOpacity>
						)}

						{/* Back to Sign In */}
						<View className="flex-row justify-center items-center">
							<Text className="text-muted-foreground text-sm">
								记起密码了？
							</Text>
							<Link href="/sign-in" asChild>
								<TouchableOpacity
									className="ml-1"
									accessibilityLabel="返回登录"
									accessibilityRole="button"
								>
									<Text className="text-primary text-sm font-medium">
										返回登录
									</Text>
								</TouchableOpacity>
							</Link>
						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}