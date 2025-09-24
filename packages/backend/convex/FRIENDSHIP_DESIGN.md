# 好友关系数据库设计详解

## 核心设计理念

### 问题：如何存储双向的好友关系？

在社交应用中，好友关系是**双向**的：如果 Alice 和 Bob 是好友，那么：
- Alice 的好友列表中有 Bob
- Bob 的好友列表中有 Alice

### 传统方案的问题

#### 方案1：存储两条记录（不推荐）
```
记录1: alice -> bob  
记录2: bob -> alice
```

**问题：**
- 数据冗余：同一个关系存储两次
- 一致性风险：可能出现 alice->bob 存在但 bob->alice 不存在
- 维护复杂：删除时需要删除两条记录

#### 方案2：单向关系（不推荐）
```
只存储：alice -> bob
```

**问题：**
- 查询复杂：需要查询两个方向才能确定是否为好友
- 语义不清：谁是发起者，谁是接受者？

### 我们的解决方案：规范化存储

#### 核心思想
**将两个用户ID按字典序排列，只存储一条记录**

```typescript
// 示例：alice 和 bob 成为好友
// 无论是谁发起的好友请求，最终都存储为：
{
  user1Id: "alice",  // 字典序较小的ID
  user2Id: "bob",    // 字典序较大的ID  
  createdAt: 1234567890
}
```

#### 具体实现

```typescript
// 在所有涉及好友关系的操作中，都使用这个模式：
const [user1Id, user2Id] = [userA, userB].sort();

// 存储时
await ctx.db.insert("friendships", {
  user1Id,  // 保证是字典序较小的
  user2Id,  // 保证是字典序较大的
  createdAt: Date.now(),
});

// 查询时
const friendship = await ctx.db
  .query("friendships")
  .withIndex("by_users", (q) => q.eq("user1Id", user1Id).eq("user2Id", user2Id))
  .first();
```

## 为什么这样设计？

### 1. **数据一致性**
- 任意两个用户之间的好友关系，只有唯一的一条记录
- 不会出现数据不一致的情况

### 2. **存储效率**
- 每个好友关系只占用一条记录的存储空间
- 减少50%的存储开销

### 3. **查询简化**
- 检查好友关系：只需要一次查询
- 避免了复杂的 OR 查询逻辑

### 4. **维护简单**
- 删除好友：只需要删除一条记录
- 不用担心遗漏或重复操作

## 查询模式详解

### 1. 检查两个用户是否为好友
```typescript
const [user1Id, user2Id] = [userA, userB].sort();
const friendship = await ctx.db
  .query("friendships")
  .withIndex("by_users", (q) => q.eq("user1Id", user1Id).eq("user2Id", user2Id))
  .first();

const areFriends = !!friendship;
```

### 2. 获取某用户的所有好友
```typescript
// 用户可能出现在 user1Id 或 user2Id 位置，需要分别查询

// 情况1：目标用户ID较小，在user1Id位置
const friendships1 = await ctx.db
  .query("friendships")
  .withIndex("by_user1", (q) => q.eq("user1Id", targetUserId))
  .collect();

// 情况2：目标用户ID较大，在user2Id位置
const friendships2 = await ctx.db
  .query("friendships")
  .withIndex("by_user2", (q) => q.eq("user2Id", targetUserId))
  .collect();

// 提取好友ID
const friendIds = [
  ...friendships1.map(f => f.user2Id),  // 目标用户在user1Id，好友在user2Id
  ...friendships2.map(f => f.user1Id),  // 目标用户在user2Id，好友在user1Id
];
```

## 索引设计

```typescript
friendships: defineTable({...})
  .index("by_user1", ["user1Id"])     // 快速查找user1Id的所有关系
  .index("by_user2", ["user2Id"])     // 快速查找user2Id的所有关系  
  .index("by_users", ["user1Id", "user2Id"])  // 检查特定两用户关系
```

### 索引作用：

1. **`by_user1`**: 查找所有以某用户为"较小ID"的好友关系
2. **`by_user2`**: 查找所有以某用户为"较大ID"的好友关系
3. **`by_users`**: 精确查找两个特定用户之间的关系（防重复、检查存在性）

## 实际示例

假设有用户：`alice`, `bob`, `charlie`

### 存储示例：
```
alice + bob     -> 存储为: {user1Id: "alice", user2Id: "bob"}
alice + charlie -> 存储为: {user1Id: "alice", user2Id: "charlie"}  
bob + charlie   -> 存储为: {user1Id: "bob", user2Id: "charlie"}
```

### 查询 alice 的好友：
```typescript
// 查询1：alice 在 user1Id 位置的关系
friendships1 = [{user1Id: "alice", user2Id: "bob"}, {user1Id: "alice", user2Id: "charlie"}]
friendIds1 = ["bob", "charlie"]

// 查询2：alice 在 user2Id 位置的关系  
friendships2 = [] // 因为 "alice" 是最小的，不会出现在 user2Id 位置
friendIds2 = []

// 最终结果：alice 的好友是 ["bob", "charlie"]
```

### 查询 charlie 的好友：
```typescript
// 查询1：charlie 在 user1Id 位置的关系
friendships1 = [] // 因为 "charlie" 是最大的，不会出现在 user1Id 位置
friendIds1 = []

// 查询2：charlie 在 user2Id 位置的关系
friendships2 = [{user1Id: "alice", user2Id: "charlie"}, {user1Id: "bob", user2Id: "charlie"}]
friendIds2 = ["alice", "bob"]

// 最终结果：charlie 的好友是 ["alice", "bob"]
```

## 优势总结

1. **数据唯一性**: 每个好友关系只有一条记录
2. **存储高效**: 节省50%存储空间
3. **查询一致**: 所有操作都基于相同的排序规则
4. **维护简单**: 增删改操作逻辑清晰
5. **扩展友好**: 易于添加更多字段（如成为好友的时间、关系标签等）

这种设计在大型社交应用中被广泛使用，是处理对称关系的最佳实践。