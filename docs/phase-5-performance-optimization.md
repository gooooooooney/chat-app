# Phase 5: 性能优化与监控

> 聊天系统性能优化策略和监控方案实现指南

## 1. 概述

本阶段专注于聊天系统的性能优化，包括渲染性能、内存管理、网络优化和用户体验提升，同时建立完善的性能监控体系。

## 2. 渲染性能优化

### 2.1 消息列表虚拟化优化

```typescript
// apps/native/components/chat/OptimizedMessageList.tsx
import React, { useMemo, useCallback, useRef } from 'react';
import { LegendList } from '@legendapp/list';
import { View, ViewToken } from 'react-native';
import { MessageBubble } from './MessageBubble';
import { MessageSeparator } from './MessageSeparator';

interface OptimizedMessageListProps {
  messages: any[];
  currentUserId: string;
  onLoadMore: () => void;
  onViewableItemsChanged: (info: { viewableItems: ViewToken[] }) => void;
  estimatedItemSize?: number;
}

export const OptimizedMessageList = React.memo<OptimizedMessageListProps>(({
  messages,
  currentUserId,
  onLoadMore,
  onViewableItemsChanged,
  estimatedItemSize = 80,
}) => {
  const scrollRef = useRef<any>(null);
  
  // 优化的项目渲染器
  const renderItem = useCallback(({ item: message, index }: any) => {
    const isOwn = message.senderId === currentUserId;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    
    // 计算是否需要显示头像和时间分隔符
    const showAvatar = !isOwn && (!prevMessage || prevMessage.senderId !== message.senderId);
    const showTimeSeparator = shouldShowTimeSeparator(message, prevMessage);
    
    return (
      <View>
        {showTimeSeparator && (
          <MessageSeparator timestamp={message.createdAt} />
        )}
        <MessageBubble
          message={message}
          isOwn={isOwn}
          senderInfo={message.sender}
          showAvatar={showAvatar}
          isFirstInGroup={!prevMessage || prevMessage.senderId !== message.senderId}
          isLastInGroup={!nextMessage || nextMessage.senderId !== message.senderId}
        />
      </View>
    );
  }, [messages, currentUserId]);
  
  // 优化的key提取器
  const keyExtractor = useCallback((item: any) => item._id, []);
  
  // 判断是否需要显示时间分隔符
  const shouldShowTimeSeparator = (current: any, previous: any) => {
    if (!previous) return true;
    
    const currentTime = new Date(current.createdAt);
    const previousTime = new Date(previous.createdAt);
    
    // 超过1小时显示时间分隔符
    return currentTime.getTime() - previousTime.getTime() > 60 * 60 * 1000;
  };
  
  // 优化的可见性配置
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 500,
    waitForInteraction: true,
  }), []);
  
  // 性能配置
  const performanceProps = useMemo(() => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 15,
    windowSize: 21,
    initialNumToRender: 10,
    updateCellsBatchingPeriod: 50,
    maintainVisibleContentPosition: {
      minIndexForVisible: 0,
      autoscrollToTopThreshold: 10,
    },
  }), []);
  
  return (
    <LegendList
      ref={scrollRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={estimatedItemSize}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      inverted={false}
      contentContainerStyle={{ paddingVertical: 8 }}
      showsVerticalScrollIndicator={false}
      {...performanceProps}
    />
  );
});

OptimizedMessageList.displayName = 'OptimizedMessageList';
```

### 2.2 消息气泡组件优化

