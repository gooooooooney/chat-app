# Convex R2 + Expo ImagePicker 图片上传集成方案

## 概述

本文档详细介绍如何在聊天应用中集成 Cloudflare R2 存储和 Expo ImagePicker，实现完整的图片上传、存储和展示功能。

## 1. 技术架构

### 1.1 组件架构
```
前端 (React Native + Expo)
├── Expo ImagePicker        # 图片选择/拍照
├── @convex-dev/r2/react    # 文件上传 Hook
└── Image 组件              # 图片展示

后端 (Convex + Cloudflare R2)
├── Convex R2 Component     # 文件处理中间件
├── Cloudflare R2 Bucket    # 对象存储
└── 消息数据库              # 图片消息存储
```

### 1.2 工作流程
1. **选择图片**: Expo ImagePicker 选择或拍摄图片
2. **乐观更新**: 立即在 UI 显示本地图片
3. **上传到 R2**: Convex R2 Component 处理上传
4. **数据库存储**: 保存图片 URL 和元数据
5. **同步更新**: 用云端 URL 替换本地 URL

## 2. Cloudflare R2 配置

### 2.1 创建 R2 Bucket

1. **登录 Cloudflare 控制台**
   - 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 R2 Object Storage

2. **创建存储桶**
   ```bash
   Bucket Name: chat-app-images
   Location: Automatic (或选择离用户最近的区域)
   ```

3. **配置 CORS 策略**
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST"],
       "AllowedHeaders": ["Content-Type", "Authorization"],
       "MaxAge": 3600
     }
   ]
   ```

### 2.2 创建 API Token

1. **在 R2 主页点击 "Manage R2 API Tokens"**
2. **创建新 Token**:
   ```
   Token Name: chat-app-r2-token
   Permissions: Object Read & Write
   Bucket: chat-app-images (限制到指定桶)
   TTL: Forever (或根据安全要求设置)
   ```

3. **记录凭据**:
   ```
   Account ID: your-account-id
   Access Key ID: your-access-key-id
   Secret Access Key: your-secret-access-key
   Endpoint: https://your-account-id.r2.cloudflarestorage.com
   Bucket: chat-app-images
   ```

## 3. Convex R2 Component 集成

### 3.1 安装依赖

```bash
# 在后端项目中安装
cd packages/backend
npm install @convex-dev/r2

# 在前端项目中安装
cd apps/native
npm install @convex-dev/r2
```

### 3.2 后端配置

#### 配置 Convex App
```typescript
// packages/backend/convex/convex.config.ts
import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config";

const app = defineApp();
app.use(r2);

export default app;
```

#### 设置环境变量
```bash
cd packages/backend

# 设置 Cloudflare R2 凭据
npx convex env set R2_ACCESS_KEY_ID your-access-key-id
npx convex env set R2_SECRET_ACCESS_KEY your-secret-access-key
npx convex env set R2_ENDPOINT https://your-account-id.r2.cloudflarestorage.com
npx convex env set R2_BUCKET chat-app-images
```

#### 创建 R2 客户端
```typescript
// packages/backend/convex/r2.ts
import { r2 } from "@convex-dev/r2/convex.config";

export const { getUrl, generateUploadUrl, syncMetadata } = r2;
```

### 3.3 消息表结构扩展

```typescript
// packages/backend/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const MessageType = v.union(
  v.literal("text"),
  v.literal("image"),
  v.literal("file"),
  v.literal("system")
);

