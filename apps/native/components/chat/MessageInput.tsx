import React, { useState, useCallback } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, TextInputContentSizeChangeEvent } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Plus, Send, Mic } from 'lucide-react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { Icon } from '../ui/icon';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onAttach?: () => void;
  onVoiceRecord?: () => void;
}

export function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder = "输入消息...",
  onAttach,
  onVoiceRecord,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [inputHeight, setInputHeight] = useState(40);

  const handleSend = useCallback(() => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      setInputHeight(40); // 重置输入框高度
    }
  }, [message, disabled, onSendMessage]);

  const handleContentSizeChange = (event: TextInputContentSizeChangeEvent) => {
    const { height } = event.nativeEvent.contentSize;
    setInputHeight(Math.min(Math.max(height, 40), 120)); // 限制高度 40-120
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <KeyboardStickyView
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'transparent'
      }}
    >
      <View className="flex-row items-end gap-3 bg-background border-t border-border pt-4 pb-2">
        {/* 附件按钮 */}
        <View className="items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10"
            onPress={onAttach}
            disabled={disabled}
          >
            <Plus size={20} className="text-foreground" />
          </Button>
        </View>

        {/* 文本输入框容器 */}
        <View className="flex-1  max-h-[120px]">
          <View className="relative">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={placeholder}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              className={cn(
                "bg-muted/30 border border-muted rounded-2xl px-4 py-3",
                " text-base leading-5 text-foreground"
              )}
              onContentSizeChange={handleContentSizeChange}
              editable={!disabled}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* 字数提示 */}
          {message.length > 1800 && (
            <Text variant="muted" className="text-xs mt-1 text-right mr-2">
              {message.length}/2000
            </Text>
          )}
        </View>

        {/* 发送/语音按钮 */}
        <View className="items-center justify-center">
          {canSend ? (
            <Button
              size="icon"
              className="rounded-full h-10 w-10 bg-primary"
              onPress={handleSend}
              disabled={disabled}
            >
              <Icon as={Send} size={18} className="text-primary-foreground" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10"
              onPress={onVoiceRecord}
              disabled={disabled}
            >
              <Icon as={Mic} size={18} className="text-foreground" />
            </Button>
          )}
        </View>
      </View>
    </KeyboardStickyView>
  );
}