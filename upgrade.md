# UniTab 数据存储架构升级改造方案

## 概述

本文档详细描述了 UniTab 插件数据存储架构的升级改造方案。当前架构存在本地存储分散、本地和远程数据结构不一致、冗余存储等问题。本次升级将统一数据结构，简化存储管理，提升同步效率。

**重要说明：本次升级不考虑向后兼容，将作为全新项目进行重构。**

## 当前架构问题分析

### 1. 存储分散问题
- `chrome.storage.local` 中存在多个独立存储项：
  - `data`: 主要数据（分组和设置）
  - `syncConfig`: 同步管理器配置
  - `sync_github_config`: GitHub 同步提供商配置
  - `github_user_info`: GitHub 用户信息缓存
  - `lastSyncData`: 最后同步数据缓存

### 2. 数据结构不一致
- 本地存储使用 `StorageData` 接口
- 远程同步使用 `SyncData` 接口
- 两者结构差异导致同步复杂度增加

### 3. 配置管理复杂
- 同步配置分散在多个位置
- 认证状态检查逻辑复杂
- 配置重置可能导致状态不一致

## 新架构设计

### 1. 统一数据结构

```typescript
interface UnifiedStorageData {
  // 版本信息
  version: string;
  
  // 元数据
  metadata: {
    createdAt: string;
    updatedAt: string;
    deviceId: string;
    deviceName: string;
  };
  
  // 用户设置
  settings: {
    // 基础设置
    excludeList: string[];
    autoSync: boolean;
    syncInterval: number; // 分钟
    
    // 同步配置
    sync: {
      enabled: boolean;
      provider: 'github' | 'none';
      lastSync?: string;
      
      // GitHub 配置
      github?: {
        token: string;
        gistId?: string;
        filename: string;
        userInfo?: {
          id: number;
          login: string;
          name: string;
          avatar_url: string;
        };
      };
    };
  };
  
  // 标签分组数据
  groups: TabGroup[];
}

interface TabGroup {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  tabs: TabInfo[];
}

interface TabInfo {
  title: string;
  url: string;
  favIconUrl?: string;
}
```

### 2. 存储策略

- **本地存储**：`chrome.storage.local` 中只保存一个 `unifiedData` 项
- **远程存储**：GitHub Gist 中保存相同的数据结构
- **缓存策略**：移除所有中间缓存，直接操作统一数据

## 实施步骤

### 阶段一：类型定义重构

#### 1.1 更新类型定义文件

**文件：`src/types/storage.d.ts`**（新建）
```typescript
// 定义新的统一数据结构
export interface UnifiedStorageData {
  // ... 完整接口定义
}

export interface TabGroup {
  // ... 完整接口定义
}

export interface TabInfo {
  // ... 完整接口定义
}
```

#### 1.2 删除旧类型定义

**需要删除的文件：**
- `src/types/background.d.ts` 中的 `StorageData` 接口
- `src/types/sync.d.ts` 中的 `SyncData` 接口

### 阶段二：存储管理器重构

#### 2.1 创建新的存储管理器

**文件：`src/utils/storage/UnifiedStorageManager.ts`**（新建）
```typescript
import { UnifiedStorageData, TabGroup } from '../types/storage';

export class UnifiedStorageManager {
  private static readonly STORAGE_KEY = 'unifiedData';
  
  // 获取完整数据
  static async getData(): Promise<UnifiedStorageData> {
    // 实现逻辑
  }
  
  // 保存完整数据
  static async setData(data: UnifiedStorageData): Promise<void> {
    // 实现逻辑
  }
  
  // 获取分组数据
  static async getGroups(): Promise<TabGroup[]> {
    // 实现逻辑
  }
  
  // 添加分组
  static async addGroup(group: Omit<TabGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<TabGroup> {
    // 实现逻辑
  }
  
  // 更新分组
  static async updateGroup(groupId: number, updates: Partial<TabGroup>): Promise<void> {
    // 实现逻辑
  }
  
  // 删除分组
  static async deleteGroup(groupId: number): Promise<void> {
    // 实现逻辑
  }
  
  // 获取设置
  static async getSettings(): Promise<UnifiedStorageData['settings']> {
    // 实现逻辑
  }
  
  // 更新设置
  static async updateSettings(updates: Partial<UnifiedStorageData['settings']>): Promise<void> {
    // 实现逻辑
  }
  
  // 初始化默认数据
  static async initializeDefaultData(): Promise<UnifiedStorageData> {
    // 实现逻辑
  }
  
  // 清空所有数据
  static async clearAllData(): Promise<void> {
    // 实现逻辑
  }
}
```