export default defineSchema({
  // 现有表结构...
  
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    content: v.string(),
    type: MessageType,
    replyToId: v.optional(v.id("messages")),
    edited: v.boolean(),
    deleted: v.boolean(),
    
    // 图片相关字段
    imageUrl: v.optional(v.string()),      // R2 图片 URL
    imageKey: v.optional(v.string()),      // R2 存储键
    imageMetadata: v.optional(v.object({   // 图片元数据
      width: v.number(),
      height: v.number(),
      size: v.number(),
      mimeType: v.string(),
    })),
    
    // 上传状态
    uploadStatus: v.optional(v.union(
      v.literal("uploading"),
      v.literal("completed"),
      v.literal("failed")
    )),
  })
  .index("by_conversation", ["conversationId"])
  .index("by_conversation_type", ["conversationId", "type"]),
});
```

### 3.4 图片上传 API

```typescript
// packages/backend/convex/v1/images.ts
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { verifyConversationAccess } from "./helpers/utils";
import { getUrl, generateUploadUrl, syncMetadata } from "../r2";

/**
 * 生成图片上传 URL
 */
export const generateImageUploadUrl = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    // 验证用户权限
    await verifyConversationAccess(ctx, args.userId, args.conversationId);
    
    // 生成唯一的文件键
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const fileKey = `images/${args.conversationId}/${timestamp}_${randomId}_${args.fileName}`;
    
    // 生成上传 URL
    const uploadUrl = await generateUploadUrl({
      key: fileKey,
      contentType: args.contentType,
    });
    
    return {
      uploadUrl,
      fileKey,
    };
  },
});

/**
 * 完成图片上传并创建消息
 */
export const completeImageUpload = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    fileKey: v.string(),
    metadata: v.object({
      width: v.number(),
      height: v.number(),
      size: v.number(),
      mimeType: v.string(),
    }),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // 验证用户权限
    await verifyConversationAccess(ctx, args.senderId, args.conversationId);
    
    // 同步文件元数据到 R2
    await syncMetadata({ key: args.fileKey });
    
    // 获取图片 URL
    const imageUrl = await getUrl({ key: args.fileKey });
    
    // 创建图片消息
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      content: `[图片]`, // 显示文本
      type: "image",
      replyToId: args.replyToId,
      edited: false,
      deleted: false,
      imageUrl,
      imageKey: args.fileKey,
      imageMetadata: args.metadata,
      uploadStatus: "completed",
    });
    
    // 更新会话最后消息
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview: "[图片]",
      updatedAt: Date.now(),
    });
    
    return messageId;
  },
});

/**
 * 获取图片 URL
 */
export const getImageUrl = query({
  args: {
    fileKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await getUrl({ key: args.fileKey });
  },
});
```

## 4. 前端集成

### 4.1 Expo ImagePicker 配置

#### 安装依赖
```bash
cd apps/native
npx expo install expo-image-picker
```

#### 权限配置
```json
// apps/native/app.json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "此应用需要访问相册来选择图片",
          "cameraPermission": "此应用需要访问相机来拍摄照片"
        }
      ]
    ]
  }
}
```

### 4.2 图片选择 Hook

```typescript
// apps/native/hooks/useImagePicker.ts
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
```

### 4.3 图片上传 Hook

```typescript
// apps/native/hooks/useImageUpload.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@chat-app/backend/convex/_generated/api';
import { Id } from '@chat-app/backend/convex/_generated/dataModel';

interface UploadImageParams {
  conversationId: string;
  senderId: string;
  imageUri: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  size?: number;
  replyToId?: Id<"messages">;
}

