/**
 * 统一存储数据类型定义
 * 本文件定义了新的统一数据结构，用于替代分散的存储架构
 */

/**
 * 标签页信息接口
 */
export interface TabInfo {
  title: string;
  url: string;
  favIconUrl?: string;
  pinned?: boolean;
}

/**
 * 标签分组接口
 */
export interface TabGroup {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  locked?: boolean; // 是否锁定（防止删除和修改）
  tabs: TabInfo[];
}

/**
 * GitHub 用户信息接口
 */
export interface GitHubUserInfo {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
}

/**
 * 设备信息接口
 */
export interface DeviceInfo {
  id: string;
  name: string;
}

/**
 * 统一存储数据接口
 * 这是新架构的核心数据结构，整合了所有分散的存储项
 */
export interface UnifiedStorageData {
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
        userInfo?: GitHubUserInfo;
      };
    };
  };
  
  // 标签分组数据
  groups: TabGroup[];
}

/**
 * 同步结果接口
 */
export interface SyncResult {
  success: boolean;
  message: string;
  timestamp?: string;
}

/**
 * 存储操作结果接口
 */
export interface StorageOperationResult {
  success: boolean;
  error?: string;
}