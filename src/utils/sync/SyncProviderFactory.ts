/**
 * 同步提供商工厂
 * 使用工厂模式创建不同的同步提供商实例
 */

import type { ISyncProvider, SyncProvider } from '../../types/sync';
import { GitHubSyncProvider } from './GitHubSyncProvider';

/**
 * 同步提供商工厂类
 */
export class SyncProviderFactory {
  private static providers = new Map<SyncProvider, () => ISyncProvider>();

  /**
   * 注册同步提供商
   */
  static registerProvider(type: SyncProvider, factory: () => ISyncProvider): void {
    this.providers.set(type, factory);
  }

  /**
   * 创建同步提供商实例
   */
  static createProvider(type: SyncProvider): ISyncProvider {
    const factory = this.providers.get(type);
    if (!factory) {
      throw new Error(`Unsupported sync provider: ${type}`);
    }
    return factory();
  }

  /**
   * 获取所有支持的提供商类型
   */
  static getSupportedProviders(): SyncProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 检查是否支持指定的提供商
   */
  static isProviderSupported(type: SyncProvider): boolean {
    return this.providers.has(type);
  }
}

// 注册默认的同步提供商
SyncProviderFactory.registerProvider('github', () => new GitHubSyncProvider());

// 预留其他提供商的注册位置
// SyncProviderFactory.registerProvider('dropbox', () => new DropboxSyncProvider());
// SyncProviderFactory.registerProvider('googledrive', () => new GoogleDriveSyncProvider());
// SyncProviderFactory.registerProvider('onedrive', () => new OneDriveSyncProvider());