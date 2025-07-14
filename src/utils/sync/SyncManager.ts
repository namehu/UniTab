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
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
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
   * 清除同步配置
   */
  async clearConfig(): Promise<void> {
    try {
      // 停止自动同步
      this.disableAutoSync();
      
      // 禁用实时同步
      const { RealtimeSyncManager } = await import('./RealtimeSyncManager');
      const realtimeSyncManager = RealtimeSyncManager.getInstance();
      realtimeSyncManager.disable();
      
      // 重置配置为默认值
      this._config = {
        provider: 'github',
        autoSync: false,
        syncInterval: 30,
        providerConfig: {},
        lastSync: undefined
      };
      
      // 清除存储的配置
      await chrome.storage.local.remove(['syncConfig', 'sync_github_config', 'lastSyncData', 'github_user_info']);
      
      // 清除提供商
      this.provider = null;
      
      // 重置状态
      this.setStatus('idle');
      
      console.log('Sync config cleared successfully, realtime sync disabled');
    } catch (error) {
      console.error('Clear sync config failed:', error);
      throw error;
    }
  }

  /**
   * 手动同步
   */
  async sync(): Promise<SyncResult> {
    try {
      console.log('=== Starting manual sync ===');
      this.setStatus('syncing');
      
      if (!this.provider) {
        console.log('No provider, initializing...');
        await this.initializeProvider();
      }

      if (!this.provider) {
        throw new Error('No sync provider available');
      }

      console.log('Provider initialized:', this.provider.name);

      // 检查是否已认证（即是否设置了远程同步）
      const isAuthenticated = await this.provider.isAuthenticated();
      console.log('Is authenticated (remote sync configured):', isAuthenticated);
      
      // 如果没有设置远程同步，则以本地为主
      if (!isAuthenticated) {
        console.log('No remote sync configured, using local data only');
        this.setStatus('success');
        return {
          success: true,
          message: '未配置远程同步，使用本地数据',
          timestamp: new Date().toISOString()
        };
      }

      // 获取本地数据
      const localData = await this.getLocalData();
      console.log('Local data timestamp:', localData.timestamp);
      console.log('Local groups count:', localData.data.groups?.length || 0);
      
      const hasLocalData = localData.data.groups && localData.data.groups.length > 0;
      console.log('Has local data:', hasLocalData);
      
      // 尝试下载远程数据
      console.log('Checking for remote data...');
      let remoteData: SyncData | null = null;
      let hasRemoteData = false;
      
      try {
        remoteData = await this.provider.download();
        hasRemoteData = remoteData && remoteData.data.groups && remoteData.data.groups.length > 0;
        console.log('Remote data downloaded:', {
          timestamp: remoteData?.timestamp,
          device: remoteData?.device,
          groupsCount: remoteData?.data.groups?.length || 0,
          hasRemoteData
        });
      } catch (error) {
        console.log('No remote data found or download failed');
        hasRemoteData = false;
      }
      
      // 根据本地和远程数据的存在情况进行处理
      if (!hasLocalData && hasRemoteData) {
        // 情况1: 本地没有，远程有 - 拉取远程数据
        console.log('Case 1: No local data, has remote data - downloading remote data');
        await this.saveLocalData(remoteData!);
        this._config.lastSync = new Date().toISOString();
        await this.saveConfig();
        this.setStatus('success');
        return {
          success: true,
          message: '已从远程同步数据到本地',
          timestamp: new Date().toISOString(),
          version: remoteData!.version
        };
      } else if (hasLocalData && !hasRemoteData) {
        // 情况2: 本地有，远程没有 - 推送到远程
        console.log('Case 2: Has local data, no remote data - uploading local data');
        const uploadResult = await this.provider.upload(localData);
        if (uploadResult.success) {
          this._config.lastSync = new Date().toISOString();
          await this.saveConfig();
          this.setStatus('success');
          return {
            success: true,
            message: '已将本地数据同步到远程',
            timestamp: new Date().toISOString(),
            version: localData.version
          };
        } else {
          this.setStatus('error');
          return uploadResult;
        }
      } else if (!hasLocalData && !hasRemoteData) {
        // 本地和远程都没有数据
        console.log('No data found locally or remotely');
        this.setStatus('success');
        return {
          success: true,
          message: '本地和远程均无数据',
          timestamp: new Date().toISOString()
        };
      }
      
      // 情况3: 本地有，远程也有 - 检测冲突并处理
      console.log('Case 3: Both local and remote data exist - checking for conflicts');
      if (!remoteData) {
        throw new Error('Remote data should exist but is null');
      }
      
      // 检测是否存在冲突
      const conflict = await this.detectConflict(localData, remoteData);
      
      if (conflict) {
         console.log('Conflict detected between local and remote data');
         this.setStatus('error');
         return {
           success: false,
           conflict,
           message: '检测到同步冲突，需要用户选择解决方案',
           timestamp: new Date().toISOString()
         };
       }
      
      // 没有冲突，进行智能合并
      console.log('No conflict detected, performing intelligent merge');
      const mergedData = this.mergeData(localData, remoteData);
      console.log('Merged data groups count:', mergedData.data.groups?.length || 0);
      
      // 保存合并后的数据到本地
      await this.saveLocalData(mergedData);
      console.log('Merged data saved locally');
      
      // 上传合并后的数据到远程
      console.log('Uploading merged data to remote...');
      const uploadResult = await this.provider.upload(mergedData);
      
      if (uploadResult.success) {
        this._config.lastSync = new Date().toISOString();
        await this.saveConfig();
        this.setStatus('success');
        console.log('Intelligent merge and upload completed successfully');
        
        return {
          success: true,
          message: '数据已智能合并并同步完成',
          merged: true,
          timestamp: new Date().toISOString(),
          version: mergedData.version
        };
      } else {
        this.setStatus('error');
        console.error('Upload failed after merge:', uploadResult.error);
        return {
          success: false,
          error: '数据合并成功，但上传失败：' + uploadResult.error,
          timestamp: new Date().toISOString()
        };
      }

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
      this.autoSyncTimer = setInterval(() => {
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
   * 移除同步状态变化监听器
   */
  offStatusChange(callback: (status: SyncStatus) => void): void {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  /**
   * 初始化同步提供商
   */
  private async initializeProvider(): Promise<void> {
    try {
      this.provider = SyncProviderFactory.createProvider(this._config.provider);
      await this.provider.initialize(this._config.providerConfig);
      
      // 如果是GitHub提供商，尝试获取用户信息用于统一账号识别
      if (this.provider && this.provider.name === 'github') {
        try {
          await this.getGitHubUserId(); // 这会缓存用户信息
        } catch (error) {
          console.warn('Failed to get GitHub user info during initialization:', error);
        }
      }
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
          platform: this.getPlatform(),
          githubUserId: await this.getGitHubUserId() || undefined
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
  private async detectConflict(local: SyncData, remote: SyncData): Promise<SyncConflict | null> {
    // 如果是同一设备，不认为有冲突
    if (local.device.id === remote.device.id) {
      return null;
    }
    
    // 检查是否是同一GitHub账号的不同设备
    const localGithubUserId = await this.getGitHubUserId();
    const remoteGithubUserId = remote.device.githubUserId;
    
    // 如果是同一GitHub账号的不同设备，检查数据差异
    if (localGithubUserId && remoteGithubUserId && localGithubUserId === remoteGithubUserId) {
      const hasDataDifference = this.hasSignificantDataDifference(local, remote);
      
      if (hasDataDifference) {
        // 同一账号不同设备有数据差异，返回设备冲突（需要用户选择）
        return {
          local,
          remote,
          type: 'device'
        };
      }
      
      // 同一账号不同设备无数据差异，可以直接合并
      return null;
    }
    
    // 不同账号或无法确定账号，有数据差异就是冲突
    const hasDataDifference = this.hasSignificantDataDifference(local, remote);
    if (hasDataDifference) {
      return {
        local,
        remote,
        type: 'device'
      };
    }
    
    return null;
  }

  /**
   * 检查数据是否有实质性差异
   */
  private hasSignificantDataDifference(local: SyncData, remote: SyncData): boolean {
    // 比较分组数量
    const localGroupCount = local.data.groups?.length || 0;
    const remoteGroupCount = remote.data.groups?.length || 0;
    
    // 如果分组数量差异超过阈值，认为有差异
    if (Math.abs(localGroupCount - remoteGroupCount) > 0) {
      return true;
    }
    
    // 比较分组内容（简化版本，比较分组ID）
    const localGroupIds = new Set(local.data.groups?.map(g => g.id) || []);
    const remoteGroupIds = new Set(remote.data.groups?.map(g => g.id) || []);
    
    // 检查是否有不同的分组
    for (const id of localGroupIds) {
      if (!remoteGroupIds.has(id)) return true;
    }
    for (const id of remoteGroupIds) {
      if (!localGroupIds.has(id)) return true;
    }
    
    return false;
  }

  /**
   * 智能合并数据
   */
  private mergeData(local: SyncData, remote: SyncData): SyncData {
    const localTime = new Date(local.timestamp).getTime();
    const remoteTime = new Date(remote.timestamp).getTime();
    
    // 如果本地数据更新（比如刚删除了分组），优先使用本地数据
    if (localTime > remoteTime) {
      console.log('Local data is newer, using local data as primary source');
      return {
        version: this.generateVersion(),
        timestamp: new Date().toISOString(),
        device: {
          id: local.device.id,
          name: local.device.name,
          platform: local.device.platform
        },
        data: {
          groups: local.data.groups || [],
          settings: { ...remote.data.settings, ...local.data.settings }
        }
      };
    }
    
    // 如果远程数据更新，进行智能合并
    console.log('Remote data is newer or equal, performing intelligent merge');
    
    // 创建合并后的分组映射
    const mergedGroupsMap = new Map();
    
    // 添加本地分组
    (local.data.groups || []).forEach(group => {
      mergedGroupsMap.set(group.id, {
        ...group,
        _source: 'local',
        _timestamp: localTime
      });
    });
    
    // 合并远程分组
    (remote.data.groups || []).forEach(remoteGroup => {
      const existingGroup = mergedGroupsMap.get(remoteGroup.id);
      
      if (!existingGroup) {
        // 新分组，直接添加
        mergedGroupsMap.set(remoteGroup.id, {
          ...remoteGroup,
          _source: 'remote',
          _timestamp: remoteTime
        });
      } else {
        // 分组已存在，比较时间戳决定使用哪个版本
        const existingTime = new Date(existingGroup.createdAt || 0).getTime();
        const remoteGroupTime = new Date(remoteGroup.createdAt || 0).getTime();
        
        if (remoteGroupTime > existingTime) {
          // 远程版本更新，但保留本地的标签页（合并标签页）
          const mergedTabs = this.mergeTabs(existingGroup.tabs || [], remoteGroup.tabs || []);
          mergedGroupsMap.set(remoteGroup.id, {
            ...remoteGroup,
            tabs: mergedTabs,
            _source: 'merged',
            _timestamp: Math.max(localTime, remoteTime)
          });
        } else {
          // 本地版本更新，但也要合并标签页
          const mergedTabs = this.mergeTabs(existingGroup.tabs || [], remoteGroup.tabs || []);
          mergedGroupsMap.set(existingGroup.id, {
            ...existingGroup,
            tabs: mergedTabs,
            _source: 'merged',
            _timestamp: Math.max(localTime, remoteTime)
          });
        }
      }
    });
    
    // 转换为数组并清理临时字段
    const mergedGroups = Array.from(mergedGroupsMap.values()).map(group => {
      const { _source, _timestamp, ...cleanGroup } = group;
      return cleanGroup;
    });
    
    // 合并设置（优先使用较新的设置）
    const mergedSettings = remoteTime > localTime ? 
      { ...local.data.settings, ...remote.data.settings } :
      { ...remote.data.settings, ...local.data.settings };
    
    return {
      version: this.generateVersion(),
      timestamp: new Date().toISOString(),
      device: {
        id: local.device.id, // 使用本地设备信息
        name: local.device.name,
        platform: local.device.platform
      },
      data: {
        groups: mergedGroups,
        settings: mergedSettings
      }
    };
  }

  /**
   * 合并标签页
   */
  private mergeTabs(localTabs: any[], remoteTabs: any[]): any[] {
    const tabsMap = new Map();
    
    // 添加本地标签页
    localTabs.forEach(tab => {
      tabsMap.set(tab.url, tab);
    });
    
    // 添加远程标签页（去重）
    remoteTabs.forEach(tab => {
      if (!tabsMap.has(tab.url)) {
        tabsMap.set(tab.url, tab);
      }
    });
    
    return Array.from(tabsMap.values());
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
      // 每个设备都应该有唯一的ID，即使使用同一个GitHub账号
      const result = await chrome.storage.local.get('deviceId');
      if (result.deviceId) {
        return result.deviceId;
      }
      
      // 生成新的设备ID，包含时间戳确保唯一性
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      await chrome.storage.local.set({ deviceId });
      return deviceId;
    } catch (error) {
      return `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
  }

  /**
   * 获取GitHub用户ID（用于统一账号识别）
   */
  private async getGitHubUserId(): Promise<string | null> {
    try {
      if (!this.provider || this.provider.name !== 'github') {
        return null;
      }
      
      // 检查是否已缓存GitHub用户信息
      const cached = await chrome.storage.local.get('github_user_info');
      if (cached.github_user_info && cached.github_user_info.id) {
        return cached.github_user_info.id.toString();
      }
      
      // 获取GitHub配置
      const githubConfig = await chrome.storage.local.get('sync_github_config');
      if (!githubConfig.sync_github_config?.token) {
        return null;
      }
      
      // 调用GitHub API获取用户信息
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${githubConfig.sync_github_config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      const userInfo = await response.json();
      
      // 缓存用户信息
      await chrome.storage.local.set({
        github_user_info: {
          id: userInfo.id,
          login: userInfo.login,
          name: userInfo.name,
          cached_at: new Date().toISOString()
        }
      });
      
      return userInfo.id.toString();
    } catch (error) {
      console.error('Get GitHub user ID failed:', error);
      return null;
    }
  }

  /**
   * 获取设备名称
   */
  private async getDeviceName(): Promise<string> {
    try {
      // 尝试获取GitHub用户信息来构建更有意义的设备名称
      const githubUserInfo = await this.getGitHubUserInfo();
      if (githubUserInfo) {
        const platform = this.getPlatform();
        const deviceName = `${githubUserInfo.login}'s ${platform} Device`;
        return deviceName;
      }
      
      // 如果没有GitHub用户信息，使用缓存的设备名称
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
   * 获取GitHub用户信息
   */
  private async getGitHubUserInfo(): Promise<{id: number, login: string, name: string} | null> {
    try {
      const cached = await chrome.storage.local.get('github_user_info');
      if (cached.github_user_info && cached.github_user_info.id) {
        return cached.github_user_info;
      }
      
      // 如果没有缓存，尝试获取
      const userId = await this.getGitHubUserId();
      if (userId) {
        const cached = await chrome.storage.local.get('github_user_info');
        return cached.github_user_info || null;
      }
      
      return null;
    } catch (error) {
      console.error('Get GitHub user info failed:', error);
      return null;
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