export const useImageUpload = () => {
  const queryClient = useQueryClient();
  const generateUploadUrl = useConvexMutation(api.v1.images.generateImageUploadUrl);
  const completeUpload = useConvexMutation(api.v1.images.completeImageUpload);

  return useMutation({
    mutationFn: async (params: UploadImageParams) => {
      const {
        conversationId,
        senderId,
        imageUri,
        fileName,
        mimeType,
        width,
        height,
        size = 0,
        replyToId,
      } = params;

      // 1. 创建乐观更新的消息
      const optimisticId = `temp_img_${Date.now()}`;
      const optimisticMessage = {
        _id: optimisticId,
        _creationTime: Date.now(),
        conversationId,
        senderId,
        content: '[图片]',
        type: 'image' as const,
        status: 'uploading' as const,
        imageUrl: imageUri, // 先显示本地图片
        imageMetadata: { width, height, size, mimeType },
        replyToId,
        edited: false,
        deleted: false,
      };

      // 2. 立即更新 UI
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: [...(old?.messages || []), optimisticMessage],
        })
      );

      try {
        // 3. 获取上传 URL
        const { uploadUrl, fileKey } = await generateUploadUrl({
          conversationId: conversationId as Id<"conversations">,
          userId: senderId,
          fileName,
          contentType: mimeType,
        });

        // 4. 上传图片到 R2
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': mimeType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('上传到 R2 失败');
        }

        // 5. 完成上传并创建消息
        const messageId = await completeUpload({
          conversationId: conversationId as Id<"conversations">,
          senderId,
          fileKey,
          metadata: { width, height, size, mimeType },
          replyToId,
        });

        return { optimisticId, realMessageId: messageId, fileKey };
      } catch (error) {
        // 6. 失败时标记为失败状态
        queryClient.setQueryData(
          ['conversation-messages', conversationId],
          (old: any) => ({
            ...old,
            messages: old?.messages?.map((msg: any) =>
              msg._id === optimisticId
                ? { ...msg, status: 'failed' }
                : msg
            ),
          })
        );
        throw error;
      }
    },

    onSuccess: (data, variables) => {
      // 成功后用真实 ID 和云端 URL 替换乐观更新
      queryClient.setQueryData(
        ['conversation-messages', variables.conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.map((msg: any) =>
            msg._id === data.optimisticId
              ? { 
                  ...msg, 
                  _id: data.realMessageId, 
                  status: 'sent',
                  // imageUrl 会在重新查询时更新为 R2 URL
                }
              : msg
          ),
        })
      );

      // 刷新数据以获取最新的图片 URL
      queryClient.invalidateQueries({
        queryKey: ['conversation-messages', variables.conversationId],
      });
    },

    onError: (error, variables) => {
      console.error('图片上传失败:', error);
    },
  });
};
```

### 4.4 图片选择组件

```typescript
// apps/native/components/chat/ImagePicker.tsx
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
          className="flex-row items-center justify-center gap-3 py-4"
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
          className="flex-row items-center justify-center gap-3 py-4"
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
          className="py-4"
        >
          <Text className="text-muted-foreground">
            取消
          </Text>
        </Button>
      </View>
    </View>
  );
};
```

### 4.5 修改 MessageInput 组件

```typescript
// apps/native/components/chat/MessageInput.tsx
import React, { useState, useCallback } from 'react';
import { View, TextInput, Modal } from 'react-native';
import { Button } from '@/components/ui/button';
import { Plus, Send, Mic } from 'lucide-react-native';
import { ImagePickerModal } from './ImagePicker';
// 其他导入...

interface MessageInputProps {
  conversationId: string;
  currentUserId: string;
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onVoiceRecord?: () => void;
}

export function MessageInput({
  conversationId,
  currentUserId,
  onSendMessage,
  disabled = false,
  placeholder = "输入消息...",
  onVoiceRecord,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);

  const handleSend = useCallback(() => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  }, [message, disabled, onSendMessage]);

  const handleAttach = () => {
    setShowImagePicker(true);
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <>
      <View className="flex-row items-end gap-3 bg-background border-t border-border p-4">
        {/* 附件按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-10 w-10"
          onPress={handleAttach}
          disabled={disabled}
        >
          <Plus size={20} className="text-foreground" />
        </Button>

        {/* 文本输入框 */}
        <View className="flex-1">
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            multiline
            maxLength={2000}
            className="bg-muted/30 border border-muted rounded-2xl px-4 py-3 text-base text-foreground"
            editable={!disabled}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* 发送/语音按钮 */}
        {canSend ? (
          <Button
            size="icon"
            className="rounded-full h-10 w-10 bg-primary"
            onPress={handleSend}
            disabled={disabled}
          >
            <Send size={18} className="text-primary-foreground" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10"
            onPress={onVoiceRecord}
            disabled={disabled}
          >
            <Mic size={18} className="text-foreground" />
          </Button>
        )}
      </View>

      {/* 图片选择器模态框 */}
      <Modal
        visible={showImagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <ImagePickerModal
            conversationId={conversationId}
            currentUserId={currentUserId}
            onClose={() => setShowImagePicker(false)}
          />
        </View>
      </Modal>
    </>
  );
}
```

### 4.6 图片消息气泡组件

```typescript
// apps/native/components/chat/ImageMessageBubble.tsx
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
```

## 5. 优化和最佳实践

### 5.1 性能优化

#### 图片压缩
```typescript
// utils/imageCompression.ts
import * as ImageManipulator from 'expo-image-manipulator';

