/**
 * 同步管理器实现
 * 负责协调不同的同步提供商，处理同步逻辑、冲突解决等
 */

import type {
  ISyncManager,
  ISyncProvider,
  SyncConfig,
  SyncStatus,
  SyncResult,
  SyncData,
  SyncConflict,
  ConflictResolution
} from '../../types/sync';
import type { Group } from '../../tab_list/types';
import { SyncProviderFactory } from './SyncProviderFactory';
import { StorageManager } from '../storage';

export class SyncManager implements ISyncManager {
  private _status: SyncStatus = 'idle';
  private _config: SyncConfig;
  private provider: ISyncProvider | null = null;
  private autoSyncTimer: number | null = null;
  private statusCallbacks: ((status: SyncStatus) => void)[] = [];

  constructor() {
    this._config = {
      provider: 'github',
      autoSync: false,
      syncInterval: 30, // 30分钟
      providerConfig: {}
    };
    
    this.loadConfig();
  }

  /**
   * 当前同步状态
   */
  get status(): SyncStatus {
    return this._status;
  }

  /**
   * 当前配置
   */
  get config(): SyncConfig {
    return { ...this._config };
  }

  /**
   * 设置同步配置
   */
  async setConfig(config: SyncConfig): Promise<void> {
    try {
      this._config = { ...config };
      await this.saveConfig();
      
      // 重新初始化提供商
      await this.initializeProvider();
      
      // 重新设置自动同步
      if (config.autoSync) {
        this.enableAutoSync();
      } else {
        this.disableAutoSync();
      }
    } catch (error) {
      console.error('Set sync config failed:', error);
      throw error;
    }
  }