```typescript
// apps/native/components/chat/MessageBubble.optimized.tsx
import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface OptimizedMessageBubbleProps {
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
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

// 时间格式化缓存
const timeFormatCache = new Map<number, string>();
const formatTime = (timestamp: number): string => {
  if (timeFormatCache.has(timestamp)) {
    return timeFormatCache.get(timestamp)!;
  }
  
  const date = new Date(timestamp);
  const formatted = date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  timeFormatCache.set(timestamp, formatted);
  
  // 限制缓存大小
  if (timeFormatCache.size > 100) {
    const firstKey = timeFormatCache.keys().next().value;
    timeFormatCache.delete(firstKey);
  }
  
  return formatted;
};

// 状态图标组件缓存
const StatusIconMemo = React.memo<{ status: string; isOwn: boolean }>(({ status, isOwn }) => {
  if (!isOwn) return null;
  
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return '○';
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓';
      case 'failed':
        return '✗';
      default:
        return null;
    }
  };
  
  const icon = getStatusIcon();
  if (!icon) return null;
  
  return (
    <Text className={cn(
      "text-xs ml-2",
      status === 'read' ? "text-primary" : "text-muted-foreground",
      status === 'failed' && "text-destructive"
    )}>
      {icon}
    </Text>
  );
});

StatusIconMemo.displayName = 'StatusIcon';

export const OptimizedMessageBubble = React.memo<OptimizedMessageBubbleProps>(({
  message,
  isOwn,
  senderInfo,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  onPress,
  onLongPress,
}) => {
  // 计算气泡样式
  const bubbleStyles = useMemo(() => {
    const baseStyles = "max-w-[75%] px-3 py-2";
    const colorStyles = isOwn 
      ? "bg-primary ml-auto" 
      : "bg-muted mr-auto";
    
    // 根据消息在群组中的位置调整圆角
    let borderRadius = "";
    if (isFirstInGroup && isLastInGroup) {
      borderRadius = "rounded-2xl";
    } else if (isFirstInGroup) {
      borderRadius = isOwn ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md";
    } else if (isLastInGroup) {
      borderRadius = isOwn ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tl-md";
    } else {
      borderRadius = isOwn ? "rounded-2xl rounded-r-md" : "rounded-2xl rounded-l-md";
    }
    
    return cn(baseStyles, colorStyles, borderRadius);
  }, [isOwn, isFirstInGroup, isLastInGroup]);
  
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className={cn(
        "flex-row mb-1 px-4",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {/* 头像区域 */}
      {!isOwn && (
        <View className="mr-2 mt-1">
          {showAvatar && isLastInGroup ? (
            <Avatar className="size-8">
              <AvatarImage 
                source={{ uri: senderInfo?.avatar }} 
                alt={senderInfo?.displayName}
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
      
      {/* 消息内容 */}
      <View className={bubbleStyles}>
        {/* 发送者名称(群聊中显示) */}
        {!isOwn && showAvatar && isFirstInGroup && (
          <Text className="text-xs font-medium text-muted-foreground mb-1">
            {senderInfo.displayName}
          </Text>
        )}
        
        {/* 消息文本 */}
        <Text className={cn(
          "text-base leading-5",
          isOwn ? "text-primary-foreground" : "text-foreground"
        )}>
          {message.content}
        </Text>
        
        {/* 时间和状态 */}
        {isLastInGroup && (
          <View className="flex-row items-center justify-between mt-1 min-h-[16px]">
            <Text className={cn(
              "text-xs opacity-70",
              isOwn ? "text-primary-foreground" : "text-muted-foreground"
            )}>
              {formatTime(message.createdAt)}
            </Text>
            
            <StatusIconMemo status={message.status} isOwn={isOwn} />
          </View>
        )}
      </View>
      
      {/* 右侧占位 */}
      {isOwn && <View className="w-8" />}
    </Pressable>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在必要时重新渲染
  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.isOwn === nextProps.isOwn &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.isFirstInGroup === nextProps.isFirstInGroup &&
    prevProps.isLastInGroup === nextProps.isLastInGroup
  );
});

OptimizedMessageBubble.displayName = 'OptimizedMessageBubble';
```

## 3. 内存管理优化

### 3.1 消息数据清理

