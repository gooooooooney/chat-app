# 图片消息完整实现方案

## 实施完成 ✅

### 第一步：前端图片渲染支持 ✅

**文件：`apps/native/components/chat/ChatMessageList.tsx`**
- ✅ 添加 `ImageMessageBubble` 组件导入
- ✅ 扩展 `Message` 接口，支持图片字段
- ✅ 根据 `type === 'image'` 条件渲染图片组件

**文件：`apps/native/components/chat/ImageMessageBubble.tsx`**
- ✅ 支持本地图片URI（`localImageUri`）
- ✅ 上传中显示本地图片 + 蒙层
- ✅ 失败时左上角显示"失败"标签

**文件：`apps/native/hooks/useImageUpload.ts`**
- ✅ 乐观更新时保存 `localImageUri`

### 第二步：后端图片URL生成 ✅

**Convex 环境变量配置：**
```bash
R2_PUBLIC_URL=https://chat-app.gooney.app
```

**文件：`packages/backend/convex/v1/messages.ts`**
- ✅ 使用 `R2_PUBLIC_URL` 环境变量拼接图片URL
- ✅ URL格式：`https://chat-app.gooney.app/{imageKey}`
- ✅ 回退机制：如果环境变量不存在，使用 R2 presigned URL

**关键代码：**
```typescript
let imageUrl: string | undefined;
if (message.imageKey) {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    imageUrl = `${publicUrl}/${message.imageKey}`;
  } else {
    // 回退到 R2 presigned URL
    imageUrl = await r2.getUrl(message.imageKey);
  }
}
```

### 第三步：前端数据映射 ✅

**文件：`apps/native/components/chat/ChatScreen.tsx`**
- ✅ `transformedMessages` 映射所有图片字段：
  - `imageUrl` - 从后端返回的完整图片URL
  - `imageMetadata` - 图片元数据（宽高、大小、类型）
  - `uploadStatus` - 上传状态（uploading/completed/failed）
  - `localImageUri` - 本地图片URI（上传中使用）

## 完整数据流

### 1. 上传流程

```
选择图片 → 乐观更新(localImageUri) → 上传R2 → 同步元数据 → 创建消息(imageKey) → 返回imageUrl
```

**乐观更新消息：**
```json
{
  "_id": "temp_img_xxx",
  "type": "image",
  "uploadStatus": "uploading",
  "localImageUri": "file:///path/to/local/image.jpg",
  "imageMetadata": { "width": 800, "height": 600, "size": 102400, "mimeType": "image/jpeg" }
}
```

**上传成功后的消息：**
```json
{
  "_id": "real_message_id",
  "type": "image",
  "uploadStatus": "completed",
  "imageUrl": "https://chat-app.gooney.app/uuid-image-key",
  "imageMetadata": { "width": 800, "height": 600, "size": 102400, "mimeType": "image/jpeg" }
}
```

### 2. 显示逻辑

**ImageMessageBubble 组件：**
```typescript
const imageSource = message.status === 'uploading' && message.localImageUri
  ? message.localImageUri  // 上传中：显示本地图片
  : message.imageUrl;      // 完成：显示R2图片
```

### 3. 状态展示

| 状态 | 图片源 | 蒙层 | 标签 | 说明 |
|------|--------|------|------|------|
| **上传中** | `localImageUri` | 黑色半透明 + 加载动画 | "正在上传中..." | 用户立即看到本地图片 |
| **加载中** | `imageUrl` | 黑色半透明 + 加载动画 | - | 从R2下载图片 |
| **成功** | `imageUrl` | - | 右下角时间戳 | 正常显示 |
| **失败** | `localImageUri` | 红色半透明 | 左上角"失败" + 中央警告 | 点击重试 |

## R2 公共访问配置

### 环境变量
```bash
R2_PUBLIC_URL=https://chat-app.gooney.app
R2_BUCKET=chat-app
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

### Cloudflare R2 自定义域名设置
1. R2 Dashboard → 选择 bucket `chat-app`
2. Settings → Public Access → Custom Domains
3. 添加域名：`chat-app.gooney.app`
4. 在 DNS 添加 CNAME 记录指向 R2 endpoint

### URL 格式对比
- **自定义域名**: `https://chat-app.gooney.app/{imageKey}`
- **R2 Presigned URL**: `https://<account-id>.r2.cloudflarestorage.com/...` (有过期时间)

## 聊天列表显示

**ChatListItem 保持文字展示** ✅
- 底部显示："[图片]" 文字
- 不直接展示图片缩略图
- 保持简洁的列表体验

## 测试要点

### 上传测试
```bash
# 1. 选择图片
# 2. 立即显示本地图片（带"正在上传中..."蒙层）
# 3. 上传成功后显示R2图片
# 4. 模拟失败：左上角"失败"标签 + 点击重试
```

### URL验证
```bash
# 检查返回的消息数据
console.log(message.imageUrl)
# 应该输出: https://chat-app.gooney.app/<uuid-key>
```

### 环境验证
```bash
npx convex env list | grep R2_PUBLIC_URL
# 应该输出: R2_PUBLIC_URL=https://chat-app.gooney.app
```

## 已部署

✅ 后端代码已部署到 dev 环境
✅ 环境变量已配置
✅ 前端已同步更新

## 下一步优化建议

1. **图片优化**
   - [ ] 生成缩略图（不同尺寸）
   - [ ] 压缩上传前的图片
   - [ ] 支持webp格式

2. **用户体验**
   - [ ] 上传进度条（0-100%）
   - [ ] 图片预览/放大
   - [ ] 多图上传

3. **性能优化**
   - [ ] 图片懒加载
   - [ ] CDN缓存策略
   - [ ] 预加载即将显示的图片

---

**实施状态：全部完成 ✅**
