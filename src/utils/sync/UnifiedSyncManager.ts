/**
 * 统一同步管理器
 * 负责管理所有同步相关功能，替代分散的同步架构
 */

import { UnifiedStorageData, SyncResult, GitHubUserInfo } from '../../types/storage';
import { UnifiedStorageManager } from '../storage/UnifiedStorageManager';

export class UnifiedSyncManager {
  private static readonly GITHUB_API_BASE = 'https://api.github.com';
  private static readonly DEFAULT_FILENAME = 'unitab-data.json';
  private static readonly DEFAULT_DESCRIPTION = 'UniTab Browser Extension Data';
  
  // Token 验证缓存
  private static tokenValidationCache = new Map<string, { isValid: boolean; timestamp: number }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 检查是否已配置同步
   */
  static async isConfigured(): Promise<boolean> {
    try {
      const settings = await UnifiedStorageManager.getSettings();
      return settings.sync.enabled && settings.sync.provider !== 'none';
    } catch (error) {
      console.error('检查同步配置失败:', error);
      return false;
    }
  }

  /**
   * 检查是否已认证
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const settings = await UnifiedStorageManager.getSettings();
      
      if (!settings.sync.enabled || settings.sync.provider !== 'github') {
        return false;
      }
      
      const githubConfig = settings.sync.github;
      if (!githubConfig?.token) {
        return false;
      }
      
      // 验证 token 是否有效
      return await this.validateGitHubToken(githubConfig.token);
    } catch (error) {
      console.error('检查认证状态失败:', error);
      return false;
    }
  }

  /**
   * 配置 GitHub 同步
   */
  static async configureGitHub(token: string, gistId?: string): Promise<SyncResult> {
    try {
      // 验证 token
      if (!await this.validateGitHubToken(token)) {
        return {
          success: false,
          message: 'GitHub Token 无效'
        };
      }
      
      // 获取用户信息
      const userInfo = await this.fetchGitHubUserInfo(token);
      if (!userInfo) {
        return {
          success: false,
          message: '无法获取 GitHub 用户信息'
        };
      }
      
      // 如果没有提供 gistId，先尝试查找现有的默认 Gist
      let finalGistId = gistId;
      if (!finalGistId) {
        // 先尝试查找现有的默认 Gist
         finalGistId = await this.findDefaultGist(token) || undefined;
        
        // 如果没有找到，则创建新的 Gist
        if (!finalGistId) {
          finalGistId = await this.createGist(token) || undefined;
          if (!finalGistId) {
            return {
              success: false,
              message: '创建 Gist 失败'
            };
          }
        }
      }
      
      // 更新同步配置
      const result = await UnifiedStorageManager.updateSettings({
        sync: {
          enabled: true,
          provider: 'github',
          github: {
            token,
            gistId: finalGistId,
            filename: this.DEFAULT_FILENAME,
            userInfo
          }
        }
      });
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || '保存配置失败'
        };
      }
      
