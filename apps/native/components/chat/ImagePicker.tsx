import React from 'react';
import { View, Alert } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface ImagePickerProps {
  conversationId: string;
  currentUserId: string;
  onClose?: () => void;
}

export const ImagePickerModal: React.FC<ImagePickerProps> = ({
  conversationId,
  currentUserId,
  onClose,
}) => {
  const { pickFromLibrary, takePhoto, isLoading: isPickerLoading } = useImagePicker();
  const { mutate: uploadImage, isPending: isUploading } = useImageUpload();

  const isLoading = isPickerLoading || isUploading;

  const handlePickFromLibrary = async () => {
    try {
      const image = await pickFromLibrary();
      if (image) {
        uploadImage({
          conversationId,
          senderId: currentUserId,
          imageUri: image.uri,
          fileName: image.fileName || 'image.jpg',
          mimeType: image.mimeType || 'image/jpeg',
          width: image.width,
          height: image.height,
          size: image.size,
        });
        onClose?.();
      }
    } catch (error) {
      Alert.alert('错误', '选择图片失败，请重试');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const image = await takePhoto();
      if (image) {
        uploadImage({
          conversationId,
          senderId: currentUserId,
          imageUri: image.uri,
          fileName: image.fileName || 'photo.jpg',
          mimeType: image.mimeType || 'image/jpeg',
          width: image.width,
          height: image.height,
          size: image.size,
        });
        onClose?.();
      }
    } catch (error) {
      Alert.alert('错误', '拍照失败，请重试');
    }
  };

  return (
    <View className="p-6 bg-background rounded-t-3xl">
      <Text className="text-lg font-semibold text-center mb-6">
        选择图片
      </Text>

      <View className="gap-4">
        <Button
          onPress={handleTakePhoto}
          disabled={isLoading}
        >
          <Icon as={Camera} size={20} className="text-primary-foreground" />
          <Text className="text-primary-foreground font-medium">
            拍照
          </Text>
        </Button>

        <Button
          variant="outline"
          onPress={handlePickFromLibrary}
          disabled={isLoading}
        >
          <Icon as={ImageIcon} size={20} className="text-foreground" />
          <Text className="text-foreground font-medium">
            从相册选择
          </Text>
        </Button>

        <Button
          variant="ghost"
          onPress={onClose}
          disabled={isLoading}
          className=""
        >
          <Text className="text-muted-foreground">
            取消
          </Text>
        </Button>
      </View>
    </View>
  );
};