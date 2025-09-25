# 聊天首页模块 (Home Module)

该模块采用 React 最佳实践，将聊天首页功能拆分为可维护、可测试的小组件。

## 📁 目录结构

```
home/
├── README.md                      # 模块说明文档
├── index.ts                       # 统一导出文件
├── ChatListScreen.tsx             # 主屏幕组件
├── types.ts                       # TypeScript 类型定义
├── components/                    # UI 组件
│   ├── ChatHeader.tsx             # 页面标题组件
│   ├── ChatListItem.tsx           # 聊天列表项组件
│   └── GroupAvatars.tsx           # 群组头像组件
├── hooks/                         # 自定义 Hooks
│   └── useChatData.ts             # 数据获取和转换逻辑
└── utils/                         # 工具函数
    └── formatTime.ts              # 时间格式化工具
```

## 🔧 组件说明

### 🎯 **ChatListScreen.tsx**
- **职责**: 主屏幕组件，负责整体布局和状态管理
- **特点**: 简洁的逻辑，主要负责组件组合

### 🧩 **Components**

#### **ChatHeader.tsx**
- **职责**: 页面顶部标题显示
- **可复用**: 可在其他页面复用

#### **ChatListItem.tsx**
- **职责**: 单个聊天记录的显示
- **特点**: 支持群组和个人聊天的不同展示

#### **GroupAvatars.tsx**
- **职责**: 群组多头像重叠显示
- **特点**: 最多显示3个头像，自动布局

### 🔗 **Hooks**

#### **useChatData.ts**
- **职责**: 数据获取、转换和状态管理
- **特点**: 
  - 集成 Convex 查询
  - 数据格式转换
  - Loading 状态管理

### 🛠️ **Utils**

#### **formatTime.ts**
- **职责**: 时间格式化显示
- **特点**: 智能时间显示（刚刚、X分钟前、X小时前等）

### 📝 **Types**

#### **types.ts**
- **职责**: 统一的 TypeScript 类型定义
- **特点**: 所有组件共享的接口定义

## 🎨 使用方式

```typescript
// 在路由页面中使用
import { ChatListScreen } from "@/components/module/home";

export default function ChatListPage() {
  return <ChatListScreen />;
}

// 使用单个组件
import { ChatListItem, GroupAvatars } from "@/components/module/home";

// 使用自定义Hook
import { useChatData } from "@/components/module/home";

// 使用工具函数
import { formatTime } from "@/components/module/home";
```

## 🚀 优势

### **1. 可维护性**
- 单一职责原则
- 代码逻辑清晰
- 易于修改和扩展

### **2. 可复用性**
- 组件独立性强
- 便于在其他页面复用
- 统一的设计模式

### **3. 可测试性**
- 组件职责明确
- 便于单元测试
- Hook 逻辑可独立测试

### **4. 团队协作**
- 文件结构清晰
- 代码容易定位
- 便于代码审查

## 🔄 扩展指南

### **添加新组件**
1. 在 `components/` 目录下创建新组件
2. 在 `index.ts` 中导出
3. 在 `types.ts` 中添加相关类型

### **添加新功能**
1. 评估是否需要新的 Hook
2. 在 `utils/` 中添加工具函数
3. 更新相关组件

### **修改数据逻辑**
1. 主要在 `useChatData.ts` 中修改
2. 更新相关类型定义
3. 测试数据流

## 📋 TODO

- [ ] 添加单元测试
- [ ] 实现群组成员头像获取
- [ ] 优化性能和内存使用
- [ ] 添加国际化支持