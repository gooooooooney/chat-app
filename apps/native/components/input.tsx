import React from "react";
import { View, Text, TextInput, TouchableOpacity, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface InputProps extends TextInputProps {
	label: string;
	leftIcon?: keyof typeof Ionicons.glyphMap;
	rightIcon?: keyof typeof Ionicons.glyphMap;
	onRightIconPress?: () => void;
	rightIconAccessibilityLabel?: string;
	error?: string;
	className?: string;
	containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
	label,
	leftIcon,
	rightIcon,
	onRightIconPress,
	rightIconAccessibilityLabel,
	error,
	className = "",
	containerClassName = "",
	...textInputProps
}) => {
	return (
		<View className={`${containerClassName}`}>
			<Text className="text-sm font-medium text-foreground mb-2">
				{label}
			</Text>
			<View className="relative">
				{leftIcon && (
					<View className="absolute left-4 z-10" style={{ top: 16 }}>
						<Ionicons name={leftIcon} size={20} color="#6B7280" />
					</View>
				)}
				<TextInput
					className={`w-full bg-card border border-border rounded-lg text-foreground text-base ${leftIcon ? "px-12" : "px-4"
						} ${rightIcon ? "pr-12" : ""} ${className}`}
					placeholderTextColor="#9CA3AF"
					style={{
						height: 52,
						lineHeight: 18,
						textAlignVertical: 'center',
						includeFontPadding: false,
						paddingTop: 0,
						paddingBottom: 0,
						paddingVertical: 0
					}}
					{...textInputProps}
				/>
				{rightIcon && onRightIconPress && (
					<TouchableOpacity
						className="absolute right-4 z-10"
						style={{ top: 16 }}
						onPress={onRightIconPress}
						accessibilityLabel={rightIconAccessibilityLabel}
						accessibilityRole="button"
					>
						<Ionicons name={rightIcon} size={20} color="#6B7280" />
					</TouchableOpacity>
				)}
			</View>
			{error && (
				<Text className="text-red-500 text-sm mt-1">{error}</Text>
			)}
		</View>
	);
};