# 乐观更新机制与本地缓存同步方案

## 🚀 新手推荐方案 (强烈建议)

> **重要发现**: Convex 官方明确表示**不提供完整的离线同步机制**，建议使用第三方工具如 Replicache。

### 对于新手用户，推荐最简单有效的方案：

**🎯 最优选择：TanStack Query + AsyncStorage**

```typescript
// 简单、稳定、易维护的技术栈
✅ TanStack Query (查询缓存 + 乐观更新)
✅ AsyncStorage (持久化历史记录)  
✅ 现有 Convex API (无需修改)
❌ 不需要 SQLite (复杂度高)
❌ 不需要 TanStack DB (BETA 阶段)
```

**为什么这是最佳选择？**
1. **简单易懂**: 只需要学习 TanStack Query 一个库
2. **成熟稳定**: TanStack Query 有完善的文档和社区支持
3. **满足需求**: 完美支持离线查看历史聊天记录
4. **渐进增强**: 可以随时升级到更复杂的方案

### 🛠️ 新手实施指南 (3步搞定)

#### 第1步：安装依赖包
```bash
npm install @tanstack/query-async-storage-persister
npm install @tanstack/react-query-persist-client
# 这两个包已经在你的项目中了：
# @tanstack/react-query 
# @react-native-async-storage/async-storage
```

#### 第2步：配置查询客户端持久化
```typescript
// apps/native/app/_layout.tsx (已存在的文件)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// 创建持久化配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24小时缓存
      staleTime: 1000 * 60 * 5,    // 5分钟内数据视为新鲜
      networkMode: 'offlineFirst',  // 离线优先模式
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'chat-app-cache',
});

// 修改你的 Root Layout 组件
export default function RootLayout() {
  return (
    <ConvexBetterAuthProvider>
      <PersistQueryClientProvider 
        client={queryClient} 
        persistOptions={{ persister }}
      >
        {/* 你现有的其他 Provider */}
        <ThemeProvider>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <Slot />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </ConvexBetterAuthProvider>
  );
}
```

#### 第3步：实现消息发送的乐观更新
```typescript
// hooks/useOptimisticChat.ts (新建文件)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@chat-app/backend/convex/_generated/api';

export const useOptimisticSendMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const sendMessage = useConvexMutation(api.v1.messages.sendMessage);

  return useMutation({
    mutationFn: async (message: { 
      senderId: string; 
      content: string; 
    }) => {
      // 1. 立即更新 UI (乐观更新)
      const optimisticMessage = {
        _id: `temp_${Date.now()}`,
        _creationTime: Date.now(),
        conversationId,
        ...message,
        status: 'sending',
        edited: false,
        deleted: false,
      };

      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: [...(old?.messages || []), optimisticMessage],
        })
      );

      // 2. 发送到服务器
      return await sendMessage({
        conversationId,
        senderId: message.senderId,
        content: message.content,
      });
    },
    onError: (error, variables) => {
      // 失败时移除乐观更新的消息
      queryClient.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => ({
          ...old,
          messages: old?.messages?.filter((msg: any) => 
            !(msg._id.startsWith('temp_') && msg.content === variables.content)
          ),
        })
      );
      console.error('发送消息失败:', error);
    },
    onSuccess: () => {
      // 成功后刷新数据
      queryClient.invalidateQueries({
        queryKey: ['conversation-messages', conversationId],
      });
    },
  });
};
```

#### 使用示例
```typescript
// 在你的 MessageInput 组件中使用
import { useOptimisticSendMessage } from '../hooks/useOptimisticChat';

const MessageInput = ({ conversationId, currentUserId }) => {
  const { mutate: sendMessage, isPending } = useOptimisticSendMessage(conversationId);

  const handleSend = (content: string) => {
    sendMessage({
      senderId: currentUserId,
      content: content.trim(),
    });
  };

  // 你的 UI 代码...
};
```

### ✅ 完成！你现在拥有：
- 💾 **历史记录离线查看**: AsyncStorage 自动缓存所有聊天记录
- ⚡ **即时响应**: 消息发送立即显示，无需等待网络
- 🔄 **自动同步**: 网络恢复后自动与服务器同步
- 🛡️ **错误处理**: 发送失败时自动回滚和重试

---

