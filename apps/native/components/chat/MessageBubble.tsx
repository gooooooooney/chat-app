import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, XCircle } from 'lucide-react-native';
import { Icon } from '../ui/icon';

interface MessageBubbleProps {
  message: {
    _id: string;
    content: string;
    senderId: string;
    type: "text" | "image" | "file" | "system";
    status: "sending" | "sent" | "delivered" | "read" | "failed";
    createdAt: number;
  };
  isOwn: boolean;
  senderInfo: {
    userId: string;
    displayName: string;
    avatar?: string;
  };
  showAvatar?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRetry?: () => void; // 新增重试回调
}

export const MessageBubble = React.memo(function MessageBubbleComponent({
  message,
  isOwn,
  senderInfo,
  showAvatar = true,
  onPress,
  onLongPress,
  onRetry,
}: MessageBubbleProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Icon as={Clock} size={12} className="text-muted-foreground" />;
      case 'sent':
        return <Icon as={Check} size={12} className="text-muted-foreground" />;
      case 'delivered':
        return <Icon as={CheckCheck} size={12} className="text-muted-foreground" />;
      case 'read':
        return <Icon as={CheckCheck} size={12} className="text-primary-foreground" />;
      case 'failed':
        return <Icon as={XCircle} size={12} className="text-destructive" />;
      default:
        return null;
    }
  };

  const handlePress = () => {
    if (message.status === 'failed' && isOwn && onRetry) {
      onRetry();
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      className={cn(
        "flex-row mb-3 px-4",
        isOwn ? "justify-end" : "justify-start"
      )}
      accessibilityRole="button"
      accessibilityLabel={`${isOwn ? '我' : senderInfo.displayName}发送的消息: ${message.content}${message.status === 'failed' && isOwn ? '，点击重试' : ''}`}
      accessibilityHint={message.status === 'failed' && isOwn ? "点击重新发送失败的消息" : "双击查看消息详情"}
    >
      {/* 头像(仅对方消息显示) */}
      {!isOwn && (
        <View className="mr-2 mt-1">
          {showAvatar ? (
            <Avatar alt={senderInfo?.displayName}
              className="size-8">
              <AvatarImage
                source={{ uri: senderInfo?.avatar }}
              />
              <AvatarFallback>
                <Text className="text-xs font-medium">
                  {senderInfo?.displayName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </AvatarFallback>
            </Avatar>
          ) : (
            <View className="size-8" />
          )}
        </View>
      )}

      {/* 消息内容容器 */}
      <View className={cn(
        "max-w-[75%] rounded-2xl px-3 py-2",
        isOwn
          ? "bg-primary ml-auto"
          : "bg-muted mr-auto"
      )}>
        {/* 发送者名称(群聊中对方消息显示) */}
        {!isOwn && showAvatar && (
          <Text className="text-xs font-medium text-muted-foreground mb-1">
            {senderInfo.displayName}
          </Text>
        )}

        {/* 消息内容 */}
        <Text className={cn(
          "text-base leading-5",
          isOwn ? "text-primary-foreground" : "text-foreground"
        )}>
          {message.content}
        </Text>

        {/* 消息元信息 */}
        <View className="flex-row items-center justify-between mt-1 min-h-[16px]">
          <Text className={cn(
            "text-xs opacity-70",
            isOwn ? "text-primary-foreground" : "text-muted-foreground"
          )}>
            {formatTime(message.createdAt)}
          </Text>

          {/* 消息状态(仅自己的消息) */}
          {isOwn && (
            <View className="ml-2">
              {getStatusIcon()}
            </View>
          )}
        </View>
      </View>

      {/* 占位，保持布局平衡 */}
      {isOwn && <View className="w-8" />}
    </Pressable>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.isOwn === nextProps.isOwn
  );
});