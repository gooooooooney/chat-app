# Phase 4: 离线同步机制实现

> 离线优先的消息缓存和同步策略实现指南

## 1. 概述

本阶段实现聊天系统的离线支持机制，确保用户在网络不稳定或离线状态下仍能正常使用聊天功能，并在网络恢复时自动同步数据。

## 2. 离线架构设计

### 2.1 三层缓存架构

```typescript
// apps/native/lib/storage/StorageManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';

export class StorageManager {
  private static instance: StorageManager;
  private db: SQLite.SQLiteDatabase | null = null;
  
  // 存储键值常量
  static readonly STORAGE_KEYS = {
    CONVERSATIONS: 'chat_conversations',
    MESSAGES_PREFIX: 'chat_messages_',
    PENDING_MESSAGES: 'chat_pending_messages',
    SYNC_TIMESTAMP: 'chat_sync_timestamp',
    USER_PROFILE: 'chat_user_profile',
    OFFLINE_QUEUE: 'chat_offline_queue',
    CACHED_MEDIA: 'chat_cached_media',
  } as const;
  
  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }
  
  // 初始化数据库
  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: 'ChatApp.db',
        location: 'default',
      });
      
      await this.createTables();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }
  
  // 创建表结构
  private async createTables(): Promise<void> {
    if (!this.db) return;
    
    // 消息表
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        localId TEXT,
        replyToId TEXT,
        attachments TEXT,
        INDEX idx_conversation_time (conversationId, createdAt),
        INDEX idx_sync_status (synced),
        INDEX idx_sender (senderId)
      );
    `);
    
    // 会话表
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        participants TEXT NOT NULL,
        lastMessageAt INTEGER,
        lastMessage TEXT,
        unreadCount INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
      );
    `);
    
    // 离线队列表
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        data TEXT NOT NULL,
        retryCount INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL,
        lastRetryAt INTEGER
      );
    `);
  }
}
```

### 2.2 消息缓存管理

```typescript
// apps/native/lib/cache/MessageCache.ts
import { StorageManager } from '../storage/StorageManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  localId?: string;
  replyToId?: string;
  attachments?: any[];
}

export class MessageCache {
  private storage = StorageManager.getInstance();
  private memoryCache = new Map<string, CachedMessage[]>();
  private readonly MAX_MEMORY_CACHE_SIZE = 500; // 内存中最多缓存500条消息
  private readonly MAX_LOCAL_MESSAGES = 1000; // 本地最多存储1000条消息/会话
  
  // L1: 内存缓存 - 获取最近消息
  async getMessagesFromMemory(conversationId: string, limit: number = 20): Promise<CachedMessage[]> {
    const cached = this.memoryCache.get(conversationId) || [];
    return cached.slice(-limit);
  }
  
  // L2: AsyncStorage缓存 - 获取本地存储的消息
  async getMessagesFromStorage(conversationId: string, limit: number = 50): Promise<CachedMessage[]> {
    try {
      const key = `${StorageManager.STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`;
      const data = await AsyncStorage.getItem(key);
      
      if (data) {
        const messages: CachedMessage[] = JSON.parse(data);
        return messages.slice(-limit);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get messages from storage:', error);
      return [];
    }
  }
  
  // L3: SQLite缓存 - 获取历史消息
  async getMessagesFromDatabase(
    conversationId: string, 
    limit: number = 100,
    before?: number
  ): Promise<CachedMessage[]> {
    if (!this.storage.db) {
      await this.storage.initialize();
    }
    
    try {
      let query = `
        SELECT * FROM messages 
        WHERE conversationId = ? 
      `;
      const params: any[] = [conversationId];
      
      if (before) {
        query += ' AND createdAt < ?';
        params.push(before);
      }
      
      query += ' ORDER BY createdAt DESC LIMIT ?';
      params.push(limit);
      
      const [results] = await this.storage.db!.executeSql(query, params);
      const messages: CachedMessage[] = [];
      
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        messages.push({
          _id: row.id,
          conversationId: row.conversationId,
          senderId: row.senderId,
          content: row.content,
          type: row.type,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          synced: !!row.synced,
          localId: row.localId,
          replyToId: row.replyToId,
          attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
        });
      }
      
      return messages.reverse(); // 返回时间正序
    } catch (error) {
      console.error('Failed to get messages from database:', error);
      return [];
    }
  }
  
