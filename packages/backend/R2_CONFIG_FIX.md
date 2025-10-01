# R2 配置修复指南

## 问题诊断

当前配置使用了公共访问域名作为 endpoint，导致 Convex R2 组件生成错误的 URL。

### 当前配置
```bash
R2_ENDPOINT=https://pub-151f80126bfc424f8205c096769bdffc.r2.dev
R2_BUCKET=chat-app
```

### 问题表现
生成的 URL 变成了：
```
https://chat-app.pub-151f80126bfc424f8205c096769bdffc.r2.dev/<uuid>
```

## 解决方案

### 1. 获取正确的 S3 API Endpoint

访问 Cloudflare R2 控制台：
1. 进入 https://dash.cloudflare.com → R2
2. 选择桶 `chat-app`
3. 查看 **S3 API** 部分
4. 复制 **Endpoint URL**（格式：`https://<account-id>.r2.cloudflarestorage.com`）

### 2. 更新 Convex 环境变量

```bash
# 替换为你的 Cloudflare Account ID
npx convex env set R2_ENDPOINT https://<your-account-id>.r2.cloudflarestorage.com
```

**示例：**
```bash
npx convex env set R2_ENDPOINT https://abc123def456.r2.cloudflarestorage.com
```

### 3. 验证配置

```bash
# 查看当前配置
npx convex env list | grep R2

# 应该看到类似输出：
# R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# R2_BUCKET=chat-app
# R2_ACCESS_KEY_ID=xxx
# R2_SECRET_ACCESS_KEY=xxx
# R2_TOKEN=xxx
```

### 4. 运行测试

```bash
# 重新运行 R2 测试
npx convex run v1/testR2Complete:runAllTests

# 或运行单个测试
npx convex run v1/testR2Complete:testBasicUploadOnly
```

## 配置说明

### 必需的环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `R2_ENDPOINT` | S3 API endpoint | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | 桶名称 | `chat-app` |
| `R2_ACCESS_KEY_ID` | R2 API Token 的 Access Key ID | `2f4723bc...` |
| `R2_SECRET_ACCESS_KEY` | R2 API Token 的 Secret Access Key | `bcebfab2...` |
| `R2_TOKEN` | R2 API Token | `6DN_0EwQ...` |

### R2 访问方式对比

| 方式 | URL 格式 | 用途 |
|------|----------|------|
| **S3 API** | `https://<account-id>.r2.cloudflarestorage.com` | API 调用（Convex 使用） |
| **公共域名** | `https://pub-xxx.r2.dev` | 浏览器直接访问公开文件 |
| **自定义域名** | `https://your-domain.com` | 需要在 Cloudflare 配置 |

## CORS 配置

如果你的应用从浏览器直接上传文件，需要配置 CORS：

1. 在 Cloudflare R2 控制台选择桶
2. 进入 **Settings** → **CORS Policy**
3. 添加以下配置：

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://your-production-domain.com"
    ],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

## 常见问题

### Q: 为什么不能使用公共域名？
A: Convex R2 组件使用 S3 API 进行文件操作，需要 S3 兼容的 endpoint。公共域名是只读的 HTTP 访问，不支持 S3 API 调用。

### Q: 如何获取 Account ID？
A: 在 Cloudflare Dashboard 右上角可以看到，或者从 R2 S3 API endpoint 中提取。

### Q: R2_TOKEN 是什么？
A: 这是 Cloudflare R2 API Token，包含了 Access Key ID 和 Secret Access Key。在 Cloudflare R2 → Manage R2 API Tokens 中创建。

### Q: 测试失败显示 "Unauthenticated"？
A: 这是因为测试时没有登录用户。在 `r2.ts` 的 `checkUpload` 中已经添加了测试模式，允许匿名上传。如果还是失败，请确保：
1. Convex 代码已重新部署（可能需要 `npx convex dev` 重启）
2. 环境变量已正确设置

## 下一步

配置正确后，你应该能够：
1. ✅ 生成上传 URL
2. ✅ 上传文件到 R2
3. ✅ 同步元数据到数据库
4. ✅ 生成访问 URL
5. ✅ 下载和验证文件

运行测试验证：
```bash
npx convex run v1/testR2Complete:runAllTests
```
