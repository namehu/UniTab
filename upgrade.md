# UniTab 远程同步方案重构升级文档

## 概述

基于 `sync.md` 文档的新同步设计方案，本文档详细描述了 UniTab 远程同步系统的完整重构计划和实施步骤。

## 重构目标

- **离线优先设计**: 用户可以随时断开远程连接，在纯本地模式下无缝进行所有操作
- **智能重连机制**: 当用户重新启用同步时，系统能够智能合并离线期间的本地修改和云端的变更
- **元数据驱动**: 所有同步决策都基于元数据（最后修改时间、同步开关状态等）
- **强化冲突处理**: 优雅地处理并发修改导致的冲突，最大限度地避免数据丢失

## 需要修改的核心文件清单

### 1. 数据结构层面
- `src/types/background.d.ts` - 扩展 StorageData 接口，添加 metadata 字段
- `src/utils/storage.ts` - 更新 DEFAULT_DATA 结构，添加 sync.enabled 开关
- `src/types/sync.d.ts` - 更新同步相关类型定义

### 2. 同步逻辑层面
- `src/utils/sync/SyncManager.ts` - 重构核心同步流程，实现新的状态检查机制
- `src/utils/sync/GitHubSyncProvider.ts` - 更新远程数据检查逻辑
- `src/background.ts` - 集成实时同步功能到操作流程中

### 3. 业务逻辑层面
- `src/background.ts` - 更新数据修改时的元数据处理
- `src/background/syncIntegration.ts` - 实现新的同步触发机制

### 4. 用户界面层面
- `src/options/App.tsx` - 添加同步开关控制和重连处理UI

## 重构步骤详细说明

### 第一阶段：数据结构升级

#### 步骤 1.1: 扩展 StorageData 接口
**文件**: `src/types/background.d.ts`

**目标**: 在 StorageData 接口中添加 metadata 字段

**具体修改**:
```typescript
export interface StorageData {
  version: string;
  metadata: {
    lastModified: string;
    lastSyncTimestamp: string;
    deviceId: string;
  };
  settings: AppSettings;
  groups: TabGroup[];
}
```

#### 步骤 1.2: 更新 SyncSettings 接口
**文件**: `src/types/background.d.ts`

**目标**: 在 SyncSettings 中添加 enabled 字段

**具体修改**:
```typescript
export interface SyncSettings {
  enabled: boolean;
  provider: string | null;
  gistId: string | null;
  lastSync: string | null;
}
```

#### 步骤 1.3: 更新默认数据结构
**文件**: `src/utils/storage.ts`

**目标**: 修改 DEFAULT_DATA 以包含新的字段结构

**具体修改**:
```typescript
export const DEFAULT_DATA: StorageData = {
  version: '1.2.0',
  metadata: {
    lastModified: new Date().toISOString(),
    lastSyncTimestamp: '',
    deviceId: generateDeviceId()
  },
  settings: {
    sync: {
      enabled: false,
      provider: null,
      gistId: null,
      lastSync: null
    },
    excludeList: [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:'
    ]
  },
  groups: []
};
```

#### 步骤 1.4: 添加设备ID生成函数
**文件**: `src/utils/storage.ts`

**目标**: 添加生成唯一设备ID的函数

### 第二阶段：核心同步逻辑重构

#### 步骤 2.1: 重构 SyncManager 核心逻辑
**文件**: `src/utils/sync/SyncManager.ts`

**目标**: 实现新的同步流程，包括状态检查机制

**关键功能**:
- 在同步开始时检查 `sync.enabled` 状态
- 实现基于元数据的智能同步决策
- 强化冲突检测和三路合并算法
- 添加重连时的特殊处理逻辑

#### 步骤 2.2: 更新 GitHubSyncProvider
**文件**: `src/utils/sync/GitHubSyncProvider.ts`

**目标**: 更新远程数据检查逻辑，支持新的元数据结构

#### 步骤 2.3: 移除 RealtimeSyncManager（已完成）
**说明**: RealtimeSyncManager 已被移除，其功能直接集成到操作流程中

**目标**: 添加 enabled 状态检查，确保禁用同步时停止所有网络请求

### 第三阶段：业务集成

#### 步骤 3.1: 更新 background.ts
**文件**: `src/background.ts`

**目标**: 确保每次本地数据修改都更新 lastModified 时间戳

**关键修改**:
- 在所有数据修改操作中添加元数据更新
- 实现数据版本管理
- 添加设备ID管理

#### 步骤 3.2: 更新 syncIntegration.ts
**文件**: `src/background/syncIntegration.ts`

**目标**: 实现新的同步触发机制

**关键功能**:
- 在启动、修改、定时、重连时正确触发同步
- 实现离线模式的完全隔离
- 添加重连时的冲突处理

### 第四阶段：用户界面优化

#### 步骤 4.1: 更新选项页面
**文件**: `src/options/App.tsx`

**目标**: 添加同步开关控制和重连处理UI

**关键功能**:
- 提供清晰的启用/禁用同步选项
- 实现冲突解决用户界面
- 优化同步状态和进度提示
- 添加重连确认对话框

## 新增核心功能

### 1. 设备ID管理
- 为每个设备生成唯一标识符
- 用于冲突解决时的设备识别

### 2. 元数据管理
- lastModified: 本地数据最后修改时间
- lastSyncTimestamp: 最后成功同步时间
- deviceId: 设备唯一标识

### 3. 智能同步决策
- 基于时间戳比较的智能同步
- 离线期间的数据变更追踪
- 重连时的冲突检测和处理

### 4. 三路合并算法
- 自动合并非冲突变更
- 智能检测真正的冲突
- 提供用户选择的冲突解决方案

## 实施计划

### 阶段一：数据结构升级 (预计1-2小时)
1. 更新类型定义
2. 修改默认数据结构
3. 添加辅助函数
4. 数据迁移逻辑

### 阶段二：同步逻辑重构 (预计3-4小时)
1. 重构 SyncManager 核心逻辑
2. 更新同步提供商
3. 实现新的冲突处理机制
4. 添加状态检查逻辑

### 阶段三：业务集成 (预计2-3小时)
1. 更新后台脚本
2. 集成新的同步触发机制
3. 实现元数据管理
4. 测试离线模式

### 阶段四：用户界面优化 (预计2-3小时)
1. 更新选项页面
2. 添加同步控制界面
3. 实现冲突解决UI
4. 优化用户体验

## 测试计划

### 单元测试
- 数据结构验证
- 同步逻辑测试
- 冲突处理测试
- 元数据管理测试

### 集成测试
- 离线模式测试
- 重连场景测试
- 多设备同步测试
- 冲突解决测试

### 用户体验测试
- 界面交互测试
- 状态反馈测试
- 错误处理测试
- 性能测试

## 风险评估

### 高风险项
- 数据结构变更可能导致现有数据不兼容
- 同步逻辑重构可能引入新的bug
- 用户界面变更可能影响用户体验

### 风险缓解措施
- 实现数据迁移和向后兼容
- 充分的测试覆盖
- 渐进式发布和回滚机制
- 详细的错误日志和监控

## 成功标准

1. **功能完整性**: 所有现有功能正常工作
2. **离线优先**: 用户可以完全离线使用所有功能
3. **智能重连**: 重连时能够正确处理数据冲突
4. **用户体验**: 界面友好，操作直观
5. **数据安全**: 不会丢失用户数据
6. **性能优化**: 同步速度和响应时间满足要求

---

**注意**: 本重构涉及核心数据结构和同步逻辑的重大变更，建议在开发环境中充分测试后再部署到生产环境。