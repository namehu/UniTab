/**
 * 远程同步相关的类型定义
 */

/**
 * 同步提供商类型
 */
export type SyncProvider = 'github';

/**
 * 同步状态
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/**
 * 同步配置接口
 */
export interface SyncConfig {
  /** 同步提供商 */
  provider: SyncProvider;
  /** 是否启用自动同步 */
  autoSync: boolean;
  /** 自动同步间隔（分钟） */
  syncInterval: number;
  /** 最后同步时间 */
  lastSync?: string;
  /** 提供商特定配置 */
  providerConfig: Record<string, any>;
}

/**
 * GitHub 同步配置
 */
export interface GitHubSyncConfig {
  /** GitHub Token */
  token?: string;
  /** Gist ID */
  gistId?: string;
  /** Gist 文件名 */
  filename: string;
  /** Gist 描述 */
  description: string;
}

/**
 * 同步结果
 */
export interface SyncResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 成功消息 */
  message?: string;
  /** 同步时间 */
  timestamp: string;
  /** 同步的数据版本 */
  version?: string;
  /** 是否进行了自动合并 */
  merged?: boolean;
  /** 冲突信息（当需要手动解决时） */
  conflict?: SyncConflict;
}

/**
 * 同步数据接口
 */
export interface SyncData {
  /** 数据版本 */
  version: string;
  /** 同步时间戳 */
  timestamp: string;
  /** 设备信息 */
  device: {
    id: string;
    name: string;
    platform: string;
  };
  /** 实际数据 */
  data: {
    groups: any[];
    settings: any;
  };
}

/**
 * 同步冲突解决策略
 */
export type ConflictResolution = 'local' | 'remote' | 'merge' | 'ask';

/**
 * 同步冲突信息
 */
export interface SyncConflict {
  /** 本地数据 */
  local: SyncData;
  /** 远程数据 */
  remote: SyncData;
  /** 冲突类型 */
  type: 'timestamp' | 'version' | 'device';
}

/**
 * 同步提供商接口
 */
export interface ISyncProvider {
  /** 提供商名称 */
  readonly name: SyncProvider;
  
  /** 初始化提供商 */
  initialize(config: Record<string, any>): Promise<void>;
  
  /** 检查是否已认证 */
  isAuthenticated(): Promise<boolean>;
  
  /** 进行认证 */
  authenticate(): Promise<boolean>;
  
  /** 上传数据 */
  upload(data: SyncData): Promise<SyncResult>;
  
  /** 下载数据 */
  download(): Promise<SyncData>;
  
  /** 检查远程是否有更新 */
  hasRemoteUpdates(localTimestamp: string): Promise<boolean>;
  
  /** 删除远程数据 */
  deleteRemote(): Promise<SyncResult>;
  
  /** 获取同步历史 */
  getSyncHistory?(): Promise<SyncResult[]>;
}

/**
 * 同步管理器接口
 */
export interface ISyncManager {
  /** 当前同步状态 */
  readonly status: SyncStatus;
  
  /** 当前配置 */
  readonly config: SyncConfig;
  
  /** 设置同步配置 */
  setConfig(config: SyncConfig): Promise<void>;
  
  /** 手动同步 */
  sync(): Promise<SyncResult>;
  
  /** 上传到远程 */
  upload(): Promise<SyncResult>;
  
  /** 从远程下载 */
  download(): Promise<SyncResult>;
  
  /** 解决同步冲突 */
  resolveConflict(conflict: SyncConflict, resolution: ConflictResolution): Promise<SyncResult>;
  
  /** 启用自动同步 */
  enableAutoSync(): void;
  
  /** 禁用自动同步 */
  disableAutoSync(): void;
  
  /** 获取同步状态 */
  getStatus(): SyncStatus;
  
  /** 监听同步状态变化 */
  onStatusChange(callback: (status: SyncStatus) => void): void;
  
  /** 移除同步状态变化监听器 */
  offStatusChange(callback: (status: SyncStatus) => void): void;
}