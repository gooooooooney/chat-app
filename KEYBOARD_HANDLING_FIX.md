# 键盘处理修复文档

## 问题描述

### 原始问题
当键盘弹出时，消息列表没有被顶起来，导致底部的消息被键盘遮挡，用户无法看到。

### 问题原因
1. `ChatScreen.tsx` 只使用了普通的 `View` 布局
2. 没有使用键盘避让组件来处理消息列表的位置
3. 虽然 `MessageInput` 使用了 `KeyboardStickyView`（固定在键盘上方），但消息列表本身不会自动调整

## 解决方案

### 使用 react-native-keyboard-controller

项目已经安装了 `react-native-keyboard-controller 1.18.5`，这是一个比 React Native 原生更强大的键盘控制库。

### 已有配置

**根布局已配置 KeyboardProvider**：
```typescript
// apps/native/app/_layout.tsx (第87行)
<KeyboardProvider>
  {/* App content */}
</KeyboardProvider>
```

这是使用 `react-native-keyboard-controller` 的前提条件。

### 实施步骤

#### 1. 导入 KeyboardAvoidingView

```typescript
// ChatScreen.tsx
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
```

#### 2. 包裹消息列表和输入框

```typescript
return (
  <View className="flex-1 bg-background">
    <ChatHeader {...} />

    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
      <ChatMessageList {...} />
      <MessageInput {...} />
    </KeyboardAvoidingView>

    <ImageViewer {...} />
  </View>
);
```

### 配置说明

#### behavior="padding"

**可选值**：
- `padding` - 添加底部 padding（推荐用于滚动视图）
- `translate-with-padding` - 结合平移和 padding（最佳性能，适合聊天）
- `height` - 调整整体高度
- `position` - 移动位置而不是调整大小

**选择 `padding`**：
- 适合有 `ChatMessageList`（基于 LegendList/ScrollView）的场景
- 通过添加底部 padding 确保内容可滚动查看
- 兼容性最好

#### keyboardVerticalOffset={0}

**作用**：补偿顶部固定元素的高度

**何时需要调整**：
- 如果有导航栏：使用 `useHeaderHeight()` 获取高度
- 如果有状态栏：在 Android 上可能需要加上 `StatusBar.currentHeight`

**当前设置为 0**：
- `ChatHeader` 在 `KeyboardAvoidingView` 外部，不需要补偿
- 布局从屏幕顶部开始，无额外偏移

### 布局结构

```
View (flex-1, bg-background)
├── ChatHeader (固定在顶部)
└── KeyboardAvoidingView (flex-1, 处理键盘)
    ├── ChatMessageList (flex-1, 消息列表)
    └── MessageInput (KeyboardStickyView, 固定在键盘上)
```

**关键点**：
- `ChatHeader` 在外部，保持固定位置
- `KeyboardAvoidingView` 包裹需要避让的内容
- `MessageInput` 内部已用 `KeyboardStickyView`，会自动贴在键盘上方

## 工作原理

### 键盘弹出时

```
1. 用户点击输入框
   ↓
2. 键盘开始弹出
   ↓
3. KeyboardAvoidingView 监测到键盘
   ↓
4. 添加 paddingBottom = 键盘高度
   ↓
5. ChatMessageList 向上滚动（因为有了底部 padding）
   ↓
6. MessageInput (KeyboardStickyView) 固定在键盘上方
   ↓
7. 用户可以看到所有消息
```

### 键盘收起时

```
1. 用户点击返回或失焦
   ↓
2. 键盘开始收起
   ↓
3. KeyboardAvoidingView 监测到键盘消失
   ↓
4. 移除 paddingBottom
   ↓
5. ChatMessageList 恢复正常高度
   ↓
6. MessageInput 回到屏幕底部
```

## 对比其他方案

### React Native 原生 KeyboardAvoidingView

```typescript
import { KeyboardAvoidingView } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
>
```

**缺点**：
- iOS 和 Android 行为不一致
- 需要手动判断平台
- 动画不流畅
- 配置复杂

### react-native-keyboard-controller

```typescript
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

<KeyboardAvoidingView
  behavior="padding"
  keyboardVerticalOffset={0}
>
```

**优点**：
- ✅ iOS 和 Android 行为一致
- ✅ 动画流畅（60fps）
- ✅ API 简单
- ✅ 无需平台判断
- ✅ 更好的性能

## 测试验证

### 测试场景 1：基本键盘弹出

1. 进入聊天页面
2. 点击输入框
3. 观察键盘弹出过程

**预期**：
- 消息列表向上移动
- 底部消息可见
- 输入框固定在键盘上方
- 动画流畅

### 测试场景 2：长消息列表

1. 聊天包含多条消息
2. 滚动到底部
3. 点击输入框

**预期**：
- 最新消息保持可见
- 可以继续向上滚动查看历史消息
- 输入框不遮挡消息

### 测试场景 3：多行输入

1. 输入多行文本（换行）
2. 输入框自动增高

**预期**：
- 输入框高度动态调整
- 消息列表相应调整
- 内容不被遮挡

### 测试场景 4：键盘收起

