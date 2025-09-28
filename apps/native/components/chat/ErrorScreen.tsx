import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { RefreshCw } from 'lucide-react-native';

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text variant="muted" className="text-center mb-4">
        {error}
      </Text>
      <Button onPress={onRetry} variant="outline">
        <RefreshCw size={16} className="mr-2" />
        <Text>重试</Text>
      </Button>
    </View>
  );
}