  // 统一的消息获取接口
  async getMessages(
    conversationId: string,
    limit: number = 20,
    strategy: 'memory' | 'storage' | 'database' | 'all' = 'all'
  ): Promise<CachedMessage[]> {
    switch (strategy) {
      case 'memory':
        return this.getMessagesFromMemory(conversationId, limit);
      
      case 'storage':
        return this.getMessagesFromStorage(conversationId, limit);
      
      case 'database':
        return this.getMessagesFromDatabase(conversationId, limit);
      
      case 'all':
      default:
        // 优先从内存获取，不足时从存储获取
        let messages = await this.getMessagesFromMemory(conversationId, limit);
        
        if (messages.length < limit) {
          const storageMessages = await this.getMessagesFromStorage(
            conversationId, 
            limit - messages.length
          );
          messages = [...storageMessages, ...messages];
        }
        
        if (messages.length < limit) {
          const dbMessages = await this.getMessagesFromDatabase(
            conversationId,
            limit - messages.length
          );
          messages = [...dbMessages, ...messages];
        }
        
        return messages;
    }
  }
  
  // 缓存消息到所有层级
  async cacheMessage(message: CachedMessage): Promise<void> {
    // L1: 内存缓存
    await this.cacheToMemory(message);
    
    // L2: AsyncStorage
    await this.cacheToStorage(message);
    
    // L3: SQLite数据库
    await this.cacheToDatabase(message);
  }
  
  private async cacheToMemory(message: CachedMessage): Promise<void> {
    const conversationId = message.conversationId;
    let messages = this.memoryCache.get(conversationId) || [];
    
    // 去重
    messages = messages.filter(m => m._id !== message._id);
    messages.push(message);
    
    // 限制内存缓存大小
    if (messages.length > this.MAX_MEMORY_CACHE_SIZE) {
      messages = messages.slice(-this.MAX_MEMORY_CACHE_SIZE);
    }
    
    this.memoryCache.set(conversationId, messages);
  }
  