      return {
        success: true,
        message: 'GitHub 同步配置成功',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('配置 GitHub 同步失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '配置失败'
      };
    }
  }

  /**
   * 执行同步
   */
  static async sync(): Promise<SyncResult> {
    try {
      if (!await this.isAuthenticated()) {
        return {
          success: false,
          message: '未配置或认证失败'
        };
      }
      
      const settings = await UnifiedStorageManager.getSettings();
      const githubConfig = settings.sync.github!;
      
      // 获取本地数据
      const localData = await UnifiedStorageManager.getData();
      
      // 检查远程是否有更新
      const hasRemoteUpdates = await this.hasRemoteUpdates(githubConfig.token, githubConfig.gistId!);
      
      if (hasRemoteUpdates) {
        // 下载远程数据
        const remoteData = await this.downloadFromRemote();
        if (!remoteData) {
          return {
            success: false,
            message: '下载远程数据失败'
          };
        }
        
        // 简单的冲突解决：使用最新的数据
        const localTime = new Date(localData.metadata.updatedAt).getTime();
        const remoteTime = new Date(remoteData.metadata.updatedAt).getTime();
        
        if (remoteTime > localTime) {
          // 使用远程数据
          await UnifiedStorageManager.setData(remoteData);
          return {
            success: true,
            message: '同步完成（使用远程数据）',
            timestamp: new Date().toISOString()
          };
        }
      }
      
      // 上传本地数据到远程
      const uploadResult = await this.uploadToRemote();
      if (!uploadResult) {
        return {
          success: false,
          message: '上传数据失败'
        };
      }
      
      // 更新最后同步时间
      await UnifiedStorageManager.updateSettings({
        sync: {
          ...settings.sync,
          lastSync: new Date().toISOString()
        }
      });
      
      return {
        success: true,
        message: '同步完成',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('同步失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '同步失败'
      };
    }
  }

  /**
   * 上传到远程
   */
  static async uploadToRemote(): Promise<boolean> {
    try {
      const settings = await UnifiedStorageManager.getSettings();
      const githubConfig = settings.sync.github;
      
      if (!githubConfig?.token || !githubConfig?.gistId) {
        return false;
      }
      
      const data = await UnifiedStorageManager.getData();
      const content = JSON.stringify(data, null, 2);
      
      const response = await fetch(`${this.GITHUB_API_BASE}/gists/${githubConfig.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${githubConfig.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            [githubConfig.filename]: {
              content
            }
          }
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('上传失败:', error);
      return false;
    }
  }

  /**
   * 从远程下载
   */
  static async downloadFromRemote(): Promise<UnifiedStorageData | null> {
    try {
      const settings = await UnifiedStorageManager.getSettings();
      const githubConfig = settings.sync.github;
      
      if (!githubConfig?.token || !githubConfig?.gistId) {
        return null;
      }
      
      const response = await fetch(`${this.GITHUB_API_BASE}/gists/${githubConfig.gistId}`, {
        headers: {
          'Authorization': `token ${githubConfig.token}`,
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      const gist = await response.json();
      const file = gist.files[githubConfig.filename];
      
      if (!file || !file.content) {
        return null;
      }
      
      return JSON.parse(file.content) as UnifiedStorageData;
    } catch (error) {
      console.error('下载失败:', error);
      return null;
    }
  }

  /**
   * 清除同步配置
   */
  static async clearSyncConfig(): Promise<SyncResult> {
    try {
      const result = await UnifiedStorageManager.updateSettings({
        sync: {
          enabled: false,
          provider: 'none'
        }
      });
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || '清除配置失败'
        };
      }
      
      // 清除所有 token 缓存
      this.tokenValidationCache.clear();
      
      return {
        success: true,
        message: '同步配置已清除',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('清除同步配置失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '清除配置失败'
      };
    }
  }

  /**
   * 清理过期的缓存条目
   */
  private static cleanExpiredCache(): void {
    const now = Date.now();
    for (const [token, cache] of this.tokenValidationCache.entries()) {
      if (now - cache.timestamp >= this.CACHE_DURATION) {
        this.tokenValidationCache.delete(token);
      }
    }
  }

  /**
   * 清除指定 token 的缓存
   */
  private static clearTokenCache(token: string): void {
    this.tokenValidationCache.delete(token);
  }

  /**
   * 获取 GitHub 用户信息
   */
  static async getGitHubUserInfo(): Promise<GitHubUserInfo | null> {
    try {
      const settings = await UnifiedStorageManager.getSettings();
      return settings.sync.github?.userInfo || null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 验证 GitHub Token
   */
  private static async validateGitHubToken(token: string): Promise<boolean> {
    try {
      // 检查缓存
      const cached = this.tokenValidationCache.get(token);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
        console.log('使用缓存的 token 验证结果');
        return cached.isValid;
      }
      
      console.log('执行 GitHub API token 验证');
      const response = await fetch(`${this.GITHUB_API_BASE}/user`, {
        headers: {
          'Authorization': `token ${token}`,
        }
      });
      
      const isValid = response.ok;
      
      // 缓存结果
      this.tokenValidationCache.set(token, {
        isValid,
        timestamp: now
      });
      
      // 清理过期缓存
      this.cleanExpiredCache();
      
      return isValid;
    } catch (error) {
      console.error('验证 token 失败:', error);
      return false;
    }
  }

  /**
   * 获取 GitHub 用户信息
   */
  private static async fetchGitHubUserInfo(token: string): Promise<GitHubUserInfo | null> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/user`, {
        headers: {
          'Authorization': `token ${token}`,
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      const user = await response.json();
      return {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url
      };
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 创建新的 Gist
   */
  /**
   * 查找现有的默认 Gist
   */
  private static async findDefaultGist(token: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/gists`, {
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      const gists = await response.json();
      
      // 查找包含默认文件名的 Gist
      for (const gist of gists) {
        if (gist.files && gist.files[this.DEFAULT_FILENAME]) {
          console.log(`找到现有的默认 Gist: ${gist.id}`);
          return gist.id;
        }
      }
      
      console.log('未找到现有的默认 Gist');
      return null;
    } catch (error) {
      console.error('查找默认 Gist 失败:', error);
      return null;
    }
  }

  private static async createGist(token: string): Promise<string | null> {
    try {
      const initialData = await UnifiedStorageManager.getData();
      const content = JSON.stringify(initialData, null, 2);
      
      const response = await fetch(`${this.GITHUB_API_BASE}/gists`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: this.DEFAULT_DESCRIPTION,
          public: false,
          files: {
            [this.DEFAULT_FILENAME]: {
              content
            }
          }
        })
      });
      
      if (!response.ok) {
        return null;
      }
      
      const gist = await response.json();
      console.log(`创建新的 Gist: ${gist.id}`);
      return gist.id;
    } catch (error) {
      console.error('创建 Gist 失败:', error);
      return null;
    }
  }

  /**
   * 检查远程是否有更新
   */
  private static async hasRemoteUpdates(token: string, gistId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/gists/${gistId}`, {
        headers: {
          'Authorization': `token ${token}`,
        }
      });
      
      if (!response.ok) {
        return false;
      }
      
      const gist = await response.json();
      const remoteUpdatedAt = new Date(gist.updated_at).getTime();
      
      const settings = await UnifiedStorageManager.getSettings();
      const lastSync = settings.sync.lastSync;
      
      if (!lastSync) {
        return true; // 从未同步过
      }
      
      const lastSyncTime = new Date(lastSync).getTime();
      return remoteUpdatedAt > lastSyncTime;
    } catch (error) {
      console.error('检查远程更新失败:', error);
      return false;
    }
  }
}