#### 2.2 删除旧存储管理器

**需要删除的文件：**
- `src/utils/storage.ts`

### 阶段三：同步系统重构

#### 3.1 创建新的同步管理器

**文件：`src/utils/sync/UnifiedSyncManager.ts`**（新建）
```typescript
import { UnifiedStorageData } from '../types/storage';
import { UnifiedStorageManager } from '../storage/UnifiedStorageManager';

export class UnifiedSyncManager {
  // 检查是否已配置同步
  static async isConfigured(): Promise<boolean> {
    // 实现逻辑
  }
  
  // 检查是否已认证
  static async isAuthenticated(): Promise<boolean> {
    // 实现逻辑
  }
  
  // 配置 GitHub 同步
  static async configureGitHub(token: string, gistId?: string): Promise<void> {
    // 实现逻辑
  }
  
  // 执行同步
  static async sync(): Promise<{ success: boolean; message: string }> {
    // 实现逻辑
  }
  
  // 上传到远程
  static async uploadToRemote(): Promise<void> {
    // 实现逻辑
  }
  
  // 从远程下载
  static async downloadFromRemote(): Promise<UnifiedStorageData> {
    // 实现逻辑
  }
  
  // 清除同步配置
  static async clearSyncConfig(): Promise<void> {
    // 实现逻辑
  }
  
  // 获取 GitHub 用户信息
  static async getGitHubUserInfo(): Promise<any> {
    // 实现逻辑
  }
}
```

#### 3.2 删除旧同步系统

**需要删除的文件：**
- `src/utils/sync/SyncManager.ts`
- `src/utils/sync/GitHubSyncProvider.ts`
- `src/utils/sync/` 目录下的其他文件

### 阶段四：后台脚本重构

#### 4.1 重构 background.ts

**文件：`src/background.ts`**

**主要修改：**
1. 导入新的存储和同步管理器
2. 简化 `triggerSyncIfEnabled` 函数
3. 重构标签页聚合逻辑
4. 移除所有旧的存储操作

**关键修改点：**
```typescript
// 旧代码
import { StorageManager } from './utils/storage';
import { SyncManager } from './utils/sync/SyncManager';

// 新代码
import { UnifiedStorageManager } from './utils/storage/UnifiedStorageManager';
import { UnifiedSyncManager } from './utils/sync/UnifiedSyncManager';

// 旧的同步检查
async function triggerSyncIfEnabled() {
  const syncManager = new SyncManager();
  if (await syncManager.isAuthenticated()) {
    // ...
  }
}

// 新的同步检查
async function triggerSyncIfEnabled() {
  if (await UnifiedSyncManager.isAuthenticated()) {
    await UnifiedSyncManager.sync();
  }
}
```

#### 4.2 删除旧的后台集成文件

**需要删除的文件：**
- `src/background/syncIntegration.ts`

### 阶段五：前端组件重构

#### 5.1 重构 tab_list 组件

**文件：`src/tab_list/App.tsx`**

**主要修改：**
1. 使用新的存储管理器
2. 简化数据获取逻辑
3. 更新所有 CRUD 操作

#### 5.2 重构 popup 组件

**文件：`src/popup/App.tsx`**

**主要修改：**
1. 使用新的存储管理器
2. 简化数据展示逻辑

#### 5.3 重构 options 组件

**文件：`src/options/App.tsx`**

**主要修改：**
1. 使用新的同步管理器
2. 简化同步配置界面
3. 移除分散的配置项

### 阶段六：工具函数重构

#### 6.1 重构标签页工具

**文件：`src/utils/tabs.ts`**

**主要修改：**
1. 使用新的存储管理器
2. 简化标签页操作逻辑

#### 6.2 删除旧工具文件

**需要删除的文件：**
- 所有不再使用的工具函数

## 详细实施清单

### 第一步：准备工作

1. **备份当前代码**
   ```bash
   git checkout -b backup-before-upgrade
   git commit -am "Backup before architecture upgrade"
   ```