export const compressImage = async (
  uri: string,
  maxWidth: number = 1024,
  quality: number = 0.7
) => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  
  return result;
};
```

#### 图片缓存
```typescript
// components/chat/CachedImage.tsx
import React from 'react';
import { Image } from 'expo-image';

interface CachedImageProps {
  source: { uri: string };
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill';
}

export const CachedImage: React.FC<CachedImageProps> = ({
  source,
  style,
  contentFit = 'cover',
}) => {
  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={200}
    />
  );
};
```

### 5.2 错误处理

#### 重试机制
```typescript
// hooks/useImageUploadWithRetry.ts
import { useCallback } from 'react';
import { useImageUpload } from './useImageUpload';

export const useImageUploadWithRetry = (maxRetries: number = 3) => {
  const upload = useImageUpload();

  const uploadWithRetry = useCallback(async (
    params: any,
    currentAttempt: number = 1
  ) => {
    try {
      return await upload.mutateAsync(params);
    } catch (error) {
      if (currentAttempt < maxRetries) {
        console.log(`上传失败，重试第 ${currentAttempt + 1} 次`);
        await new Promise(resolve => setTimeout(resolve, 1000 * currentAttempt));
        return uploadWithRetry(params, currentAttempt + 1);
      }
      throw error;
    }
  }, [upload, maxRetries]);

  return {
    uploadWithRetry,
    isLoading: upload.isPending,
  };
};
```

### 5.3 安全考虑

#### 文件类型验证
```typescript
// utils/fileValidation.ts
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const validateImageFile = (file: {
  mimeType?: string;
  size?: number;
}) => {
  if (file.mimeType && !ALLOWED_IMAGE_TYPES.includes(file.mimeType)) {
    throw new Error('不支持的图片格式');
  }
  
  if (file.size && file.size > MAX_FILE_SIZE) {
    throw new Error('图片文件过大，请选择小于10MB的图片');
  }
  
  return true;
};
```

## 6. 部署配置

### 6.1 环境变量管理

```bash
# 开发环境
npx convex env set R2_ACCESS_KEY_ID your-dev-access-key-id
npx convex env set R2_SECRET_ACCESS_KEY your-dev-secret-access-key
npx convex env set R2_ENDPOINT https://your-account-id.r2.cloudflarestorage.com
npx convex env set R2_BUCKET chat-app-images-dev