  /**
   * 手动同步
   */
  async sync(): Promise<SyncResult> {
    try {
      this.setStatus('syncing');
      
      if (!this.provider) {
        await this.initializeProvider();
      }

      if (!this.provider) {
        throw new Error('No sync provider available');
      }

      // 检查是否已认证
      const isAuthenticated = await this.provider.isAuthenticated();
      if (!isAuthenticated) {
        throw new Error('Not authenticated with sync provider');
      }

      // 获取本地数据
      const localData = await this.getLocalData();
      
      // 检查远程是否有更新
      const hasRemoteUpdates = await this.provider.hasRemoteUpdates(localData.timestamp);
      
      if (hasRemoteUpdates) {
        // 下载远程数据
        const remoteData = await this.provider.download();
        
        // 检查是否有冲突
        const conflict = this.detectConflict(localData, remoteData);
        if (conflict) {
          // 有冲突，需要用户选择解决方案
          this.setStatus('error');
          return {
            success: false,
            error: 'Sync conflict detected',
            timestamp: new Date().toISOString()
          };
        }
        
        // 合并数据并保存到本地
        const mergedData = this.mergeData(localData, remoteData);
        await this.saveLocalData(mergedData);
      }
      
      // 上传本地数据到远程
      const uploadResult = await this.provider.upload(localData);
      
      if (uploadResult.success) {
        this._config.lastSync = new Date().toISOString();
        await this.saveConfig();
        this.setStatus('success');
      } else {
        this.setStatus('error');
      }
      
      return uploadResult;
    } catch (error) {
      console.error('Sync failed:', error);
      this.setStatus('error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 上传到远程
   */
  async upload(): Promise<SyncResult> {
    try {
      this.setStatus('syncing');
      
      if (!this.provider) {
        await this.initializeProvider();
      }

      if (!this.provider) {
        throw new Error('No sync provider available');
      }

      const localData = await this.getLocalData();
      const result = await this.provider.upload(localData);
      
      if (result.success) {
        this._config.lastSync = new Date().toISOString();
        await this.saveConfig();
        this.setStatus('success');
      } else {
        this.setStatus('error');
      }
      
      return result;
    } catch (error) {
      console.error('Upload failed:', error);
      this.setStatus('error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 从远程下载
   */
  async download(): Promise<SyncResult> {
    try {
      this.setStatus('syncing');
      
      if (!this.provider) {
        await this.initializeProvider();
      }

      if (!this.provider) {
        throw new Error('No sync provider available');
      }

      const remoteData = await this.provider.download();
      await this.saveLocalData(remoteData);
      
      this._config.lastSync = new Date().toISOString();
      await this.saveConfig();
      this.setStatus('success');
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        version: remoteData.version
      };
    } catch (error) {
      console.error('Download failed:', error);
      this.setStatus('error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 解决同步冲突
   */
  async resolveConflict(conflict: SyncConflict, resolution: ConflictResolution): Promise<SyncResult> {
    try {
      this.setStatus('syncing');
      
      let finalData: SyncData;
      
      switch (resolution) {
        case 'local':
          finalData = conflict.local;
          break;
        case 'remote':
          finalData = conflict.remote;
          break;
        case 'merge':
          finalData = this.mergeData(conflict.local, conflict.remote);
          break;
        default:
          throw new Error('Invalid conflict resolution');
      }
      
      // 保存解决后的数据
      await this.saveLocalData(finalData);
      
      // 上传到远程
      if (this.provider) {
        const uploadResult = await this.provider.upload(finalData);
        if (uploadResult.success) {
          this._config.lastSync = new Date().toISOString();
          await this.saveConfig();
          this.setStatus('success');
        } else {
          this.setStatus('error');
        }
        return uploadResult;
      }
      
      throw new Error('No sync provider available');
    } catch (error) {
      console.error('Resolve conflict failed:', error);
      this.setStatus('error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Resolve conflict failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 启用自动同步
   */
  enableAutoSync(): void {
    this.disableAutoSync(); // 先清除现有的定时器
    
    if (this._config.syncInterval > 0) {
      this.autoSyncTimer = window.setInterval(() => {
        this.sync().catch(error => {
          console.error('Auto sync failed:', error);
        });
      }, this._config.syncInterval * 60 * 1000); // 转换为毫秒
    }
  }

  /**
   * 禁用自动同步
   */
  disableAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  /**
   * 获取同步状态
   */
  getStatus(): SyncStatus {
    return this._status;
  }

  /**
   * 监听同步状态变化
   */
  onStatusChange(callback: (status: SyncStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * 初始化同步提供商
   */
  private async initializeProvider(): Promise<void> {
    try {
      this.provider = SyncProviderFactory.createProvider(this._config.provider);
      await this.provider.initialize(this._config.providerConfig);
    } catch (error) {
      console.error('Initialize sync provider failed:', error);
      this.provider = null;
      throw error;
    }
  }

  /**
   * 设置同步状态
   */
  private setStatus(status: SyncStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.statusCallbacks.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('Status callback error:', error);
        }
      });
    }
  }

  /**
   * 获取本地数据
   */
  private async getLocalData(): Promise<SyncData> {
    try {
      const storageData = await StorageManager.getData();
      
      return {
        version: this.generateVersion(),
        timestamp: new Date().toISOString(),
        device: {
          id: await this.getDeviceId(),
          name: await this.getDeviceName(),
          platform: this.getPlatform()
        },
        data: {
          groups: storageData.groups || [],
          settings: storageData.settings || {}
        }
      };
    } catch (error) {
      console.error('Get local data failed:', error);
      throw error;
    }
  }

  /**
   * 保存本地数据
   */
  private async saveLocalData(data: SyncData): Promise<void> {
    try {
      // 获取当前存储数据
      const currentData = await StorageManager.getData();
      
      // 更新数据
      const updatedData = {
        ...currentData,
        groups: data.data.groups,
        settings: data.data.settings
      };
      
      // 保存更新后的数据
      await StorageManager.setData(updatedData);
      
      // 保存同步元数据
      await chrome.storage.local.set({
        lastSyncData: data
      });
    } catch (error) {
      console.error('Save local data failed:', error);
      throw error;
    }
  }

  /**
   * 检测同步冲突
   */
  private detectConflict(local: SyncData, remote: SyncData): SyncConflict | null {
    const localTime = new Date(local.timestamp).getTime();
    const remoteTime = new Date(remote.timestamp).getTime();
    
    // 如果时间戳相差超过5分钟，且不是同一设备，则认为有冲突
    if (Math.abs(localTime - remoteTime) > 5 * 60 * 1000 && 
        local.device.id !== remote.device.id) {
      return {
        local,
        remote,
        type: 'timestamp'
      };
    }
    
    return null;
  }

  /**
   * 合并数据
   */
  private mergeData(local: SyncData, remote: SyncData): SyncData {
    // 简单的合并策略：使用时间戳较新的数据
    const localTime = new Date(local.timestamp).getTime();
    const remoteTime = new Date(remote.timestamp).getTime();
    
    const newerData = remoteTime > localTime ? remote : local;
    
    return {
      ...newerData,
      timestamp: new Date().toISOString(),
      version: this.generateVersion()
    };
  }

  /**
   * 生成数据版本
   */
  private generateVersion(): string {
    return `v${Date.now()}`;
  }

  /**
   * 获取设备ID
   */
  private async getDeviceId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get('deviceId');
      if (result.deviceId) {
        return result.deviceId;
      }
      
      const deviceId = `device_${Math.random().toString(36).substring(2, 15)}`;
      await chrome.storage.local.set({ deviceId });
      return deviceId;
    } catch (error) {
      return `device_${Math.random().toString(36).substring(2, 15)}`;
    }
  }

  /**
   * 获取设备名称
   */
  private async getDeviceName(): Promise<string> {
    try {
      const result = await chrome.storage.local.get('deviceName');
      if (result.deviceName) {
        return result.deviceName;
      }
      
      const deviceName = `Chrome on ${this.getPlatform()}`;
      await chrome.storage.local.set({ deviceName });
      return deviceName;
    } catch (error) {
      return `Chrome on ${this.getPlatform()}`;
    }
  }

  /**
   * 获取平台信息
   */
  private getPlatform(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Unknown';
  }

  /**
   * 保存配置
   */
  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.local.set({ syncConfig: this._config });
    } catch (error) {
      console.error('Save sync config failed:', error);
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('syncConfig');
      if (result.syncConfig) {
        this._config = { ...this._config, ...result.syncConfig };
      }
    } catch (error) {
      console.error('Load sync config failed:', error);
    }
  }
}

// 导出单例实例
export const syncManager = new SyncManager();