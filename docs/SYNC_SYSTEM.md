# UniTab 远程同步系统

## 概述

UniTab 的远程同步系统采用了可扩展的架构设计，支持多种云服务提供商，让用户可以在不同设备间同步标签页分组数据。

## 架构设计

### 设计模式

1. **策略模式 (Strategy Pattern)**
   - `ISyncProvider` 接口定义了同步提供商的标准行为
   - 不同的云服务实现各自的同步策略
   - 可以在运行时切换不同的同步提供商

2. **工厂模式 (Factory Pattern)**
   - `SyncProviderFactory` 负责创建和管理同步提供商实例
   - 支持动态注册新的同步提供商
   - 提供统一的创建接口

3. **单例模式 (Singleton Pattern)**
   - `SyncManager` 使用单例模式确保全局唯一的同步管理器
   - 统一管理同步状态和配置

### 核心组件

#### 1. 类型定义 (`src/types/sync.d.ts`)

```typescript
// 同步提供商接口
export interface ISyncProvider {
  readonly name: SyncProvider;
  initialize(config: Record<string, any>): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  authenticate(): Promise<boolean>;
  upload(data: SyncData): Promise<SyncResult>;
  download(): Promise<SyncData>;
  hasRemoteUpdates(localTimestamp: string): Promise<boolean>;
  deleteRemote(): Promise<SyncResult>;
}

// 同步管理器接口
export interface ISyncManager {
  readonly status: SyncStatus;
  readonly config: SyncConfig;
  setConfig(config: SyncConfig): Promise<void>;
  sync(): Promise<SyncResult>;
  upload(): Promise<SyncResult>;
  download(): Promise<SyncResult>;
  resolveConflict(conflict: SyncConflict, resolution: ConflictResolution): Promise<SyncResult>;
}
```

#### 2. 同步提供商工厂 (`src/utils/sync/SyncProviderFactory.ts`)

- 管理所有可用的同步提供商
- 支持动态注册新的提供商
- 提供统一的创建接口

#### 3. 同步管理器 (`src/utils/sync/SyncManager.ts`)

- 协调不同同步提供商的操作
- 处理同步冲突和数据合并
- 管理自动同步定时器
- 提供状态监听机制

#### 4. 具体同步提供商实现

- **GitHub Gist** (`src/utils/sync/GitHubSyncProvider.ts`)
- **Dropbox** (`src/utils/sync/DropboxSyncProvider.ts`) - 示例实现

## 支持的同步提供商

### GitHub Gist

**特点：**
- 免费且稳定
- 支持版本控制
- 私有 Gist 保护数据隐私
- 同步完整的标签页分组数据和应用设置

**配置要求：**
- GitHub Personal Access Token (需要 `gist` 权限)
- 或使用 OAuth 认证

**使用方法：**
1. 在同步设置中选择 "GitHub Gist"
2. 点击认证按钮进行 OAuth 认证，或手动输入 Personal Access Token
3. 系统会自动创建私有 Gist 存储完整的标签页数据

## 扩展新的同步提供商

### 步骤 1: 实现 ISyncProvider 接口

```typescript
export class CustomSyncProvider implements ISyncProvider {
  readonly name = 'custom' as const;
  
  async initialize(config: any): Promise<void> {
    // 初始化逻辑
  }
  
  async isAuthenticated(): Promise<boolean> {
    // 检查认证状态
  }
  
  async authenticate(): Promise<boolean> {
    // 执行认证流程
  }
  
  async upload(data: SyncData): Promise<SyncResult> {
    // 上传数据到云服务
  }
  
  async download(): Promise<SyncData> {
    // 从云服务下载数据
  }
  
  async hasRemoteUpdates(localTimestamp: string): Promise<boolean> {
    // 检查远程是否有更新
  }
  
  async deleteRemote(): Promise<SyncResult> {
    // 删除远程数据
  }
}
```

### 步骤 2: 注册到工厂

```typescript
import { SyncProviderFactory } from './SyncProviderFactory';
import { CustomSyncProvider } from './CustomSyncProvider';

SyncProviderFactory.registerProvider('custom', () => new CustomSyncProvider());
```

### 步骤 3: 更新类型定义

```typescript
// 在 src/types/sync.d.ts 中添加新的提供商类型
export type SyncProvider = 'github' | 'dropbox' | 'custom';
```

## 同步数据格式

```typescript
export interface SyncData {
  version: string;           // 数据版本
  timestamp: string;         // 同步时间戳
  device: {                  // 设备信息
    id: string;
    name: string;
    platform: string;
  };
  data: {                    // 实际数据
    groups: Group[];         // 标签页分组
    settings: any;           // 用户设置
  };
}
```

## 冲突解决策略

当检测到同步冲突时，系统提供以下解决策略：

1. **local**: 使用本地数据覆盖远程数据
2. **remote**: 使用远程数据覆盖本地数据
3. **merge**: 智能合并本地和远程数据
4. **ask**: 询问用户如何处理冲突

## 安全考虑

1. **数据加密**: 敏感数据在传输前进行加密
2. **访问控制**: 使用 OAuth 2.0 进行安全认证
3. **权限最小化**: 只请求必要的 API 权限
4. **本地存储**: 认证令牌安全存储在 Chrome Storage 中

## 使用指南

### 启用同步

1. 点击应用头部的云同步图标
2. 选择同步提供商
3. 完成认证流程
4. 配置自动同步设置（可选）

### 手动同步

- **同步**: 智能同步本地和远程数据
- **上传**: 强制上传本地数据到远程
- **下载**: 强制下载远程数据到本地

### 自动同步

- 支持设置自动同步间隔（5分钟到3小时）
- 在后台自动执行同步操作
- 同步失败时会显示错误提示

## 故障排除

### 常见问题

1. **认证失败**
   - 检查网络连接
   - 确认 Token 权限正确
   - 重新进行认证

2. **同步失败**
   - 检查网络连接
   - 确认云服务状态正常
   - 查看错误日志

3. **数据冲突**
   - 选择合适的冲突解决策略
   - 备份重要数据
   - 手动合并数据

### 调试信息

同步过程中的详细日志会输出到浏览器控制台，可以帮助诊断问题。

## 开发计划

### 已实现功能

- ✅ 可扩展的同步架构
- ✅ GitHub Gist 同步支持
- ✅ 自动同步功能
- ✅ 冲突检测和解决
- ✅ 同步状态管理
- ✅ 用户界面集成

### 计划功能

- 🔄 Google Drive 同步支持
- 🔄 OneDrive 同步支持
- 🔄 数据加密功能
- 🔄 同步历史记录
- 🔄 增量同步优化
- 🔄 离线同步队列

## 贡献指南

欢迎贡献新的同步提供商实现！请遵循以下步骤：

1. Fork 项目仓库
2. 创建新的同步提供商实现
3. 添加相应的测试用例
4. 更新文档
5. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证，详见 LICENSE 文件。