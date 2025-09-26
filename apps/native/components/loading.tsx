import { NAV_THEME } from '@/lib/theme';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ }: LoadingScreenProps = {}) {

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" color={NAV_THEME.light.colors.primary} />
    </View>
  );
}