```typescript
// apps/native/lib/memory/MemoryManager.ts
import { MessageCache } from '../cache/MessageCache';

export class MemoryManager {
  private static instance: MemoryManager;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private memoryThreshold = 100; // MB
  private messageCache: MessageCache;
  
  // 内存监控配置
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟
  private readonly MAX_CACHED_CONVERSATIONS = 10;
  private readonly MAX_MESSAGES_PER_CONVERSATION = 200;
  
  constructor() {
    this.messageCache = new MessageCache();
    this.startMemoryMonitoring();
  }
  
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }
  
  // 开始内存监控
  private startMemoryMonitoring(): void {
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, this.CLEANUP_INTERVAL);
  }
  
  // 执行内存清理
  private async performMemoryCleanup(): Promise<void> {
    try {
      // 检查内存使用情况
      const memoryInfo = await this.getMemoryInfo();
      
      if (memoryInfo.used > this.memoryThreshold) {
        console.log('Memory threshold exceeded, performing cleanup...');
        
        // 清理过期的内存缓存
        await this.cleanupExpiredCache();
        
        // 清理未使用的图片缓存
        await this.cleanupImageCache();
        
        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
      }
    } catch (error) {
      console.error('Memory cleanup failed:', error);
    }
  }
  
  // 获取内存信息
  private async getMemoryInfo(): Promise<{ used: number; total: number; available: number }> {
    // 这里应该使用实际的内存监控API
    // 例如 react-native-device-info 或自定义native模块
    return {
      used: 0, // 当前使用的内存(MB)
      total: 0, // 总内存(MB)
      available: 0, // 可用内存(MB)
    };
  }
  
  // 清理过期缓存
  private async cleanupExpiredCache(): Promise<void> {
    // 清理超过30天的消息缓存
    await this.messageCache.cleanupExpiredCache(30);
    
    // 清理内存中的时间格式化缓存
    this.clearTimeFormatCache();
  }
  
  // 清理图片缓存
  private async cleanupImageCache(): Promise<void> {
    // 清理超过7天未访问的图片缓存
    try {
      const cacheDir = ''; // 获取缓存目录路径
      // 实现图片缓存清理逻辑
    } catch (error) {
      console.error('Failed to cleanup image cache:', error);
    }
  }
  
  // 清理时间格式化缓存
  private clearTimeFormatCache(): void {
    // 如果有全局的时间格式化缓存，在这里清理
    if (typeof timeFormatCache !== 'undefined') {
      timeFormatCache.clear();
    }
  }
  
  // 手动触发内存清理
  async forceCleanup(): Promise<void> {
    await this.performMemoryCleanup();
  }
  
  // 停止内存监控
  stopMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
```

### 3.2 图片资源优化

```typescript
// apps/native/components/chat/OptimizedImage.tsx
import React, { useState, useCallback } from 'react';
import { View, Image, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';

interface OptimizedImageProps {
  uri: string;
  width?: number;
  height?: number;
  placeholder?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

// 图片缓存管理
class ImageCacheManager {
  private cache = new Map<string, boolean>();
  private loading = new Set<string>();
  
  // 预加载图片
  async preloadImage(uri: string): Promise<boolean> {
    if (this.cache.has(uri)) {
      return true;
    }
    
    if (this.loading.has(uri)) {
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this.cache.has(uri)) {
            resolve(true);
          } else if (!this.loading.has(uri)) {
            resolve(false);
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }
    
    this.loading.add(uri);
    
    try {
      await Image.prefetch(uri);
      this.cache.set(uri, true);
      this.loading.delete(uri);
      return true;
    } catch (error) {
      this.loading.delete(uri);
      return false;
    }
  }
  
  // 清理缓存
  clearCache(): void {
    this.cache.clear();
  }
  
  // 获取缓存状态
  isCached(uri: string): boolean {
    return this.cache.has(uri);
  }
}

const imageCache = new ImageCacheManager();

export const OptimizedImage = React.memo<OptimizedImageProps>(({
  uri,
  width = 200,
  height = 200,
  placeholder = '加载中...',
  onLoad,
  onError,
}) => {
  const [loading, setLoading] = useState(!imageCache.isCached(uri));
  const [error, setError] = useState(false);
  
  // 处理图片加载完成
  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(false);
    onLoad?.();
  }, [onLoad]);
  
  // 处理图片加载错误
  const handleError = useCallback((e: any) => {
    setLoading(false);
    setError(true);
    onError?.(e);
  }, [onError]);
  
  // 计算优化后的图片尺寸
  const optimizedUri = useMemo(() => {
    // 如果是网络图片，可以添加尺寸参数进行服务端裁剪
    if (uri.startsWith('http')) {
      return `${uri}?w=${width}&h=${height}&q=75`; // 75%质量
    }
    return uri;
  }, [uri, width, height]);
  
  if (error) {
    return (
      <View 
        style={{ width, height }}
        className="bg-muted rounded-lg items-center justify-center"
      >
        <Text variant="muted" className="text-sm">
          加载失败
        </Text>
      </View>
    );
  }
  
  return (
    <View style={{ width, height }} className="relative">
      <Image
        source={{ uri: optimizedUri }}
        style={{ width, height }}
        className="rounded-lg"
        onLoad={handleLoad}
        onError={handleError}
        resizeMode="cover"
      />
      
      {loading && (
        <View 
          style={{ width, height }}
          className="absolute inset-0 bg-muted rounded-lg items-center justify-center"
        >
          <ActivityIndicator size="small" />
          <Text variant="muted" className="text-sm mt-2">
            {placeholder}
          </Text>
        </View>
      )}
    </View>
  );
});

OptimizedImage.displayName = 'OptimizedImage';
```

