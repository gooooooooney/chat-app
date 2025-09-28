import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from './ui/icon';
import type { LucideIcon } from 'lucide-react-native';

interface IconWithBadgeProps {
  as: LucideIcon;
  color: string;
  badgeCount?: number;
  size?: number;
}

export function IconWithBadge({ as: IconComponent, color, badgeCount = 0, size = 24 }: IconWithBadgeProps) {
  return (
    <View className="relative">
      <Icon as={IconComponent} color={color} size={size} />
      {badgeCount > 0 && (
        <View className="absolute -top-2 -right-2 bg-red-500 rounded-full min-w-5 h-5 items-center justify-center px-1">
          <Text className="text-white text-xs font-bold">
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}