/**
 * 统一存储管理器
 * 负责管理所有数据的存储和读取，替代分散的存储架构
 */

import { UnifiedStorageData, TabGroup, TabInfo, StorageOperationResult } from '../../types/storage';

export class UnifiedStorageManager {
  private static readonly STORAGE_KEY = 'unifiedData';
  private static readonly DEFAULT_VERSION = '2.0.0';
  private static readonly DEFAULT_FILENAME = 'unitab-data.json';

  /**
   * 获取完整的统一数据
   */
  static async getData(): Promise<UnifiedStorageData> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const data = result[this.STORAGE_KEY];

      if (!data) {
        // 如果没有数据，初始化默认数据
        return await this.initializeDefaultData();
      }

      // 验证数据结构
      if (!this.validateDataStructure(data)) {
        console.warn('数据结构验证失败，重新初始化');
        return await this.initializeDefaultData();
      }

      return data;
    } catch (error) {
      console.error('获取数据失败:', error);
      return await this.initializeDefaultData();
    }
  }

  /**
   * 保存完整的统一数据
   */
  static async setData(data: UnifiedStorageData): Promise<StorageOperationResult> {
    try {
      // 更新时间戳
      data.metadata.updatedAt = new Date().toISOString();

      // 验证数据结构
      if (!this.validateDataStructure(data)) {
        return {
          success: false,
          error: '数据结构验证失败'
        };
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: data });

      return { success: true };
    } catch (error) {
      console.error('保存数据失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取所有分组
   */
  static async getGroups(): Promise<TabGroup[]> {
    const data = await this.getData();
    return data.groups || [];
  }

  /**
   * 添加新分组
   */
  static async addGroup(groupData: Omit<TabGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<TabGroup> {
    const data = await this.getData();
    const now = new Date().toISOString();

    const newGroup: TabGroup = {
      id: Date.now(),
      createdAt: now,
      updatedAt: now,
      ...groupData
    };

    data.groups.push(newGroup);
    await this.setData(data);

    return newGroup;
  }

  /**
   * 更新分组
   */
  static async updateGroup(groupId: number, updates: Partial<TabGroup>): Promise<StorageOperationResult> {
    const data = await this.getData();
    const groupIndex = data.groups.findIndex((g) => g.id === groupId);

    if (groupIndex === -1) {
      return {
        success: false,
        error: '分组不存在'
      };
    }

    // 更新分组数据
    data.groups[groupIndex] = {
      ...data.groups[groupIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return await this.setData(data);
  }

  /**
   * 删除分组
   */
  static async deleteGroup(groupId: number): Promise<StorageOperationResult> {
    const data = await this.getData();
    const initialLength = data.groups.length;

    data.groups = data.groups.filter((g) => g.id !== groupId);

    if (data.groups.length === initialLength) {
      return {
        success: false,
        error: '分组不存在'
      };
    }

    return await this.setData(data);
  }

  /**
   * 获取设置
   */
  static async getSettings(): Promise<UnifiedStorageData['settings']> {
    const data = await this.getData();
    return data.settings;
  }

  /**
   * 更新设置
   */
  static async updateSettings(updates: Partial<UnifiedStorageData['settings']>): Promise<StorageOperationResult> {
    const data = await this.getData();

    // 深度合并设置
    data.settings = this.deepMerge(data.settings, updates);

    return await this.setData(data);
  }

  /**
   * 初始化默认数据
   */
  static async initializeDefaultData(): Promise<UnifiedStorageData> {
    const deviceId = await this.generateDeviceId();
    const now = new Date().toISOString();

    const defaultData: UnifiedStorageData = {
      version: this.DEFAULT_VERSION,
      metadata: {
        createdAt: now,
        updatedAt: now,
        deviceId,
        deviceName: await this.getDeviceName()
      },
      settings: {
        excludeList: ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'moz-extension://'],
        autoSync: false,
        syncInterval: 30,
        sync: {
          enabled: false,
          provider: 'none'
        }
      },
      groups: []
    };

    await this.setData(defaultData);
    return defaultData;
  }

  /**
   * 清空所有数据
   */
  static async clearAllData(): Promise<StorageOperationResult> {
    try {
      await chrome.storage.local.clear();
      return { success: true };
    } catch (error) {
      console.error('清空数据失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取统计信息
   */
  static async getStatistics() {
    const data = await this.getData();
    const groups = data.groups;

    return {
      groupCount: groups.length,
      tabCount: groups.reduce((total, group) => total + group.tabs.length, 0),
      lockedGroups: groups.filter((g) => g.locked).length,
      averageTabsPerGroup:
        groups.length > 0
          ? Math.round((groups.reduce((total, group) => total + group.tabs.length, 0) / groups.length) * 100) / 100
          : 0
    };
  }

  /**
   * 导出数据
   */
  static async exportData(): Promise<string> {
    const data = await this.getData();
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入数据
   */
  static async importData(jsonData: string): Promise<StorageOperationResult> {
    try {
      const data = JSON.parse(jsonData) as UnifiedStorageData;

      if (!this.validateDataStructure(data)) {
        return {
          success: false,
          error: '导入的数据结构无效'
        };
      }

      return await this.setData(data);
    } catch (error) {
      console.error('导入数据失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '数据格式错误'
      };
    }
  }

  /**
   * 验证数据结构
   */
  private static validateDataStructure(data: any): data is UnifiedStorageData {
    if (!data || typeof data !== 'object') return false;

    // 检查必需字段
    if (!data.version || !data.metadata || !data.settings || !Array.isArray(data.groups)) {
      return false;
    }

    // 检查元数据
    const metadata = data.metadata;
    if (!metadata.createdAt || !metadata.updatedAt || !metadata.deviceId || !metadata.deviceName) {
      return false;
    }

    // 检查设置
    const settings = data.settings;
    if (
      !Array.isArray(settings.excludeList) ||
      typeof settings.autoSync !== 'boolean' ||
      typeof settings.syncInterval !== 'number' ||
      !settings.sync
    ) {
      return false;
    }

    return true;
  }

  /**
   * 生成设备ID
   */
  private static async generateDeviceId(): Promise<string> {
    // 尝试从现有数据中获取设备ID
    try {
      const result = await chrome.storage.local.get('deviceId');
      if (result.deviceId) {
        return result.deviceId;
      }
    } catch (error) {
      console.warn('无法获取现有设备ID:', error);
    }

    // 生成新的设备ID
    const deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    try {
      await chrome.storage.local.set({ deviceId });
    } catch (error) {
      console.warn('无法保存设备ID:', error);
    }

    return deviceId;
  }

  /**
   * 获取设备名称
   */
  private static async getDeviceName(): Promise<string> {
    try {
      // 尝试获取平台信息
      if (typeof navigator !== 'undefined') {
        const platform = navigator.platform || 'Unknown';
        const userAgent = navigator.userAgent || '';

        if (userAgent.includes('Chrome')) {
          return `Chrome on ${platform}`;
        } else if (userAgent.includes('Edge')) {
          return `Edge on ${platform}`;
        }
        return `Browser on ${platform}`;
      }
    } catch (error) {
      console.warn('无法获取设备信息:', error);
    }

    return 'Unknown Device';
  }

  /**
   * 深度合并对象
   */
  private static deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}
