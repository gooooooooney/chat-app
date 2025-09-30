import React, { useState } from 'react';
import { View, Image, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { AlertCircle, Download } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface ImageMessageBubbleProps {
  message: {
    _id: string;
    imageUrl?: string;
    imageMetadata?: {
      width: number;
      height: number;
      size: number;
      mimeType: string;
    };
    status?: "uploading" | "sent" | "failed";
    createdAt: number;
  };
  isOwn: boolean;
  onPress?: () => void;
  onRetry?: () => void;
}

export const ImageMessageBubble: React.FC<ImageMessageBubbleProps> = ({
  message,
  isOwn,
  onPress,
  onRetry,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const handlePress = () => {
    if (message.status === 'failed' && onRetry) {
      onRetry();
    } else if (onPress) {
      onPress();
    }
  };

  const maxWidth = 250;
  const maxHeight = 300;
  
  // 计算显示尺寸
  let displayWidth = maxWidth;
  let displayHeight = maxHeight;
  
  if (message.imageMetadata) {
    const { width, height } = message.imageMetadata;
    const aspectRatio = width / height;
    
    if (aspectRatio > 1) {
      // 横图
      displayHeight = maxWidth / aspectRatio;
      displayHeight = Math.min(displayHeight, maxHeight);
      displayWidth = displayHeight * aspectRatio;
    } else {
      // 竖图或正方形
      displayWidth = maxHeight * aspectRatio;
      displayWidth = Math.min(displayWidth, maxWidth);
      displayHeight = displayWidth / aspectRatio;
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        "rounded-2xl overflow-hidden",
        isOwn ? "ml-auto" : "mr-auto"
      )}
      style={{ width: displayWidth, height: displayHeight }}
    >
      {/* 图片容器 */}
      <View className="relative w-full h-full">
        {message.imageUrl && !imageError ? (
          <Image
            source={{ uri: message.imageUrl }}
            className="w-full h-full"
            resizeMode="cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <View className="w-full h-full bg-muted items-center justify-center">
            <Icon as={Download} size={32} className="text-muted-foreground" />
            <Text className="text-muted-foreground text-sm mt-2">
              {imageError ? '加载失败' : '图片'}
            </Text>
          </View>
        )}

        {/* 加载状态覆盖层 */}
        {(imageLoading || message.status === 'uploading') && (
          <View className="absolute inset-0 bg-black/30 items-center justify-center">
            <ActivityIndicator color="white" size="large" />
            <Text className="text-white text-sm mt-2">
              {message.status === 'uploading' ? '上传中...' : '加载中...'}
            </Text>
          </View>
        )}

        {/* 失败状态覆盖层 */}
        {message.status === 'failed' && (
          <View className="absolute inset-0 bg-red-500/20 items-center justify-center">
            <Icon as={AlertCircle} size={32} className="text-red-500" />
            <Text className="text-red-500 text-sm mt-2">
              上传失败，点击重试
            </Text>
          </View>
        )}

        {/* 时间戳 */}
        <View className="absolute bottom-2 right-2 bg-black/50 rounded px-2 py-1">
          <Text className="text-white text-xs">
            {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};