import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

interface ImagePickerOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

interface SelectedImage {
  uri: string;
  width: number;
  height: number;
  size?: number;
  mimeType?: string;
  fileName?: string;
}

export const useImagePicker = (options: ImagePickerOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return cameraPermission.status === 'granted' && mediaLibraryPermission.status === 'granted';
  };

  const pickFromLibrary = async (): Promise<SelectedImage | null> => {
    setIsLoading(true);
    
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('权限被拒绝');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect ?? [4, 3],
        quality: options.quality ?? 0.8,
        base64: false,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          size: asset.fileSize,
          mimeType: asset.mimeType,
          fileName: asset.fileName || `image_${Date.now()}.jpg`,
        };
      }
      
      return null;
    } catch (error) {
      console.error('选择图片失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const takePhoto = async (): Promise<SelectedImage | null> => {
    setIsLoading(true);
    
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('权限被拒绝');
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect ?? [4, 3],
        quality: options.quality ?? 0.8,
        base64: false,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          size: asset.fileSize,
          mimeType: asset.mimeType,
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        };
      }
      
      return null;
    } catch (error) {
      console.error('拍照失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    pickFromLibrary,
    takePhoto,
    isLoading,
  };
};