2. **创建升级分支**
   ```bash
   git checkout -b architecture-upgrade
   ```

### 第二步：类型定义

1. **创建新类型文件**
   - 创建 `src/types/storage.d.ts`
   - 定义 `UnifiedStorageData` 接口
   - 定义 `TabGroup` 和 `TabInfo` 接口

2. **删除旧类型定义**
   - 删除 `src/types/background.d.ts` 中的 `StorageData`
   - 删除 `src/types/sync.d.ts` 中的 `SyncData`

### 第三步：存储层重构

1. **创建 UnifiedStorageManager**
   - 实现所有数据操作方法
   - 添加数据验证和错误处理
   - 实现原子操作保证数据一致性

2. **删除旧存储文件**
   - 删除 `src/utils/storage.ts`

### 第四步：同步层重构

1. **创建 UnifiedSyncManager**
   - 实现 GitHub API 集成
   - 简化认证流程
   - 实现数据冲突解决策略

2. **删除旧同步文件**
   - 删除整个 `src/utils/sync/` 目录
   - 重新创建目录并添加新文件

### 第五步：后台脚本重构

1. **重构 background.ts**
   - 更新所有导入语句
   - 重写标签页聚合逻辑
   - 简化同步触发逻辑

2. **删除旧后台文件**
   - 删除 `src/background/syncIntegration.ts`

### 第六步：前端组件重构

1. **重构 tab_list/App.tsx**
   - 更新数据获取逻辑
   - 重写所有 CRUD 操作
   - 简化状态管理

2. **重构 popup/App.tsx**
   - 更新数据展示逻辑
   - 简化交互流程

3. **重构 options/App.tsx**
   - 重写同步配置界面
   - 简化设置管理

### 第七步：工具函数重构

1. **重构 utils/tabs.ts**
   - 更新标签页操作逻辑
   - 使用新的存储接口

2. **清理无用文件**
   - 删除所有不再使用的工具文件

### 第八步：测试和验证

1. **功能测试**
   - 测试标签页聚合功能
   - 测试分组管理功能
   - 测试同步功能
   - 测试设置管理功能

2. **数据一致性测试**
   - 验证本地存储正确性
   - 验证远程同步正确性
   - 验证数据结构一致性

3. **性能测试**
   - 测试大量数据处理性能
   - 测试同步性能
   - 测试内存使用情况

## 风险评估和缓解策略

### 1. 数据丢失风险

**风险**：升级过程中可能导致用户数据丢失

**缓解策略**：
- 在升级前提供数据导出功能
- 实现数据迁移脚本
- 提供回滚机制

### 2. 功能回归风险

**风险**：重构可能导致某些功能失效

**缓解策略**：
- 制定详细的测试计划
- 实现自动化测试
- 分阶段发布和验证

### 3. 性能回归风险

**风险**：新架构可能影响性能

**缓解策略**：
- 性能基准测试
- 代码优化
- 监控和告警

## 验收标准

### 1. 功能完整性
- [ ] 所有原有功能正常工作
- [ ] 新功能按预期工作
- [ ] 无功能回归

### 2. 数据一致性
- [ ] 本地和远程数据结构一致
- [ ] 数据同步正确无误
- [ ] 无数据丢失

### 3. 代码质量
- [ ] 无遗留的旧代码
- [ ] 代码结构清晰
- [ ] 类型定义完整

### 4. 性能指标
- [ ] 启动时间不超过原有的 120%
- [ ] 同步时间不超过原有的 120%
- [ ] 内存使用不超过原有的 120%

## 后续优化建议

### 1. 缓存优化
- 实现智能缓存策略
- 减少不必要的存储读写

### 2. 同步优化
- 实现增量同步
- 添加冲突解决策略

### 3. 用户体验优化
- 添加加载状态指示
- 优化错误提示
- 改进交互流程

## 总结

本次升级将彻底解决当前架构的问题，实现：

1. **统一的数据结构**：本地和远程使用相同的数据格式
2. **简化的存储管理**：单一存储入口，减少复杂性
3. **高效的同步机制**：直接同步，无需数据转换
4. **清晰的代码结构**：移除所有遗留代码，提高可维护性

通过严格按照本文档执行，可以确保升级过程的顺利进行，并获得一个更加健壮、高效的系统架构。