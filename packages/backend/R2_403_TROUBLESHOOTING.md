# R2 403 Forbidden 错误排查

## 错误信息
```
上传到 R2 失败: 403 Forbidden
```

## 可能原因

### 1. R2 API Token 权限不足 ⭐ 最可能

**检查步骤：**
1. 登录 Cloudflare Dashboard
2. 进入 **R2** → **Manage R2 API Tokens**
3. 找到你正在使用的 API Token
4. 确认权限设置

**需要的权限：**
- ✅ **Object Read & Write** (必需)
- ✅ **适用于特定桶** 或 **所有桶**

**修复方法：**
如果权限不足，创建新的 API Token：
```bash
# 1. 在 Cloudflare 创建新 Token，权限选择：
#    - Permissions: Object Read & Write
#    - R2 Buckets: Specific bucket → chat-app

# 2. 获取新的 Token 信息后，更新 Convex 环境变量：
npx convex env set R2_ACCESS_KEY_ID <new-access-key-id>
npx convex env set R2_SECRET_ACCESS_KEY <new-secret-access-key>
npx convex env set R2_TOKEN <new-token>
```

### 2. CORS 策略未配置

如果从浏览器直接上传（通过 presigned URL），需要 CORS 配置。

**检查步骤：**
1. Cloudflare Dashboard → R2 → 选择桶 `chat-app`
2. **Settings** → **CORS Policy**

**配置示例：**
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://your-domain.com"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**注意：**
- Convex 后端调用不受 CORS 限制
- 但如果使用 presigned URL 从浏览器上传，必须配置 CORS

### 3. Bucket 不存在或名称错误

**检查：**
```bash
npx convex env list | grep R2_BUCKET
```

确认输出为：
```
R2_BUCKET=chat-app
```

在 Cloudflare 确认桶名确实是 `chat-app`。

### 4. Endpoint 配置错误

虽然已经修复，但再次确认：

```bash
npx convex env list | grep R2_ENDPOINT
```

应该看到：
```
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

**不应该**是：
- ❌ `https://pub-xxx.r2.dev`
- ❌ 包含 bucket 名称的 URL

## 诊断步骤

### 步骤 1: 检查所有环境变量

```bash
npx convex env list | grep R2
```

期望输出：
```
R2_ACCESS_KEY_ID=<32-char-hex>
R2_BUCKET=chat-app
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_SECRET_ACCESS_KEY=<64-char-hex>
R2_TOKEN=<your-token>
```

### 步骤 2: 验证 API Token

在 Cloudflare 控制台：
1. R2 → Manage R2 API Tokens
2. 找到你的 Token
3. 检查：
   - ✅ Status: Active
   - ✅ Permissions: Object Read & Write
   - ✅ Buckets: 包含 chat-app 或 All buckets

### 步骤 3: 测试 Token（可选）

使用 AWS CLI 测试（如果安装了）：

```bash
# 配置 AWS CLI 使用 R2
aws configure set aws_access_key_id <R2_ACCESS_KEY_ID>
aws configure set aws_secret_access_key <R2_SECRET_ACCESS_KEY>

# 测试列出桶内容
aws s3 ls s3://chat-app --endpoint-url=https://<account-id>.r2.cloudflarestorage.com
```

### 步骤 4: 创建新的 API Token（如果需要）

1. Cloudflare Dashboard → R2 → **Manage R2 API Tokens**
2. **Create API Token**
3. 设置：
   - **Token Name**: `convex-chat-app`
   - **Permissions**: `Object Read & Write`
   - **TTL**: 根据需要（建议至少 1 年）
   - **R2 Buckets**:
     - 选择 **Specific bucket**
     - 勾选 `chat-app`
4. 点击 **Create API Token**
5. **重要**：立即复制并保存：
   - Access Key ID
   - Secret Access Key
6. 更新 Convex 环境变量（见上方命令）

### 步骤 5: 配置 CORS（如果需要浏览器上传）

在 `chat-app` 桶设置中添加 CORS 策略：

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

**生产环境**应该限制特定域名：
```json
[
  {
    "AllowedOrigins": [
      "https://your-app.com",
      "https://www.your-app.com"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

## 运行测试

修复后重新运行：

```bash
npx convex run v1/testR2Complete:runAllTests
```

## 常见问题

### Q: 为什么本地测试也需要 Token？
A: Convex 后端运行在云端，即使你在本地开发，实际的 API 调用也是从 Convex 服务器发出的。

### Q: Token 是否会过期？
A: 是的，Token 有 TTL（Time To Live）设置。如果过期，需要创建新 Token。

### Q: 是否需要重启 Convex？
A: 更新环境变量后，正在运行的 `npx convex dev` 会自动重新加载。如果没有运行，则在下次启动时生效。

### Q: 如何确认 Token 是否有效？
A: 最简单的方法是在 Cloudflare 控制台检查 Token 状态为 "Active"。

## 预期结果

配置正确后，运行测试应该看到：
```
✅ 测试 1: 基础上传流程 - 测试通过
✅ 测试 2: 列出图片 - 成功列出 X 张图片
✅ 测试 3: 图片元数据验证 - 元数据验证通过
✅ 测试 4: 更新图片标题 - 标题更新成功
✅ 测试 5: 清理测试数据 - 清理完成
```

## 下一步

如果问题仍然存在：
1. 检查 Convex 日志：`npx convex logs`
2. 查看详细的错误堆栈
3. 确认 Cloudflare R2 服务状态：https://www.cloudflarestatus.com/
