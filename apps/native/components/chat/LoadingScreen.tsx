import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#007AFF" />
      <Text variant="muted" className="mt-4">
        加载中...
      </Text>
    </View>
  );
}