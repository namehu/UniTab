/**
 * GitHub Gist 同步提供商实现
 */

import type { ISyncProvider, SyncData, SyncResult, GitHubSyncConfig } from '../../types/sync';

export class GitHubSyncProvider implements ISyncProvider {
  readonly name = 'github' as const;
  private config: GitHubSyncConfig;
  private readonly baseUrl = 'https://api.github.com';

  constructor() {
    this.config = {
      filename: 'unitab-data.json',
      description: 'UniTab Browser Extension Data'
    };
  }

  /**
   * 初始化提供商
   */
  async initialize(config: GitHubSyncConfig): Promise<void> {
    try {
      // 先加载保存的配置
      await this.loadConfig();
      
      // 合并传入的配置（传入的配置优先级更高）
      this.config = {
        ...this.config,
        ...config
      };
      
      // 如果传入的配置中没有token，但本地存储中有，则使用本地存储的
      if (!this.config.token) {
        await this.loadConfig();
      }
      
      // 如果没有 gistId，尝试从 SyncManager 的配置中获取
      if (!this.config.gistId && config.gistId) {
        this.config.gistId = config.gistId;
      }
      
      console.log('GitHub sync provider initialized with config:', {
        hasToken: !!this.config.token,
        hasGistId: !!this.config.gistId,
        filename: this.config.filename
      });
    } catch (error) {
      console.error('GitHub sync provider initialization failed:', error);
      throw error;
    }
  }

  /**
   * 检查是否已认证
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.config.token) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('GitHub authentication check failed:', error);
      return false;
    }
  }

  /**
   * 进行认证
   */
  async authenticate(): Promise<boolean> {
    try {
      // 由于GitHub OAuth需要客户端密钥，这里提供一个简化的实现
      // 实际使用中，建议用户手动创建Personal Access Token
      
      // 打开GitHub Personal Access Token创建页面
      const tokenUrl = 'https://github.com/settings/tokens/new?scopes=gist&description=UniTab%20Browser%20Extension';
      
      // 在新标签页中打开
      await chrome.tabs.create({ url: tokenUrl });
      
      // 提示用户手动输入token
      alert('请在打开的GitHub页面创建Personal Access Token，然后在设置中手动输入该Token。\n\n需要的权限：gist');
      
      return false; // 返回false，让用户手动输入token
    } catch (error) {
      console.error('GitHub authentication failed:', error);
      return false;
    }
  }

  /**
   * 上传数据到 GitHub Gist
   */
  async upload(data: SyncData): Promise<SyncResult> {
    try {
      console.log('GitHub upload starting with config:', {
        hasToken: !!this.config.token,
        hasGistId: !!this.config.gistId,
        gistId: this.config.gistId,
        filename: this.config.filename
      });
      
      if (!this.config.token) {
        throw new Error('GitHub token is required for upload');
      }

      const gistData = {
        description: this.config.description || 'UniTab Browser Extension Data',
        public: false,
        files: {
          [this.config.filename || 'unitab-data.json']: {
            content: JSON.stringify(data, null, 2)
          }
        }
      };

      let response: Response;
      let url: string;
      
      if (this.config.gistId) {
        // 更新现有 Gist
        url = `${this.baseUrl}/gists/${this.config.gistId}`;
        console.log('Updating existing Gist:', url);
        response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'UniTab-Extension'
          },
          body: JSON.stringify(gistData)
        });
      } else {
        // 创建新 Gist
        url = `${this.baseUrl}/gists`;
        console.log('Creating new Gist:', url);
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'UniTab-Extension'
          },
          body: JSON.stringify(gistData)
        });
      }

      console.log('GitHub API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = `${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('GitHub API error details:', errorData);
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        
        // 如果是 404 错误且有 gistId，可能是 Gist 被删除了，尝试创建新的
        if (response.status === 404 && this.config.gistId) {
          console.log('Gist not found, creating new one...');
          this.config.gistId = undefined;
          await this.saveConfig();
          return this.upload(data); // 递归调用创建新 Gist
        }
        
        throw new Error(`GitHub API error: ${errorMessage}`);
      }

      const result = await response.json();
      console.log('GitHub upload successful, Gist ID:', result.id);
      
      // 保存 Gist ID（如果是新创建的）
      if (!this.config.gistId) {
        this.config.gistId = result.id;
        // 保存配置到 storage
        await this.saveConfig();
        console.log('Saved new Gist ID to config:', result.id);
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        version: data.version
      };
    } catch (error) {
      console.error('GitHub upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 从 GitHub Gist 下载数据
   */
  async download(): Promise<SyncData> {
    try {
      if (!this.config.token || !this.config.gistId) {
        throw new Error('Not authenticated or no Gist ID');
      }

      const response = await fetch(`${this.baseUrl}/gists/${this.config.gistId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const gist = await response.json();
      const file = gist.files[this.config.filename];
      
      if (!file) {
        throw new Error(`File ${this.config.filename} not found in Gist`);
      }

      const data = JSON.parse(file.content);
      return data as SyncData;
    } catch (error) {
      console.error('GitHub download failed:', error);
      throw error;
    }
  }

  /**
   * 检查远程是否有更新
   */
  async hasRemoteUpdates(localTimestamp: string): Promise<boolean> {
    try {
      if (!this.config.token || !this.config.gistId) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/gists/${this.config.gistId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        return false;
      }

      const gist = await response.json();
      const remoteUpdatedAt = new Date(gist.updated_at).getTime();
      const localUpdatedAt = new Date(localTimestamp).getTime();
      
      return remoteUpdatedAt > localUpdatedAt;
    } catch (error) {
      console.error('Check remote updates failed:', error);
      return false;
    }
  }

  /**
   * 删除远程数据
   */
  async deleteRemote(): Promise<SyncResult> {
    try {
      if (!this.config.token || !this.config.gistId) {
        throw new Error('Not authenticated or no Gist ID');
      }

      const response = await fetch(`${this.baseUrl}/gists/${this.config.gistId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      // 清除本地配置
      this.config.gistId = undefined;
      await this.saveConfig();

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('GitHub delete failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 构建 OAuth 认证 URL
   */
  private buildAuthUrl(): string {
    const clientId = 'your_github_app_client_id'; // 需要替换为实际的 Client ID
    const redirectUri = chrome.identity.getRedirectURL();
    const scope = 'gist';
    const state = Math.random().toString(36).substring(7);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
      response_type: 'code'
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * 从重定向 URL 中提取访问令牌
   */
  private extractTokenFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      
      if (code) {
        // 这里需要将 code 交换为 access_token
        // 由于安全原因，这个步骤通常需要在后端完成
        // 或者使用 GitHub App 的方式
        return code; // 临时返回 code，实际应该是 token
      }
      
      return null;
    } catch (error) {
      console.error('Extract token failed:', error);
      return null;
    }
  }

  /**
   * 保存配置到 Chrome Storage
   */
  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.local.set({
        'sync_github_config': this.config
      });
    } catch (error) {
      console.error('Save GitHub config failed:', error);
    }
  }

  /**
   * 从 Chrome Storage 加载配置
   */
  async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('sync_github_config');
      if (result.sync_github_config) {
        this.config = { ...this.config, ...result.sync_github_config };
      }
    } catch (error) {
      console.error('Load GitHub config failed:', error);
    }
  }
}