## 4. 网络优化

### 4.1 请求优化和缓存

```typescript
// apps/native/lib/network/NetworkOptimizer.ts
interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

interface CacheEntry {
  data: any;
  timestamp: number;
  expires: number;
}

export class NetworkOptimizer {
  private cache = new Map<string, CacheEntry>();
  private requestQueue: RequestConfig[] = [];
  private activeRequests = new Set<string>();
  private isProcessing = false;
  
  // 缓存配置
  private readonly DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5分钟
  private readonly MAX_CACHE_SIZE = 100;
  private readonly MAX_CONCURRENT_REQUESTS = 6;
  
  // 发送优化后的请求
  async request(config: RequestConfig): Promise<any> {
    const cacheKey = this.generateCacheKey(config);
    
    // 检查缓存
    if (config.cache !== false) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    // 防止重复请求
    if (this.activeRequests.has(cacheKey)) {
      return this.waitForActiveRequest(cacheKey);
    }
    
    // 添加到请求队列
    return this.enqueueRequest(config);
  }
  
  // 生成缓存键
  private generateCacheKey(config: RequestConfig): string {
    const key = `${config.method}:${config.url}`;
    if (config.data) {
      return `${key}:${JSON.stringify(config.data)}`;
    }
    return key;
  }
  
  // 从缓存获取数据
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  // 存储到缓存
  private setCache(key: string, data: any, ttl: number = this.DEFAULT_CACHE_TIME): void {
    // 限制缓存大小
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
    });
  }
  
  // 将请求加入队列
  private async enqueueRequest(config: RequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        ...config,
        resolve,
        reject,
      } as any);
      
      this.processQueue();
    });
  }
  
  // 处理请求队列
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    if (this.activeRequests.size >= this.MAX_CONCURRENT_REQUESTS) return;
    
    this.isProcessing = true;
    
    // 按优先级排序
    this.requestQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return (priorityOrder[b.priority || 'normal'] || 2) - (priorityOrder[a.priority || 'normal'] || 2);
    });
    
    // 处理请求
    while (this.requestQueue.length > 0 && this.activeRequests.size < this.MAX_CONCURRENT_REQUESTS) {
      const config = this.requestQueue.shift()!;
      this.executeRequest(config);
    }
    
    this.isProcessing = false;
  }
  
  // 执行单个请求
  private async executeRequest(config: RequestConfig & { resolve: Function; reject: Function }): Promise<void> {
    const cacheKey = this.generateCacheKey(config);
    this.activeRequests.add(cacheKey);
    
    try {
      // 实际的网络请求（这里需要根据实际使用的HTTP客户端实现）
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.data ? JSON.stringify(config.data) : undefined,
        signal: AbortSignal.timeout(config.timeout || 10000),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 缓存成功的响应
      if (config.cache !== false && config.method === 'GET') {
        this.setCache(cacheKey, data);
      }
      
      config.resolve(data);
    } catch (error) {
      // 重试逻辑
      if (config.retries && config.retries > 0) {
        setTimeout(() => {
          this.executeRequest({
            ...config,
            retries: config.retries! - 1,
          });
        }, 1000 * (4 - config.retries)); // 递增延迟
      } else {
        config.reject(error);
      }
    } finally {
      this.activeRequests.delete(cacheKey);
      
      // 继续处理队列
      if (this.requestQueue.length > 0) {
        this.processQueue();
      }
    }
  }
  
  // 等待活跃请求完成
  private async waitForActiveRequest(cacheKey: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkRequest = () => {
        if (!this.activeRequests.has(cacheKey)) {
          const cached = this.getFromCache(cacheKey);
          if (cached) {
            resolve(cached);
          } else {
            reject(new Error('Request failed'));
          }
        } else {
          setTimeout(checkRequest, 100);
        }
      };
      checkRequest();
    });
  }
  
  // 清理过期缓存
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
  
  // 清空所有缓存
  clearCache(): void {
    this.cache.clear();
  }
}
```

