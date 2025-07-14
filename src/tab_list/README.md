# Tab List 组件重构说明

## 重构概述

本次重构将原本的单文件 `App.tsx` 拆分为多个模块化组件，提高了代码的可维护性和可读性。

## 文件结构

```
src/tab_list/
├── App.tsx                 # 主应用组件
├── types.ts                # 共享类型定义
├── components/             # 组件目录
│   ├── index.ts            # 组件导出文件
│   ├── Header.tsx          # 头部组件
│   ├── Toolbar.tsx         # 工具栏组件
│   ├── GroupList.tsx       # 分组列表组件
│   ├── GroupDetailModal.tsx # 分组详情模态框
│   └── NewGroupModal.tsx   # 新建分组模态框
├── main.tsx                # 入口文件
└── tab_list.html           # HTML 模板
```

## 组件说明

### 1. Header 组件
- **功能**: 应用头部，包含标题、搜索框、新建分组按钮和设置按钮
- **文件**: `components/Header.tsx`
- **属性**: `HeaderProps`

### 2. Toolbar 组件
- **功能**: 工具栏，显示统计信息、排序选项和视图切换
- **文件**: `components/Toolbar.tsx`
- **属性**: `ToolbarProps`

### 3. GroupList 组件
- **功能**: 分组列表展示，支持网格和列表两种视图模式
- **文件**: `components/GroupList.tsx`
- **属性**: `GroupListProps`
- **子组件**: `GroupCard` (内部组件)

### 4. GroupDetailModal 组件
- **功能**: 分组详情模态框，支持查看、编辑、锁定、删除分组
- **文件**: `components/GroupDetailModal.tsx`
- **属性**: `GroupDetailModalProps`

### 5. NewGroupModal 组件
- **功能**: 新建分组模态框，允许用户创建新的标签页分组
- **文件**: `components/NewGroupModal.tsx`
- **属性**: `NewGroupModalProps`

## 类型系统

### 核心类型
- `Tab`: 标签页接口
- `Group`: 分组接口
- `Stats`: 统计信息接口
- `SortType`: 排序类型
- `ViewType`: 视图类型

### 组件属性类型
- `HeaderProps`: 头部组件属性
- `ToolbarProps`: 工具栏组件属性
- `GroupListProps`: 分组列表组件属性
- `GroupDetailModalProps`: 分组详情模态框属性
- `NewGroupModalProps`: 新建分组模态框属性

## 重构优势

1. **模块化**: 每个组件职责单一，便于维护和测试
2. **类型安全**: 使用 TypeScript 提供完整的类型定义
3. **代码复用**: 组件可以在其他地方复用
4. **可读性**: 代码结构清晰，易于理解
5. **可维护性**: 修改某个功能只需要关注对应的组件文件

## 开发指南

### 添加新组件
1. 在 `components/` 目录下创建新的组件文件
2. 在 `types.ts` 中定义组件的属性接口
3. 在 `components/index.ts` 中导出新组件
4. 在需要的地方导入并使用

### 修改现有组件
1. 找到对应的组件文件
2. 如需修改属性，同时更新 `types.ts` 中的接口定义
3. 确保类型检查通过

### 构建和测试
```bash
# 构建项目
npm run build

# 开发模式
npm run dev
```

## 注意事项

1. 所有组件都使用函数式组件和 React Hooks
2. 严格遵循 TypeScript 类型检查
3. 组件属性使用 JSDoc 注释说明
4. 保持组件的纯函数特性，避免副作用
5. 使用 Tailwind CSS 进行样式设计