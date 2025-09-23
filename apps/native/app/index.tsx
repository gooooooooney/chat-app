import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { NAV_THEME } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import {
    Authenticated,
    Unauthenticated,
    AuthLoading,
    useQuery,
  } from "convex/react";

const Page = () => {
    const { data: session, isPending } = authClient.useSession();

    // 显示加载指示器，直到身份验证状态确认
    if (isPending) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color={NAV_THEME.light.text} />
            </View>
        );
    }

    // 身份验证状态已确认，根据登录状态重定向
    return session?.session ? (
        <Redirect href="/(authenticated)/(drawer)" />
    ) : (
        <Redirect href="/sign-in" />
    );
};

export default Page;
