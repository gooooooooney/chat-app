import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { NAV_THEME } from '@/lib/theme';

const Page = () => {
    const { data: session, isPending } = authClient.useSession();

    // 显示加载指示器，直到身份验证状态确认
    if (isPending) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color={NAV_THEME.light.colors.text} />
            </View>
        );
    }

    // 身份验证状态已确认，根据登录状态重定向
    return session?.session ? (
        <Redirect href="/(authenticated)/(tabs)" />
    ) : (
        <Redirect href="/sign-in" />
    );
};

export default Page;