### 4.2 智能预加载

```typescript
// apps/native/lib/preloader/ContentPreloader.ts
export class ContentPreloader {
  private preloadQueue: Array<() => Promise<void>> = [];
  private isPreloading = false;
  private networkOptimizer: NetworkOptimizer;
  
  constructor() {
    this.networkOptimizer = new NetworkOptimizer();
  }
  
  // 预加载会话列表
  async preloadConversations(userId: string): Promise<void> {
    const task = async () => {
      try {
        // 预加载会话列表
        await this.networkOptimizer.request({
          url: '/api/conversations',
          method: 'GET',
          data: { userId },
          cache: true,
          priority: 'high',
        });
        
        // 预加载每个会话的最新消息
        const conversations = await this.getConversationsFromCache(userId);
        for (const conv of conversations.slice(0, 5)) { // 只预加载前5个会话
          await this.preloadRecentMessages(conv.id);
        }
      } catch (error) {
        console.error('Failed to preload conversations:', error);
      }
    };
    
    this.enqueuePreload(task);
  }
  
  // 预加载最近消息
  async preloadRecentMessages(conversationId: string): Promise<void> {
    const task = async () => {
      try {
        await this.networkOptimizer.request({
          url: `/api/conversations/${conversationId}/messages`,
          method: 'GET',
          data: { limit: 20 },
          cache: true,
          priority: 'normal',
        });
      } catch (error) {
        console.error('Failed to preload recent messages:', error);
      }
    };
    
    this.enqueuePreload(task);
  }
  
  // 预加载用户头像
  async preloadUserAvatars(userIds: string[]): Promise<void> {
    const task = async () => {
      const avatarPromises = userIds.map(async (userId) => {
        try {
          const user = await this.getUserInfo(userId);
          if (user.avatar) {
            await Image.prefetch(user.avatar);
          }
        } catch (error) {
          console.error(`Failed to preload avatar for user ${userId}:`, error);
        }
      });
      
      await Promise.allSettled(avatarPromises);
    };
    
    this.enqueuePreload(task);
  }
  
  // 智能预加载下一页消息
  async preloadNextPage(conversationId: string, currentPage: number): Promise<void> {
    const task = async () => {
      try {
        await this.networkOptimizer.request({
          url: `/api/conversations/${conversationId}/messages`,
          method: 'GET',
          data: { 
            page: currentPage + 1,
            limit: 20 
          },
          cache: true,
          priority: 'low',
        });
      } catch (error) {
        console.error('Failed to preload next page:', error);
      }
    };
    
    this.enqueuePreload(task);
  }
  
  // 加入预加载队列
  private enqueuePreload(task: () => Promise<void>): void {
    this.preloadQueue.push(task);
    this.processPreloadQueue();
  }
  
  // 处理预加载队列
  private async processPreloadQueue(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) return;
    
    this.isPreloading = true;
    
    while (this.preloadQueue.length > 0) {
      const task = this.preloadQueue.shift()!;
      try {
        await task();
      } catch (error) {
        console.error('Preload task failed:', error);
      }
      
      // 避免阻塞主线程
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.isPreloading = false;
  }
  
  // 从缓存获取会话列表
  private async getConversationsFromCache(userId: string): Promise<any[]> {
    // 这里应该从本地缓存获取数据
    return [];
  }
  
  // 获取用户信息
  private async getUserInfo(userId: string): Promise<any> {
    return this.networkOptimizer.request({
      url: `/api/users/${userId}`,
      method: 'GET',
      cache: true,
      priority: 'low',
    });
  }
}
```

## 5. 性能监控

### 5.1 性能指标收集

