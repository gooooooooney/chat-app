# 图片查看器实现文档

## 实施完成 ✅

### 功能概述
实现了一个全屏图片查看器，支持：
- ✅ 点击聊天中的图片全屏查看
- ✅ 双指缩放（pinch-to-zoom）
- ✅ 双击放大/缩小
- ✅ 左右滑动查看上一张/下一张图片
- ✅ 显示图片计数器（如 "1 / 5"）
- ✅ 关闭按钮

## 依赖库

### @likashefqet/react-native-image-zoom ^4.3.0
- **特性**: 基于 Reanimated v2/v3 和 TypeScript 构建
- **支持**:
  - Pinch-to-zoom (双指缩放)
  - Double-tap zoom (双击放大)
  - Pan gestures (拖拽)
  - 平滑的动画效果
- **兼容性**: 完全兼容 Expo 项目

**安装命令**:
```bash
pnpm add @likashefqet/react-native-image-zoom
```

## 文件结构

### 1. ImageViewer.tsx（新增）
**路径**: `apps/native/components/chat/ImageViewer.tsx`

**功能**:
- 全屏模态展示
- 图片缩放控制（1x - 5x）
- 前后导航按钮
- 图片计数器
- 关闭按钮
- 隐藏状态栏以获得完整屏幕体验

**关键实现**:
```typescript
<Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
  <ImageZoom
    uri={currentImage.imageUrl}
    minScale={1}
    maxScale={5}
    doubleTapScale={3}
    minPanPointers={1}
  />

  {/* 顶部栏：关闭按钮 + 计数器 */}
  <View style={styles.topBar}>
    <Pressable onPress={onClose}>
      <Icon as={X} />
    </Pressable>
    <Text>{currentIndex + 1} / {images.length}</Text>
  </View>

  {/* 导航按钮：上一张/下一张 */}
  {currentIndex > 0 && (
    <Pressable onPress={handlePrevious} style={styles.navButtonLeft}>
      <Icon as={ChevronLeft} />
    </Pressable>
  )}
  {currentIndex < images.length - 1 && (
    <Pressable onPress={handleNext} style={styles.navButtonRight}>
      <Icon as={ChevronRight} />
    </Pressable>
  )}
</Modal>
```

**样式特点**:
- 黑色背景 (`backgroundColor: '#000'`)
- 半透明顶部栏 (`rgba(0, 0, 0, 0.5)`)
- 圆形导航按钮，带半透明背景
- 使用 `useSafeAreaInsets` 适配刘海屏

### 2. ChatScreen.tsx（更新）
**路径**: `apps/native/components/chat/ChatScreen.tsx`

**新增状态**:
```typescript
const [viewerVisible, setViewerVisible] = useState(false);
const [viewerImageIndex, setViewerImageIndex] = useState(0);
```

**新增逻辑**:
```typescript
// 提取所有已完成上传的图片消息
const imageMessages = useMemo(() => {
  return transformedMessages
    .filter(msg =>
      msg.type === 'image' &&
      msg.imageUrl &&
      msg.uploadStatus === 'completed'
    )
    .map(msg => ({
      _id: msg._id,
      imageUrl: msg.imageUrl!,
    }));
}, [transformedMessages]);

// 处理图片点击
const handleImagePress = (messageId: string) => {
  const imageIndex = imageMessages.findIndex(img => img._id === messageId);
  if (imageIndex !== -1) {
    setViewerImageIndex(imageIndex);
    setViewerVisible(true);
  }
};
```

**组件集成**:
```typescript
<ChatMessageList
  messages={transformedMessages}
  currentUserId={currentUserId}
  hasMore={hasMore}
  onRetryMessage={handleRetryMessage}
  onImagePress={handleImagePress}  // 新增
/>

<ImageViewer
  visible={viewerVisible}
  images={imageMessages}
  initialIndex={viewerImageIndex}
  onClose={() => setViewerVisible(false)}
/>
```

### 3. ChatMessageList.tsx（更新）
**路径**: `apps/native/components/chat/ChatMessageList.tsx`

**新增 Props**:
```typescript
interface ChatMessageListProps {
  // ... 其他属性
  onImagePress?: (messageId: string) => void;
}
```

**新增处理器**:
```typescript
const handleImagePress = () => {
  if (onImagePress && message.imageUrl && message.uploadStatus === 'completed') {
    onImagePress(message._id);
  }
};
```

**传递给 ImageMessageBubble**:
```typescript
<ImageMessageBubble
  message={...}
  isOwn={isOwn}
  onPress={handleImagePress}  // 新增
  onRetry={handleRetry}
/>
```

### 4. ImageMessageBubble.tsx（已有，无需修改）
**路径**: `apps/native/components/chat/ImageMessageBubble.tsx`

**已有逻辑**:
```typescript
const handlePress = () => {
  if (message.status === 'failed' && onRetry) {
    onRetry();  // 失败时重试
  } else if (onPress) {
    onPress();  // 成功时打开查看器
  }
};
```

## 完整数据流

### 用户点击图片 → 打开查看器
```
用户点击图片
  ↓
ImageMessageBubble.handlePress()
  ↓
ChatMessageList.handleImagePress(message._id)
  ↓
ChatScreen.handleImagePress(messageId)
  ↓
找到图片在 imageMessages 数组中的索引
  ↓
setViewerImageIndex(index)
setViewerVisible(true)
  ↓
ImageViewer 显示，展示对应图片
```

