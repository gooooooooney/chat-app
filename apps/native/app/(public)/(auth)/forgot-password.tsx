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
import { Input } from "../../../components/input";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordScreen() {
	const [email, setEmail] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [step, setStep] = useState<"email" | "reset" | "success">("email");

	const handleContinue = async () => {
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
			// Simulate email verification
			await new Promise(resolve => setTimeout(resolve, 1000));
			setStep("reset");
		} catch (error) {
			Alert.alert("错误", "验证邮箱失败，请稍后重试");
		} finally {
			setLoading(false);
		}
	};

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

		setLoading(true);
		try {
			// TODO: Implement password reset logic with better-auth
			await authClient.resetPassword({ newPassword });
			
			setStep("success");
		} catch (error) {
			Alert.alert("错误", "重置密码失败，请稍后重试");
		} finally {
			setLoading(false);
		}
	};

	// Success step
	if (step === "success") {
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

	// Password reset step
	if (step === "reset") {
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
								onPress={() => setStep("email")}
								className="absolute top-4 left-6 p-2"
								accessibilityLabel="返回"
								accessibilityRole="button"
							>
								<Ionicons name="arrow-back" size={24} color="#6B7280" />
							</TouchableOpacity>

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
								<Text className="text-sm text-muted-foreground">
									• 至少8个字符
								</Text>
							</View>

							{/* Reset Password Button */}
							<TouchableOpacity
								onPress={handleResetPassword}
								disabled={loading || !newPassword || !confirmPassword}
								className={`w-full py-4 rounded-lg bg-primary mb-6 ${
									loading || !newPassword || !confirmPassword ? "opacity-50" : ""
								}`}
								accessibilityLabel="重置密码"
								accessibilityRole="button"
							>
								<Text className="text-primary-foreground text-center text-base font-semibold">
									{loading ? "重置中..." : "重置密码"}
								</Text>
							</TouchableOpacity>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		);
	}

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
								忘记密码？
							</Text>
							<Text className="text-muted-foreground text-center text-base leading-6">
								请输入您的邮箱地址，我们将向您发送密码重置链接
							</Text>
						</View>

						{/* Form */}
						<View className="space-y-6 mb-8">
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

						{/* Continue Button */}
						<TouchableOpacity
							onPress={handleContinue}
							disabled={loading || !email}
							className={`w-full py-4 rounded-lg bg-primary mb-6 ${
								loading || !email ? "opacity-50" : ""
							}`}
							accessibilityLabel="继续"
							accessibilityRole="button"
						>
							<Text className="text-primary-foreground text-center text-base font-semibold">
								{loading ? "验证中..." : "继续"}
							</Text>
						</TouchableOpacity>

						{/* Reset Password Link */}
						<View className="flex-row justify-center items-center mb-4">
							<Text className="text-muted-foreground text-sm">
								想要通过邮件重置？
							</Text>
							<Link href="/reset-password" asChild>
								<TouchableOpacity
									className="ml-1"
									accessibilityLabel="邮件重置密码"
									accessibilityRole="button"
								>
									<Text className="text-primary text-sm font-medium">
										邮件重置
									</Text>
								</TouchableOpacity>
							</Link>
						</View>

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