# 生产环境
npx convex env set --prod R2_ACCESS_KEY_ID your-prod-access-key-id
npx convex env set --prod R2_SECRET_ACCESS_KEY your-prod-secret-access-key
npx convex env set --prod R2_ENDPOINT https://your-account-id.r2.cloudflarestorage.com
npx convex env set --prod R2_BUCKET chat-app-images-prod
```

### 6.2 CDN 配置

为了提升图片加载速度，建议配置 Cloudflare CDN：

1. **创建自定义域名**
   ```
   images.your-domain.com
   ```

2. **配置 CNAME 记录**
   ```
   CNAME images.your-domain.com -> your-bucket.r2.cloudflarestorage.com
   ```

3. **更新图片 URL 生成逻辑**
   ```typescript
   const getImageUrl = (fileKey: string) => {
     const cdnDomain = process.env.IMAGE_CDN_DOMAIN || 'your-account-id.r2.cloudflarestorage.com';
     return `https://${cdnDomain}/${fileKey}`;
   };
   ```

## 7. 监控和分析

### 7.1 上传统计

```typescript
// packages/backend/convex/v1/analytics.ts
export const getImageUploadStats = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("messages")
      .withIndex("by_conversation_type", (q) => q.eq("type", "image"))
      .filter((q) => 
        q.and(
          q.gte(q.field("_creationTime"), args.startDate),
          q.lte(q.field("_creationTime"), args.endDate)
        )
      )
      .collect();

    return {
      totalUploads: images.length,
      successfulUploads: images.filter(img => img.uploadStatus === "completed").length,
      failedUploads: images.filter(img => img.uploadStatus === "failed").length,
      totalSize: images.reduce((sum, img) => sum + (img.imageMetadata?.size || 0), 0),
    };
  },
});
```

## 8. 测试策略

### 8.1 单元测试

```typescript
// __tests__/imageUpload.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useImageUpload } from '../hooks/useImageUpload';

describe('useImageUpload', () => {
  it('should upload image successfully', async () => {
    const { result } = renderHook(() => useImageUpload());
    
    await act(async () => {
      await result.current.mutateAsync({
        conversationId: 'test-conversation',
        senderId: 'test-user',
        imageUri: 'file://test-image.jpg',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        width: 1024,
        height: 768,
      });
    });
    
    expect(result.current.isSuccess).toBe(true);
  });
});
```

### 8.2 集成测试

```typescript
// e2e/imageUpload.e2e.ts
describe('Image Upload Flow', () => {
  it('should complete full image upload flow', async () => {
    // 1. 选择图片
    await element(by.id('attach-button')).tap();
    await element(by.text('从相册选择')).tap();
    
    // 2. 模拟选择图片
    // ... 测试代码
    
    // 3. 验证图片显示
    await expect(element(by.id('image-message'))).toBeVisible();
    
    // 4. 验证上传状态
    await waitFor(element(by.text('已发送'))).toBeVisible();
  });
});
```

## 9. 故障排除

### 9.1 常见问题

**问题1: 图片上传失败**
```
错误: 403 Forbidden
解决: 检查 R2 API Token 权限和桶名配置
```

**问题2: 图片无法显示**
```
错误: 图片URL访问失败
解决: 检查CORS配置和图片URL生成逻辑
```

**问题3: 权限被拒绝**
```
错误: Camera/Photo Library permission denied
解决: 检查 app.json 权限配置和用户授权流程
```

### 9.2 调试工具

```typescript
// utils/debugger.ts
export const debugImageUpload = (step: string, data?: any) => {
  if (__DEV__) {
    console.log(`[Image Upload] ${step}:`, data);
  }
};

// 在关键步骤添加调试日志
debugImageUpload('选择图片', { uri, size, type });
debugImageUpload('开始上传', { fileKey, uploadUrl });
debugImageUpload('上传完成', { messageId, imageUrl });
```

---

## 总结

本集成方案提供了完整的图片上传功能，包括：

- ✅ **用户体验**: 支持相册选择和拍照，乐观更新提供即时反馈
- ✅ **可靠性**: 错误处理、重试机制、状态管理
- ✅ **性能**: 图片压缩、CDN加速、缓存优化
- ✅ **安全性**: 文件验证、权限控制、CORS配置
- ✅ **可维护性**: 模块化设计、类型安全、测试覆盖

通过这个方案，你的聊天应用将具备完整的图片消息功能，为用户提供流畅的多媒体聊天体验。

---

*文档版本: 1.0*  
*创建日期: 2025-09-30*  
*作者: Claude Code Assistant*