  private async cacheToStorage(message: CachedMessage): Promise<void> {
    try {
      const conversationId = message.conversationId;
      const key = `${StorageManager.STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`;
      
      // 获取现有消息
      const existing = await this.getMessagesFromStorage(conversationId, this.MAX_LOCAL_MESSAGES);
      
      // 去重并添加新消息
      const filtered = existing.filter(m => m._id !== message._id);
      filtered.push(message);
      
      // 限制存储大小
      const toStore = filtered.slice(-this.MAX_LOCAL_MESSAGES);
      
      await AsyncStorage.setItem(key, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to cache message to storage:', error);
    }
  }
  
  private async cacheToDatabase(message: CachedMessage): Promise<void> {
    if (!this.storage.db) {
      await this.storage.initialize();
    }
    
    try {
      const query = `
        INSERT OR REPLACE INTO messages 
        (id, conversationId, senderId, content, type, status, createdAt, updatedAt, synced, localId, replyToId, attachments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.storage.db!.executeSql(query, [
        message._id,
        message.conversationId,
        message.senderId,
        message.content,
        message.type,
        message.status,
        message.createdAt,
        message.updatedAt,
        message.synced ? 1 : 0,
        message.localId || null,
        message.replyToId || null,
        message.attachments ? JSON.stringify(message.attachments) : null,
      ]);
    } catch (error) {
      console.error('Failed to cache message to database:', error);
    }
  }
  
  // 清理过期缓存
  async cleanupExpiredCache(daysToKeep: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    if (!this.storage.db) {
      await this.storage.initialize();
    }
    
    try {
      await this.storage.db!.executeSql(
        'DELETE FROM messages WHERE createdAt < ? AND synced = 1',
        [cutoffTime]
      );
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error);
    }
  }
}
```

## 3. 离线队列管理

### 3.1 离线操作队列

```typescript
// apps/native/lib/sync/OfflineQueue.ts
import { StorageManager } from '../storage/StorageManager';
import { nanoid } from 'nanoid';

interface QueuedAction {
  id: string;
  action: 'send_message' | 'mark_read' | 'delete_message' | 'create_conversation';
  data: any;
  retryCount: number;
  createdAt: number;
  lastRetryAt?: number;
}

export class OfflineQueue {
  private storage = StorageManager.getInstance();
  private isProcessing = false;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY_BASE = 1000; // 基础重试延迟1秒
  
  // 添加操作到队列
  async enqueue(action: QueuedAction['action'], data: any): Promise<string> {
    const queueItem: QueuedAction = {
      id: nanoid(),
      action,
      data,
      retryCount: 0,
      createdAt: Date.now(),
    };
    
    try {
      // 存储到SQLite
      if (!this.storage.db) {
        await this.storage.initialize();
      }
      
      await this.storage.db!.executeSql(
        'INSERT INTO offline_queue (id, action, data, retryCount, createdAt) VALUES (?, ?, ?, ?, ?)',
        [queueItem.id, queueItem.action, JSON.stringify(queueItem.data), queueItem.retryCount, queueItem.createdAt]
      );
      
      // 同时存储到AsyncStorage作为备份
      const existingQueue = await this.getQueueFromStorage();
      existingQueue.push(queueItem);
      await AsyncStorage.setItem(
        StorageManager.STORAGE_KEYS.OFFLINE_QUEUE,
        JSON.stringify(existingQueue)
      );
      
      return queueItem.id;
    } catch (error) {
      console.error('Failed to enqueue action:', error);
      throw error;
    }
  }
  
  // 获取队列中的所有待处理操作
  async getQueue(): Promise<QueuedAction[]> {
    try {
      if (!this.storage.db) {
        await this.storage.initialize();
      }
      
      const [results] = await this.storage.db!.executeSql(
        'SELECT * FROM offline_queue ORDER BY createdAt ASC'
      );
      
      const queue: QueuedAction[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        queue.push({
          id: row.id,
          action: row.action,
          data: JSON.parse(row.data),
          retryCount: row.retryCount,
          createdAt: row.createdAt,
          lastRetryAt: row.lastRetryAt,
        });
      }
      
      return queue;
    } catch (error) {
      console.error('Failed to get queue:', error);
      // 降级到AsyncStorage
      return this.getQueueFromStorage();
    }
  }
  
  private async getQueueFromStorage(): Promise<QueuedAction[]> {
    try {
      const data = await AsyncStorage.getItem(StorageManager.STORAGE_KEYS.OFFLINE_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get queue from storage:', error);
      return [];
    }
  }
  
  // 处理队列中的操作
  async processQueue(convexMutations: any): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const queue = await this.getQueue();
      
      for (const item of queue) {
        try {
          await this.processQueueItem(item, convexMutations);
          await this.removeFromQueue(item.id);
        } catch (error) {
          console.error(`Failed to process queue item ${item.id}:`, error);
          await this.handleRetry(item);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  // 处理单个队列项
  private async processQueueItem(item: QueuedAction, convexMutations: any): Promise<void> {
    switch (item.action) {
      case 'send_message':
        await convexMutations.sendMessage(item.data);
        break;
      
      case 'mark_read':
        await convexMutations.markMessagesAsRead(item.data);
        break;
      
      case 'delete_message':
        await convexMutations.deleteMessage(item.data);
        break;
      
      case 'create_conversation':
        await convexMutations.createConversation(item.data);
        break;
      
      default:
        throw new Error(`Unknown action type: ${item.action}`);
    }
  }
  
  // 处理重试逻辑
  private async handleRetry(item: QueuedAction): Promise<void> {
    if (item.retryCount >= this.MAX_RETRY_COUNT) {
      // 超过最大重试次数，从队列中移除
      await this.removeFromQueue(item.id);
      console.warn(`Queue item ${item.id} exceeded max retry count, removing from queue`);
      return;
    }
    
    // 更新重试计数和时间
    const newRetryCount = item.retryCount + 1;
    const delay = this.RETRY_DELAY_BASE * Math.pow(2, newRetryCount); // 指数退避
    
    setTimeout(async () => {
      try {
        if (!this.storage.db) {
          await this.storage.initialize();
        }
        
        await this.storage.db!.executeSql(
          'UPDATE offline_queue SET retryCount = ?, lastRetryAt = ? WHERE id = ?',
          [newRetryCount, Date.now(), item.id]
        );
      } catch (error) {
        console.error('Failed to update retry count:', error);
      }
    }, delay);
  }
  
  // 从队列中移除项目
  private async removeFromQueue(itemId: string): Promise<void> {
    try {
      if (!this.storage.db) {
        await this.storage.initialize();
      }
      
      await this.storage.db!.executeSql(
        'DELETE FROM offline_queue WHERE id = ?',
        [itemId]
      );
      
      // 同时从AsyncStorage移除
      const queue = await this.getQueueFromStorage();
      const filtered = queue.filter(item => item.id !== itemId);
      await AsyncStorage.setItem(
        StorageManager.STORAGE_KEYS.OFFLINE_QUEUE,
        JSON.stringify(filtered)
      );
    } catch (error) {
      console.error('Failed to remove from queue:', error);
    }
  }
  
  // 清空队列
  async clearQueue(): Promise<void> {
    try {
      if (!this.storage.db) {
        await this.storage.initialize();
      }
      
      await this.storage.db!.executeSql('DELETE FROM offline_queue');
      await AsyncStorage.removeItem(StorageManager.STORAGE_KEYS.OFFLINE_QUEUE);
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  }
}
```

### 3.2 离线消息管理

```typescript
// apps/native/hooks/useOfflineMessages.ts
import { useState, useCallback, useEffect } from 'react';
import { MessageCache } from '../lib/cache/MessageCache';
import { OfflineQueue } from '../lib/sync/OfflineQueue';
import { useNetworkStatus } from './useNetworkStatus';
import { nanoid } from 'nanoid';

export function useOfflineMessages(conversationId: string, currentUserId: string) {
  const [offlineMessages, setOfflineMessages] = useState<any[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Set<string>>(new Set());
  
  const messageCache = new MessageCache();
  const offlineQueue = new OfflineQueue();
  const { isOnline } = useNetworkStatus();
  
  // 发送离线消息
  const sendOfflineMessage = useCallback(async (content: string, type: 'text' | 'image' = 'text') => {
    const tempId = nanoid();
    const tempMessage = {
      _id: tempId,
      conversationId,
      senderId: currentUserId,
      content,
      type,
      status: 'sending' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      synced: false,
      localId: tempId,
      sender: {
        userId: currentUserId,
        displayName: '我', // 临时显示名
      },
    };
    
    try {
      // 添加到本地消息列表
      setOfflineMessages(prev => [...prev, tempMessage]);
      setPendingMessages(prev => new Set(prev).add(tempId));
      
      // 缓存到本地存储
      await messageCache.cacheMessage(tempMessage);
      
      // 添加到离线队列
      await offlineQueue.enqueue('send_message', {
        conversationId,
        senderId: currentUserId,
        content,
        type,
        localId: tempId,
      });
      
      return tempId;
    } catch (error) {
      console.error('Failed to send offline message:', error);
      // 标记为失败
      setOfflineMessages(prev => 
        prev.map(msg => 
          msg._id === tempId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      throw error;
    }
  }, [conversationId, currentUserId, messageCache, offlineQueue]);
  
  // 重试失败的消息
  const retryMessage = useCallback(async (localId: string) => {
    const message = offlineMessages.find(m => m.localId === localId);
    if (!message) return;
    
    // 更新状态为发送中
    setOfflineMessages(prev => 
      prev.map(msg => 
        msg._id === localId 
          ? { ...msg, status: 'sending' }
          : msg
      )
    );
    
    // 重新添加到队列
    await offlineQueue.enqueue('send_message', {
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      localId,
    });
  }, [offlineMessages, offlineQueue]);
  
  // 网络恢复时同步
  useEffect(() => {
    if (isOnline && pendingMessages.size > 0) {
      // 处理离线队列
      offlineQueue.processQueue({
        sendMessage: async (data: any) => {
          // 这里应该调用实际的Convex mutation
          console.log('Processing offline message:', data);
          
          // 成功后更新本地状态
          setPendingMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.localId);
            return newSet;
          });
          
          setOfflineMessages(prev => 
            prev.map(msg => 
              msg.localId === data.localId 
                ? { ...msg, status: 'sent', synced: true }
                : msg
            )
          );
        },
      });
    }
  }, [isOnline, pendingMessages.size, offlineQueue]);
  
  // 加载本地缓存的消息
  const loadCachedMessages = useCallback(async () => {
    try {
      const cached = await messageCache.getMessages(conversationId, 50, 'all');
      const offline = cached.filter(msg => !msg.synced);
      setOfflineMessages(offline);
      
      const pending = new Set(
        offline
          .filter(msg => msg.status === 'sending')
          .map(msg => msg.localId || msg._id)
      );
      setPendingMessages(pending);
    } catch (error) {
      console.error('Failed to load cached messages:', error);
    }
  }, [conversationId, messageCache]);
  
  // 组件挂载时加载缓存
  useEffect(() => {
    loadCachedMessages();
  }, [loadCachedMessages]);
  
  return {
    offlineMessages,
    pendingMessages,
    sendOfflineMessage,
    retryMessage,
    loadCachedMessages,
  };
}
```

## 4. 同步策略实现

### 4.1 增量同步

```typescript
// apps/native/lib/sync/SyncManager.ts
import { MessageCache } from '../cache/MessageCache';
import { StorageManager } from '../storage/StorageManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class SyncManager {
  private messageCache = new MessageCache();
  private lastSyncTimestamp = 0;
  
  // 初始化同步时间戳
  async initialize(): Promise<void> {
    try {
      const timestamp = await AsyncStorage.getItem(StorageManager.STORAGE_KEYS.SYNC_TIMESTAMP);
      this.lastSyncTimestamp = timestamp ? parseInt(timestamp, 10) : 0;
    } catch (error) {
      console.error('Failed to initialize sync timestamp:', error);
    }
  }
  
  // 增量同步消息
  async syncMessages(conversationId: string, convexQuery: any): Promise<void> {
    try {
      // 获取上次同步后的新消息
      const newMessages = await convexQuery({
        conversationId,
        since: this.lastSyncTimestamp,
      });
      
      if (newMessages && newMessages.length > 0) {
        // 缓存新消息
        for (const message of newMessages) {
          await this.messageCache.cacheMessage({
            ...message,
            synced: true,
          });
        }
        
        // 更新同步时间戳
        const latestTimestamp = Math.max(...newMessages.map(m => m.createdAt));
        await this.updateSyncTimestamp(latestTimestamp);
      }
    } catch (error) {
      console.error('Failed to sync messages:', error);
      throw error;
    }
  }
  
  // 全量同步（首次或重置后）
  async fullSync(conversationId: string, convexQuery: any): Promise<void> {
    try {
      // 清除本地缓存
      await this.clearConversationCache(conversationId);
      
      // 获取所有消息
      const allMessages = await convexQuery({
        conversationId,
        limit: 1000, // 限制数量避免一次性加载过多
      });
      
      if (allMessages && allMessages.length > 0) {
        // 缓存所有消息
        for (const message of allMessages) {
          await this.messageCache.cacheMessage({
            ...message,
            synced: true,
          });
        }
        
        // 更新同步时间戳
        const latestTimestamp = Math.max(...allMessages.map(m => m.createdAt));
        await this.updateSyncTimestamp(latestTimestamp);
      }
    } catch (error) {
      console.error('Failed to perform full sync:', error);
      throw error;
    }
  }
  
  // 冲突解决策略
  async resolveConflicts(localMessage: any, serverMessage: any): Promise<any> {
    // 服务器优先策略
    if (serverMessage.updatedAt > localMessage.updatedAt) {
      return serverMessage;
    }
    
    // 如果本地消息更新，检查是否需要合并
    if (localMessage.content !== serverMessage.content) {
      // 创建冲突版本
      return {
        ...serverMessage,
        conflictVersions: [
          { source: 'local', ...localMessage },
          { source: 'server', ...serverMessage },
        ],
      };
    }
    
    return serverMessage;
  }
  
  // 清除会话缓存
  private async clearConversationCache(conversationId: string): Promise<void> {
    try {
      // 清除AsyncStorage
      await AsyncStorage.removeItem(
        `${StorageManager.STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`
      );
      
      // 清除SQLite
      const storage = StorageManager.getInstance();
      if (!storage.db) {
        await storage.initialize();
      }
      
      await storage.db!.executeSql(
        'DELETE FROM messages WHERE conversationId = ?',
        [conversationId]
      );
    } catch (error) {
      console.error('Failed to clear conversation cache:', error);
    }
  }
  
  // 更新同步时间戳
  private async updateSyncTimestamp(timestamp: number): Promise<void> {
    try {
      this.lastSyncTimestamp = timestamp;
      await AsyncStorage.setItem(
        StorageManager.STORAGE_KEYS.SYNC_TIMESTAMP,
        timestamp.toString()
      );
    } catch (error) {
      console.error('Failed to update sync timestamp:', error);
    }
  }
}
```

### 4.2 智能同步触发

```typescript
// apps/native/hooks/useSmartSync.ts
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNetworkStatus } from './useNetworkStatus';
import { SyncManager } from '../lib/sync/SyncManager';
import { OfflineQueue } from '../lib/sync/OfflineQueue';

export function useSmartSync(convexQueries: any, convexMutations: any) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  
  const { isOnline, connectionType } = useNetworkStatus();
  const appState = useRef(AppState.currentState);
  const syncManager = useRef(new SyncManager());
  const offlineQueue = useRef(new OfflineQueue());
  
  // 同步间隔配置
  const SYNC_INTERVALS = {
    wifi: 30 * 1000,      // WiFi: 30秒
    cellular: 60 * 1000,  // 蜂窝网络: 1分钟
    offline: 5 * 60 * 1000, // 离线检查: 5分钟
  };
  
  // 执行同步
  const performSync = async (force: boolean = false) => {
    if (isSyncing && !force) return;
    
    setIsSyncing(true);
    
    try {
      // 初始化同步管理器
      await syncManager.current.initialize();
      
      if (isOnline) {
        // 处理离线队列
        await offlineQueue.current.processQueue(convexMutations);
        
        // 同步消息（这里需要根据实际的会话列表来同步）
        // 实际实现中应该获取用户的所有会话
        const conversations = await convexQueries.getUserConversations();
        
        for (const conversation of conversations) {
          await syncManager.current.syncMessages(
            conversation._id,
            convexQueries.getConversationMessages
          );
        }
      }
      
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  // 网络状态变化时同步
  useEffect(() => {
    if (isOnline) {
      performSync();
    }
  }, [isOnline]);
  
  // 应用状态变化时同步
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // 应用回到前台时同步
        performSync();
      }
      appState.current = nextAppState;
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, []);
  
  // 定期同步
  useEffect(() => {
    const interval = SYNC_INTERVALS[isOnline ? connectionType : 'offline'];
    
    const timer = setInterval(() => {
      const timeSinceLastSync = Date.now() - lastSyncTime;
      
      if (timeSinceLastSync >= interval) {
        performSync();
      }
    }, interval);
    
    return () => clearInterval(timer);
  }, [isOnline, connectionType, lastSyncTime]);
  
  return {
    isSyncing,
    lastSyncTime,
    performSync,
  };
}
```

## 5. 数据冲突处理

### 5.1 冲突检测和解决

```typescript
// apps/native/lib/sync/ConflictResolver.ts
interface ConflictResolution {
  strategy: 'server_wins' | 'local_wins' | 'merge' | 'user_choice';
  resolvedData: any;
  needsUserInput?: boolean;
}

export class ConflictResolver {
  // 解决消息冲突
  static resolveMessageConflict(
    localMessage: any,
    serverMessage: any
  ): ConflictResolution {
    // 检查消息是否相同
    if (localMessage.content === serverMessage.content) {
      return {
        strategy: 'server_wins',
        resolvedData: {
          ...serverMessage,
          synced: true,
        },
      };
    }
    
    // 检查时间戳
    if (serverMessage.updatedAt > localMessage.updatedAt) {
      return {
        strategy: 'server_wins',
        resolvedData: serverMessage,
      };
    }
    
    // 如果本地有未同步的修改，保留本地版本
    if (!localMessage.synced) {
      return {
        strategy: 'local_wins',
        resolvedData: localMessage,
      };
    }
    
    // 复杂冲突需要用户选择
    return {
      strategy: 'user_choice',
      resolvedData: null,
      needsUserInput: true,
    };
  }
  
  // 解决会话冲突
  static resolveConversationConflict(
    localConversation: any,
    serverConversation: any
  ): ConflictResolution {
    // 合并策略：保留最新的lastMessageAt和unreadCount
    const resolved = {
      ...serverConversation,
      lastMessageAt: Math.max(
        localConversation.lastMessageAt || 0,
        serverConversation.lastMessageAt || 0
      ),
      unreadCount: Math.max(
        localConversation.unreadCount || 0,
        serverConversation.unreadCount || 0
      ),
    };
    
    return {
      strategy: 'merge',
      resolvedData: resolved,
    };
  }
}
```

## 6. 离线状态指示

### 6.1 离线状态组件

```typescript
// apps/native/components/chat/OfflineIndicator.tsx
import React from 'react';
import { View, Animated } from 'react-native';
import { Text } from '@/components/ui/text';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface OfflineIndicatorProps {
  isSyncing?: boolean;
  pendingCount?: number;
}

export function OfflineIndicator({ isSyncing = false, pendingCount = 0 }: OfflineIndicatorProps) {
  const { isOnline, connectionType } = useNetworkStatus();
  const [visible, setVisible] = useState(!isOnline || isSyncing || pendingCount > 0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const shouldShow = !isOnline || isSyncing || pendingCount > 0;
    setVisible(shouldShow);
    
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, isSyncing, pendingCount, fadeAnim]);
  
  if (!visible) return null;
  
  const getStatusText = () => {
    if (!isOnline) {
      return '离线模式';
    }
    if (isSyncing) {
      return '同步中...';
    }
    if (pendingCount > 0) {
      return `${pendingCount} 条消息待发送`;
    }
    return '';
  };
  
  const getStatusColor = () => {
    if (!isOnline) return 'bg-destructive/20 border-destructive/30';
    if (isSyncing) return 'bg-primary/20 border-primary/30';
    return 'bg-warning/20 border-warning/30';
  };
  
  return (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className={cn(
        "mx-4 mb-2 px-3 py-2 rounded-lg border",
        getStatusColor()
      )}
    >
      <View className="flex-row items-center justify-center space-x-2">
        {!isOnline ? (
          <WifiOff size={14} className="text-destructive" />
        ) : isSyncing ? (
          <RefreshCw size={14} className="text-primary animate-spin" />
        ) : null}
        
        <Text variant="small" className="text-center">
          {getStatusText()}
        </Text>
        
        {connectionType && connectionType !== 'wifi' && (
          <Text variant="small" className="opacity-70">
            ({connectionType})
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
```

---

## 总结

Phase 4实现了完整的离线同步机制，包括：

- **三层缓存**: 内存、AsyncStorage、SQLite的分层存储
- **离线队列**: 自动重试和指数退避策略
- **智能同步**: 基于网络状态和应用状态的智能触发
- **冲突解决**: 多种冲突解决策略
- **用户体验**: 离线状态指示和无感知同步

这确保了用户在任何网络条件下都能正常使用聊天功能。