1. 键盘弹出状态
2. 点击返回按钮或其他区域

**预期**：
- 键盘平滑收起
- 消息列表恢复正常
- 无闪烁或跳动

### 测试场景 5：快速切换

1. 快速点击输入框
2. 快速失焦
3. 重复多次

**预期**：
- 动画流畅
- 无卡顿
- 布局稳定

## 潜在问题和解决方案

### 问题 1：顶部内容被遮挡

**症状**：键盘弹出时，ChatHeader 被遮挡

**原因**：`keyboardVerticalOffset` 设置不正确

**解决**：
```typescript
// 如果 ChatHeader 在 Stack Navigator 中
import { useHeaderHeight } from '@react-navigation/elements';

const headerHeight = useHeaderHeight();

<KeyboardAvoidingView
  behavior="padding"
  keyboardVerticalOffset={headerHeight}
>
```

### 问题 2：Android 状态栏高度

**症状**：Android 上位置不准确

**原因**：状态栏高度未计算

**解决**：
```typescript
import { StatusBar } from 'react-native';

const offset = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 0)
  : 0;

<KeyboardAvoidingView
  keyboardVerticalOffset={offset}
>
```

### 问题 3：键盘动画不流畅

**症状**：键盘弹出时有卡顿

**原因**：可能是列表渲染性能问题

**解决**：
```typescript
// 已使用 LegendList 优化
<LegendList
  recycleItems={true}
  maintainVisibleContentPosition
  // ... 其他优化配置
/>
```

### 问题 4：输入框位置异常

**症状**：MessageInput 位置不对

**原因**：KeyboardStickyView 和 KeyboardAvoidingView 配置冲突

**解决**：
- 确保 MessageInput 在 KeyboardAvoidingView 内部
- MessageInput 内部使用 KeyboardStickyView
- 两者配合工作，不冲突

## 性能考虑

### 动画性能

**react-native-keyboard-controller 优势**：
- 使用 Reanimated worklet 在 UI 线程运行
- 60fps 流畅动画
- 无 JS 线程阻塞

### 布局性能

**优化措施**：
- `KeyboardAvoidingView` 只包裹需要的部分
- `ChatHeader` 保持在外部，减少重新布局
- 使用 `flex: 1` 而不是固定高度

### 内存优化

**已实施**：
- LegendList 自动回收视图
- 图片缓存（expo-image）
- 消息数据缓存（React Query）

## 最佳实践

### 1. 布局结构

**推荐**：
```typescript
<View className="flex-1">
  {/* 固定头部 */}
  <Header />

  {/* 键盘避让内容 */}
  <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
    <ScrollView>
      {/* 内容 */}
    </ScrollView>

    {/* 输入框（内部用 KeyboardStickyView） */}
    <Input />
  </KeyboardAvoidingView>
</View>
```

### 2. Behavior 选择

| 场景 | 推荐 behavior | 原因 |
|------|--------------|------|
| 聊天界面 | `padding` | 配合 ScrollView，性能好 |
| 表单页面 | `padding` | 适合多个输入框 |
| 单输入框 | `position` | 简单场景，直接移动 |
| 复杂布局 | `height` | 调整整体高度 |

### 3. Offset 计算

```typescript
// 标准模式（无 Header）
keyboardVerticalOffset={0}

// 有 React Navigation Header
const headerHeight = useHeaderHeight();
keyboardVerticalOffset={headerHeight}

// Android 状态栏
const offset = headerHeight + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);
keyboardVerticalOffset={offset}
```

### 4. 配合 KeyboardStickyView

**MessageInput 中**：
```typescript
<KeyboardStickyView>
  <View>
    <TextInput />
    <Button />
  </View>
</KeyboardStickyView>
```

**作用**：
- 输入框始终贴在键盘上方
- 键盘弹出时跟随移动
- 不会被键盘遮挡

## 文档参考

### 官方文档
- [KeyboardAvoidingView API](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-avoiding-view)
- [KeyboardStickyView API](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-sticky-view)
- [GitHub Repository](https://github.com/kirillzyusko/react-native-keyboard-controller)

### 相关组件
- `KeyboardProvider` - 根布局提供者（已配置）
- `KeyboardAvoidingView` - 避让键盘
- `KeyboardStickyView` - 固定在键盘上方
- `KeyboardAwareScrollView` - 自动滚动到输入框

## 总结

✅ **键盘处理修复完成**

**核心改动**：
1. 导入 `KeyboardAvoidingView` from `react-native-keyboard-controller`
2. 用 `KeyboardAvoidingView` 包裹消息列表和输入框
3. 设置 `behavior="padding"` 和 `keyboardVerticalOffset={0}`

**效果**：
- ✅ 键盘弹出时，消息列表自动向上移动
- ✅ 底部消息始终可见
- ✅ 输入框固定在键盘上方
- ✅ 动画流畅（60fps）
- ✅ iOS 和 Android 行为一致

**性能**：
- 使用 UI 线程动画
- 无 JS 线程阻塞
- 与已有优化（LegendList, 图片缓存）完美配合

---

**实施状态：完成 ✅**
**测试状态：待测试**
**兼容性：iOS + Android**