```typescript
// apps/native/lib/monitoring/PerformanceMonitor.ts
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface RenderMetrics {
  componentName: string;
  renderTime: number;
  propsSize: number;
  reRenderCount: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private renderMetrics = new Map<string, RenderMetrics>();
  private startTimes = new Map<string, number>();
  
  // 记录性能指标
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });
    
    // 限制内存中的指标数量
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }
  
  // 开始计时
  startTimer(name: string): void {
    this.startTimes.set(name, performance.now());
  }
  
  // 结束计时并记录
  endTimer(name: string, tags?: Record<string, string>): number {
    const startTime = this.startTimes.get(name);
    if (startTime === undefined) {
      console.warn(`Timer ${name} was not started`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.recordMetric(name, duration, tags);
    this.startTimes.delete(name);
    
    return duration;
  }
  
  // 记录渲染指标
  recordRender(componentName: string, renderTime: number, propsSize: number): void {
    const existing = this.renderMetrics.get(componentName);
    if (existing) {
      existing.renderTime = renderTime;
      existing.propsSize = propsSize;
      existing.reRenderCount++;
    } else {
      this.renderMetrics.set(componentName, {
        componentName,
        renderTime,
        propsSize,
        reRenderCount: 1,
      });
    }
  }
  
  // 获取性能统计
  getStats(): {
    averageMessageRenderTime: number;
    memoryUsage: number;
    networkLatency: number;
    frameDrops: number;
  } {
    const messageRenderTimes = this.metrics
      .filter(m => m.name === 'message_render_time')
      .map(m => m.value);
    
    const networkLatencies = this.metrics
      .filter(m => m.name === 'network_request_time')
      .map(m => m.value);
    
    return {
      averageMessageRenderTime: this.calculateAverage(messageRenderTimes),
      memoryUsage: this.getCurrentMemoryUsage(),
      networkLatency: this.calculateAverage(networkLatencies),
      frameDrops: this.getFrameDropCount(),
    };
  }
  
  // 计算平均值
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  // 获取当前内存使用情况
  private getCurrentMemoryUsage(): number {
    // 这里应该使用实际的内存监控API
    return 0;
  }
  
  // 获取掉帧数量
  private getFrameDropCount(): number {
    // 这里应该使用实际的帧率监控API
    return 0;
  }
  
  // 导出指标数据
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
  
  // 清理旧指标
  cleanup(olderThan: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThan;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }
}

// 性能监控 Hook
export function usePerformanceMonitor() {
  const monitor = useMemo(() => new PerformanceMonitor(), []);
  
  // 监控组件渲染性能
  const measureRender = useCallback((componentName: string) => {
    const startTime = performance.now();
    
    return () => {
      const renderTime = performance.now() - startTime;
      monitor.recordRender(componentName, renderTime, 0);
    };
  }, [monitor]);
  
  // 监控网络请求性能
  const measureNetwork = useCallback((requestName: string) => {
    monitor.startTimer(`network_${requestName}`);
    
    return () => {
      monitor.endTimer(`network_${requestName}`, { type: 'network' });
    };
  }, [monitor]);
  
  return {
    monitor,
    measureRender,
    measureNetwork,
  };
}
```

### 5.2 性能报告组件

```typescript
// apps/native/components/debug/PerformanceReport.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { PerformanceMonitor } from '@/lib/monitoring/PerformanceMonitor';

interface PerformanceReportProps {
  monitor: PerformanceMonitor;
  visible?: boolean;
}

export function PerformanceReport({ monitor, visible = false }: PerformanceReportProps) {
  const [stats, setStats] = useState(monitor.getStats());
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    if (!visible) return;
    
    const interval = setInterval(() => {
      setStats(monitor.getStats());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [monitor, visible]);
  
  if (!visible) return null;
  
  const formatTime = (ms: number) => `${ms.toFixed(2)}ms`;
  const formatMemory = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  
  return (
    <View className="absolute top-20 right-4 bg-background border border-border rounded-lg p-4 shadow-lg max-w-xs z-50">
      <Text className="font-semibold mb-2">性能监控</Text>
      
      <View className="space-y-2">
        <View className="flex-row justify-between">
          <Text variant="small">消息渲染:</Text>
          <Text variant="small">{formatTime(stats.averageMessageRenderTime)}</Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text variant="small">内存使用:</Text>
          <Text variant="small">{formatMemory(stats.memoryUsage)}</Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text variant="small">网络延迟:</Text>
          <Text variant="small">{formatTime(stats.networkLatency)}</Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text variant="small">掉帧数:</Text>
          <Text variant="small">{stats.frameDrops}</Text>
        </View>
      </View>
      
      <Button
        variant="outline"
        size="sm"
        onPress={() => setShowDetails(!showDetails)}
        className="mt-3"
      >
        <Text>{showDetails ? '隐藏详情' : '显示详情'}</Text>
      </Button>
      
      {showDetails && (
        <ScrollView className="mt-3 max-h-40">
          <Text variant="small" className="font-mono">
            {JSON.stringify(monitor.exportMetrics().slice(-10), null, 2)}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
```

