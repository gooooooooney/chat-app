import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, MoreVertical, Phone, Video } from 'lucide-react-native';

interface ChatHeaderProps {
  conversation: {
    type: "direct" | "group";
    name?: string;
    participants: Array<{
      userId: string;
      displayName: string;
      avatar?: string;
      presence?: "online" | "offline";
    }>;
  };
  onBack: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onMore?: () => void;
}

export function ChatHeader({ 
  conversation, 
  onBack, 
  onCall, 
  onVideoCall, 
  onMore 
}: ChatHeaderProps) {
  const isGroup = conversation.type === 'group';
  const participant = conversation.participants[0]; // 单聊时获取对方信息
  
  const title = isGroup 
    ? conversation.name 
    : participant?.displayName || '未知用户';
    
  const subtitle = isGroup 
    ? `${conversation.participants.length} 位成员`
    : participant?.presence === 'online' ? '在线' : '离线';
  
  const avatarUri = isGroup 
    ? conversation.avatar 
    : participant?.avatar;
  
  return (
    <View className="flex-row items-center bg-background border-b border-border px-4 py-3 pt-safe">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onPress={onBack}
        className="mr-3"
      >
        <ArrowLeft size={20} className="text-foreground" />
      </Button>
      
      {/* 头像 */}
      <Avatar className="mr-3 size-10">
        <AvatarImage 
          source={{ uri: avatarUri }} 
          alt={title}
        />
        <AvatarFallback>
          <Text className="font-medium text-sm">
            {title?.charAt(0).toUpperCase() || '?'}
          </Text>
        </AvatarFallback>
      </Avatar>
      
      {/* 标题信息 */}
      <View className="flex-1">
        <Text className="font-semibold text-base leading-tight">
          {title}
        </Text>
        <Text variant="muted" className="text-sm">
          {subtitle}
        </Text>
      </View>
      
      {/* 操作按钮 */}
      <View className="flex-row space-x-1">
        {!isGroup && onCall && (
          <Button
            variant="ghost"
            size="icon"
            onPress={onCall}
          >
            <Phone size={18} className="text-foreground" />
          </Button>
        )}
        
        {!isGroup && onVideoCall && (
          <Button
            variant="ghost"
            size="icon"
            onPress={onVideoCall}
          >
            <Video size={18} className="text-foreground" />
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onPress={onMore}
        >
          <MoreVertical size={18} className="text-foreground" />
        </Button>
      </View>
    </View>
  );
}