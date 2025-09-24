# 好友系统使用指南

## 功能概述

该聊天应用现在支持完整的好友系统，用户可以设置自定义ID，通过ID添加好友，并且只能和好友进行私聊。

## 核心功能

### 1. 自定义用户ID

用户可以设置一个唯一的自定义ID，用于其他用户添加好友。

**规则：**
- 只能包含英文字母、数字和下划线
- 长度为3-20位
- 全局唯一

**相关API：**
```typescript
// 设置自定义ID
setCustomId(userId: string, customId: string)

// 检查ID可用性
checkCustomIdAvailability(customId: string)

// 通过自定义ID查找用户
findUserByCustomId(customId: string)
```

### 2. 好友请求系统

用户可以通过自定义ID发送好友请求，接收方可以接受或拒绝。

**相关API：**
```typescript
// 发送好友请求
sendFriendRequest(fromUserId: string, toCustomId: string, message?: string)

// 获取收到的好友请求
getReceivedFriendRequests(userId: string)

// 响应好友请求
respondToFriendRequest(requestId: Id, userId: string, action: "accept" | "reject")
```

### 3. 好友管理

用户可以查看好友列表和删除好友。

**相关API：**
```typescript
// 获取好友列表
getFriendsList(userId: string)

// 删除好友
removeFriend(userId: string, friendId: string)
```

### 4. 私聊创建

只有好友之间才能创建私聊会话。

**相关API：**
```typescript
// 通过自定义ID创建私聊（需要是好友关系）
createDirectConversationByCustomId(userId: string, targetCustomId: string)
```

## 使用流程示例

### 1. 设置自定义ID
```bash
# 用户设置自定义ID
npx convex run users:setCustomId '{"userId": "user1", "customId": "alice_chat"}'
```

### 2. 添加好友
```bash
# 通过自定义ID发送好友请求
npx convex run users:sendFriendRequest '{"fromUserId": "user2", "toCustomId": "alice_chat", "message": "Hi! I would like to be your friend."}'
```

### 3. 处理好友请求
```bash
# 查看收到的好友请求
npx convex run users:getReceivedFriendRequests '{"userId": "user1"}'

# 接受好友请求
npx convex run users:respondToFriendRequest '{"requestId": "request_id", "userId": "user1", "action": "accept"}'
```

### 4. 创建私聊
```bash
# 成为好友后可以创建私聊
npx convex run chat:createDirectConversationByCustomId '{"userId": "user1", "targetCustomId": "bob_chat"}'
```

## 数据库表结构

### userProfiles 表（扩展）
- `customId`: 自定义用户ID（可选，唯一）

### friendships 表
- `user1Id`: 用户1 ID（按字母序排列）
- `user2Id`: 用户2 ID（按字母序排列） 
- `createdAt`: 成为好友的时间

### friendRequests 表
- `fromUserId`: 发送者ID
- `toUserId`: 接收者ID
- `status`: 请求状态（pending/accepted/rejected/cancelled）
- `message`: 请求消息（可选）
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

## 安全特性

1. **唯一性保证**: 自定义ID全局唯一，不能重复
2. **格式验证**: 严格的ID格式限制，防止注入攻击
3. **权限控制**: 只有好友才能创建私聊
4. **重复检查**: 防止重复发送好友请求
5. **智能处理**: 如果对方已向你发送请求，会自动建立好友关系

## 错误处理

常见错误情况：
- ID格式不正确
- ID已被使用
- 用户不存在
- 不能添加自己为好友
- 已经是好友关系
- 重复的好友请求
- 无权限操作

所有错误都会返回描述性的错误消息，便于前端处理和用户理解。