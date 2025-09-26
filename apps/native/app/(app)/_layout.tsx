import { LoadingScreen } from '@/components/loading';
import { authClient } from '@/lib/auth-client';
import { Redirect, Slot, useSegments } from 'expo-router';

const Layout = () => {
    const segments = useSegments();
    const inAuthGroup = segments[1] === '(authenticated)';
    const { data: session, isPending } = authClient.useSession();

    // 等待 Clerk 加载完成
    if (isPending) {
        return <LoadingScreen />;
    }

    // 保护认证区域
    if (!session && inAuthGroup) {
        return <Redirect href="/sign-in" />;
    }

    // 如果用户已登录但在公共区域，重定向到认证区域
    // 但排除从根路径的初始导航，因为它已经在根index.tsx中处理
    if (session && !inAuthGroup && segments.length > 1) {
        return <Redirect href="/(app)/(authenticated)/(tabs)" />;
    }

    return <Slot />;
};

export default Layout;
