/**
 * 存储相关工具函数
 * 提供统一的数据存储和获取接口
 */

import type { StorageData, MessageResponse } from '../types/background.js';

/** 数据存储键名 */
export const STORAGE_KEY = 'tabSorterData' as const;

/** 默认数据结构 */
export const DEFAULT_DATA: StorageData = {
  version: '1.0.0',
  settings: {
    sync: {
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

/**
 * 存储工具类
 * 封装所有与Chrome存储相关的操作
 */
export class StorageManager {
  /**
   * 获取存储数据
   * @returns 存储的数据或默认数据
   */
  static async getData(): Promise<StorageData> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || DEFAULT_DATA;
    } catch (error) {
      console.error('Failed to get storage data:', error);
      return DEFAULT_DATA;
    }
  }

  /**
   * 保存数据到存储
   * @param data 要保存的数据
   */
  static async setData(data: StorageData): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (error) {
      console.error('Failed to save storage data:', error);
      throw error;
    }
  }

  /**
   * 初始化存储（如果不存在）
   */
  static async initialize(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (!result[STORAGE_KEY]) {
        await this.setData(DEFAULT_DATA);
        console.log('Initialized default storage data');
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * 清空所有数据
   */
  static async clear(): Promise<void> {
    try {
      await this.setData(DEFAULT_DATA);
      console.log('Cleared all storage data');
    } catch (error) {
      console.error('Failed to clear storage data:', error);
      throw error;
    }
  }

  /**
   * 获取存储使用情况
   * @returns 存储使用字节数
   */
  static async getUsage(): Promise<number> {
    try {
      const result = await chrome.storage.local.getBytesInUse();
      return result;
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return 0;
    }
  }
}

/**
 * 创建标准化的响应对象
 * @param success 是否成功
 * @param data 响应数据
 * @param error 错误信息
 * @returns 标准化响应
 */
export function createResponse(success: boolean, data?: any, error?: string): MessageResponse {
  return { success, data, error };
}

/**
 * 生成网站图标URL
 * @param url 网站URL
 * @returns 图标URL
 */
export function generateFavIconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${hostname}`;
  } catch {
    return '';
  }
}

/**
 * 格式化日期为本地字符串
 * @param date 日期对象或ISO字符串
 * @returns 格式化的日期字符串
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 验证URL是否有效
 * @param url 要验证的URL
 * @returns 是否为有效URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查URL是否在排除列表中
 * @param url 要检查的URL
 * @param excludeList 排除列表
 * @returns 是否应该排除
 */
export function shouldExcludeUrl(url: string, excludeList: string[]): boolean {
  return excludeList.some(excludeUrl => url.startsWith(excludeUrl));
}

/**
 * 生成唯一ID（基于时间戳）
 * @returns 唯一ID
 */
export function generateId(): number {
  return Date.now();
}

/**
 * 安全的JSON解析
 * @param jsonString JSON字符串
 * @param defaultValue 解析失败时的默认值
 * @returns 解析结果或默认值
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
}

/**
 * 深度克隆对象
 * @param obj 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}