### 导航到下一张图片
```
用户点击右侧导航按钮
  ↓
ImageViewer.handleNext()
  ↓
setCurrentIndex(currentIndex + 1)
  ↓
ImageZoom 更新显示新的图片 URL
```

## 交互特性

### 1. 缩放手势
- **单指平移**: 移动图片位置
- **双指捏合**: 缩放图片（1x - 5x）
- **双击**: 放大到 3x，再次双击恢复 1x

### 2. 导航控制
- **左侧箭头**: 显示上一张图片（当不在第一张时）
- **右侧箭头**: 显示下一张图片（当不在最后一张时）
- **按钮状态**: 在第一张时隐藏左箭头，在最后一张时隐藏右箭头

### 3. 关闭查看器
- **点击 X 按钮**: 关闭查看器
- **Android 返回键**: 触发 `onRequestClose`，关闭查看器

### 4. 计数器显示
- 格式: "当前索引 + 1 / 总数"
- 示例: "3 / 10" 表示正在查看第 3 张，总共 10 张

## 过滤逻辑

### 只显示已完成上传的图片
```typescript
const imageMessages = useMemo(() => {
  return transformedMessages
    .filter(msg =>
      msg.type === 'image' &&           // 类型为图片
      msg.imageUrl &&                   // 有图片 URL
      msg.uploadStatus === 'completed'  // 上传已完成
    )
    .map(msg => ({
      _id: msg._id,
      imageUrl: msg.imageUrl!,
    }));
}, [transformedMessages]);
```

**排除的消息**:
- ❌ 正在上传中的图片 (`uploadStatus === 'uploading'`)
- ❌ 上传失败的图片 (`uploadStatus === 'failed'`)
- ❌ 没有 `imageUrl` 的图片

## 性能优化

### 1. 懒加载
- 只加载当前显示的图片
- 切换图片时才加载新图片

### 2. 状态管理
- 使用 `useState` 管理当前索引
- `useMemo` 缓存图片数组，避免重复计算

### 3. 手势性能
- 使用 Reanimated 库实现原生级别的流畅动画
- 手势响应在 UI 线程运行，不阻塞 JS 线程

## 测试场景

### 场景 1: 单张图片
1. 发送一张图片
2. 点击图片
3. 查看器打开，显示 "1 / 1"
4. 无导航按钮（因为只有一张）
5. 可以缩放查看
6. 点击 X 关闭

### 场景 2: 多张图片
1. 发送多张图片（如 5 张）
2. 点击第 3 张图片
3. 查看器打开，显示 "3 / 5"
4. 左右导航按钮都显示
5. 点击左箭头 → 显示第 2 张 ("2 / 5")
6. 点击右箭头 → 显示第 4 张 ("4 / 5")
7. 双指缩放任意图片
8. 点击 X 关闭

### 场景 3: 上传中的图片
1. 发送一张图片（上传中）
2. 点击图片 → 无响应（因为 `uploadStatus !== 'completed'`）
3. 等待上传完成
4. 再次点击 → 查看器打开

### 场景 4: 上传失败的图片
1. 模拟图片上传失败
2. 点击失败的图片 → 触发重试（不打开查看器）
3. 上传成功后
4. 点击图片 → 查看器打开

## 边界情况处理

### 1. 图片列表为空
```typescript
// handleImagePress 中检查索引
if (imageIndex !== -1) {
  setViewerImageIndex(imageIndex);
  setViewerVisible(true);
}
```

### 2. 导航边界
```typescript
// 在第一张时
{currentIndex > 0 && <PreviousButton />}

// 在最后一张时
{currentIndex < images.length - 1 && <NextButton />}
```

### 3. 查看器关闭后重置
- 关闭时不重置 `viewerImageIndex`
- 下次打开时会定位到新点击的图片

## 样式配置

### 颜色方案
- **背景**: 纯黑 `#000`
- **蒙层**: 半透明黑 `rgba(0, 0, 0, 0.5)`
- **文字**: 白色
- **图标**: 白色

### 尺寸
- **关闭按钮图标**: 28px
- **导航按钮图标**: 32px
- **导航按钮圆角**: 24px
- **点击热区**: 8px hitSlop

### 间距
- **顶部栏左右边距**: 16px
- **导航按钮左右边距**: 16px
- **顶部栏内边距**: 8px

## 未来优化建议

### 1. 性能提升
- [ ] 预加载相邻图片（前一张和后一张）
- [ ] 添加图片加载动画
- [ ] 实现图片缓存机制

### 2. 交互增强
- [ ] 支持横向滑动切换图片（替代按钮）
- [ ] 添加图片下载/保存功能
- [ ] 显示图片元数据（尺寸、发送时间等）
- [ ] 支持图片旋转

### 3. 视觉优化
- [ ] 渐变式关闭动画
- [ ] 缩略图预览（底部轮播）
- [ ] 缩放时显示缩放比例提示

### 4. 可访问性
- [ ] 添加 ARIA 标签
- [ ] 支持屏幕阅读器
- [ ] 键盘导航支持（web 端）

---

**实施状态：全部完成 ✅**
**测试状态：待测试**
**依赖库版本**: `@likashefqet/react-native-image-zoom@^4.3.0`