## 6. 用户体验优化

### 6.1 智能加载状态

```typescript
// apps/native/components/chat/SmartLoadingIndicator.tsx
import React, { useState, useEffect } from 'react';
import { View, Animated } from 'react-native';
import { Text } from '@/components/ui/text';
import { ActivityIndicator } from 'react-native';

interface SmartLoadingIndicatorProps {
  isLoading: boolean;
  loadingText?: string;
  minimumDisplayTime?: number;
  delayBeforeShow?: number;
}

export function SmartLoadingIndicator({
  isLoading,
  loadingText = '加载中...',
  minimumDisplayTime = 500,
  delayBeforeShow = 200,
}: SmartLoadingIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    let showTimer: NodeJS.Timeout;
    let hideTimer: NodeJS.Timeout;
    
    if (isLoading) {
      // 延迟显示加载指示器，避免闪烁
      showTimer = setTimeout(() => {
        setVisible(true);
        setStartTime(Date.now());
        
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, delayBeforeShow);
    } else if (visible && startTime) {
      // 确保最小显示时间
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minimumDisplayTime - elapsedTime);
      
      hideTimer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
          setStartTime(null);
        });
      }, remainingTime);
    }
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isLoading, visible, startTime, fadeAnim, delayBeforeShow, minimumDisplayTime]);
  
  if (!visible) return null;
  
  return (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className="absolute inset-0 bg-background/80 items-center justify-center z-50"
    >
      <View className="bg-background border border-border rounded-lg p-6 items-center shadow-lg">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text variant="muted" className="mt-3">
          {loadingText}
        </Text>
      </View>
    </Animated.View>
  );
}
```

### 6.2 滚动性能优化

```typescript
// apps/native/hooks/useOptimizedScroll.ts
import { useCallback, useRef, useState } from 'react';
import { NativeScrollEvent } from 'react-native';

export function useOptimizedScroll() {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  const lastScrollTop = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');
  
  // 节流的滚动处理器
  const handleScroll = useCallback((event: { nativeEvent: NativeScrollEvent }) => {
    const currentScrollTop = event.nativeEvent.contentOffset.y;
    
    // 更新滚动方向
    if (currentScrollTop > lastScrollTop.current) {
      scrollDirection.current = 'down';
    } else {
      scrollDirection.current = 'up';
    }
    lastScrollTop.current = currentScrollTop;
    
    // 设置滚动状态
    if (!isScrolling) {
      setIsScrolling(true);
    }
    
    // 清除之前的定时器
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    // 设置滚动结束检测
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, [isScrolling]);
  
  // 优化的可见项变更处理器
  const handleViewableItemsChanged = useCallback(
    (info: { viewableItems: any[]; changed: any[] }) => {
      // 只在非滚动状态下处理，避免频繁更新
      if (!isScrolling) {
        // 处理可见项变更逻辑
        console.log('Viewable items changed:', info.viewableItems.length);
      }
    },
    [isScrolling]
  );
  
  return {
    handleScroll,
    handleViewableItemsChanged,
    isScrolling,
    scrollDirection: scrollDirection.current,
  };
}
```

---

## 总结

Phase 5完成了聊天系统的全面性能优化，包括：

- **渲染优化**: 虚拟化列表、组件缓存、智能重渲染
- **内存管理**: 自动清理、图片优化、缓存限制
- **网络优化**: 请求队列、智能缓存、预加载策略
- **监控体系**: 性能指标收集、实时监控、问题诊断
- **用户体验**: 智能加载、流畅滚动、状态反馈

这确保了聊天系统在各种设备和网络条件下都能保持优秀的性能表现。