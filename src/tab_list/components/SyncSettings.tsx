/**
 * 同步设置组件
 * 提供同步配置、认证、手动同步等功能
 */

import React, { useState, useEffect } from 'react';
import { Cloud, Settings, RefreshCw, Upload, Download, AlertTriangle, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import type { SyncConfig, SyncStatus, SyncProvider } from '../../types/sync';
import { syncManager } from '../../utils/sync/SyncManager';
import { SyncProviderFactory } from '../../utils/sync/SyncProviderFactory';

interface SyncSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncSettings: React.FC<SyncSettingsProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<SyncConfig>(syncManager.config);
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [githubToken, setGithubToken] = useState('');

  // 监听同步状态变化
  useEffect(() => {
    const handleStatusChange = (newStatus: SyncStatus) => {
      setStatus(newStatus);
    };

    syncManager.onStatusChange(handleStatusChange);

    // 初始化认证状态
    checkAuthStatus();

    return () => {
      // 清理监听器（实际实现中可能需要提供取消监听的方法）
    };
  }, []);

  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      // 直接使用SyncManager的provider实例，避免重复创建
      const authenticated = await syncManager.isAuthenticated();
      setIsAuthenticated(authenticated);
      console.log('Auth status checked:', authenticated);
    } catch (error) {
      console.error('Check auth status failed:', error);
      setIsAuthenticated(false);
    }
  };

  // 处理提供商变更
  const handleProviderChange = async (provider: SyncProvider) => {
    const newConfig = {
      ...config,
      provider,
      providerConfig: {}
    };

    setConfig(newConfig);
    await syncManager.setConfig(newConfig);
    setIsAuthenticated(false);
  };

  // 处理GitHub认证
  const handleGitHubAuth = async () => {

    try {
      // 首先验证token是否有效
      const testResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!testResponse.ok) {
        throw new Error('Token验证失败，请检查Token是否正确且具有gist权限');
      }

      // Token验证成功，保存配置
      const newConfig = {
        ...config,
        providerConfig: {
          ...config.providerConfig,
          token: githubToken,
          filename: 'unitab-data.json',
          description: 'UniTab Browser Extension Data'
        }
      };

      setConfig(newConfig);
      await syncManager.setConfig(newConfig);

      // 直接保存到GitHubSyncProvider的配置中
      await chrome.storage.local.set({
        sync_github_config: {
          token: githubToken,
          filename: 'unitab-data.json',
          description: 'UniTab Browser Extension Data'
        }
      });

      // 检查认证状态
      await checkAuthStatus();
      setGithubToken('');
      alert('Token保存成功！');
    } catch (error) {
      console.error('GitHub auth with token failed:', error);
      alert(error instanceof Error ? error.message : '认证失败，请检查Token是否有效');
    }
  };

  // 打开GitHub Token创建页面
  const openGitHubTokenPage = () => {
    window.open('https://github.com/settings/tokens/new', '_blank');
  };

  // 手动同步
  const handleManualSync = async () => {
    try {
      const result = await syncManager.sync();
      if (result.success) {
        if (result.merged) {
          alert('✅ ' + (result.message || '同步成功，已自动合并多设备数据'));
        } else {
          alert('✅ 同步成功');
        }
      } else {
        if (result.conflict) {
          // 显示冲突解决选项
          const choice = confirm(
            `检测到同步冲突：\n\n` +
              `本地数据：${new Date(result.conflict.local.timestamp).toLocaleString()} (${result.conflict.local.device.name})\n` +
              `远程数据：${new Date(result.conflict.remote.timestamp).toLocaleString()} (${result.conflict.remote.device.name})\n\n` +
              `点击"确定"使用本地数据覆盖远程，点击"取消"使用远程数据覆盖本地。`
          );

          try {
            const resolution = choice ? 'local' : 'remote';
            const resolveResult = await syncManager.resolveConflict(result.conflict, resolution);

            if (resolveResult.success) {
              alert(`✅ 冲突已解决，使用了${choice ? '本地' : '远程'}数据`);
              if (!choice) {
                // 如果选择了远程数据，刷新页面
                window.location.reload();
              }
            } else {
              alert(`❌ 冲突解决失败: ${resolveResult.error}`);
            }
          } catch (error) {
            console.error('Resolve conflict failed:', error);
            alert('❌ 冲突解决失败，请重试');
          }
        } else {
          alert(`❌ 同步失败: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      alert('❌ 同步失败，请重试');
    }
  };

  // 上传数据
  const handleUpload = async () => {
    try {
      const result = await syncManager.upload();
      if (result.success) {
        alert('上传成功');
      } else {
        alert(`上传失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('上传失败，请重试');
    }
  };

  // 下载数据
  const handleDownload = async () => {
    if (confirm('下载远程数据将覆盖本地数据，确定要继续吗？')) {
      try {
        const result = await syncManager.download();
        if (result.success) {
          alert('下载成功');
          // 刷新页面以显示新数据
          window.location.reload();
        } else {
          alert(`下载失败: ${result.error}`);
        }
      } catch (error) {
        console.error('Download failed:', error);
        alert('下载失败，请重试');
      }
    }
  };

  // 移除同步配置
  const handleRemoveSync = async () => {
    if (confirm('确定要移除同步配置吗？这将清除所有同步设置和认证信息，但不会删除本地数据。')) {
      try {
        // 使用SyncManager的clearConfig方法清除所有配置
        await syncManager.clearConfig();

        // 更新本地状态
        const defaultConfig = {
          provider: 'github' as SyncProvider,
          providerConfig: {},
          lastSync: undefined
        };

        setConfig(defaultConfig);

        // 重置UI状态
        setIsAuthenticated(false);
        setGithubToken('');

        alert('同步配置已移除');
      } catch (error) {
        console.error('Remove sync config failed:', error);
        alert('移除同步配置失败，请重试');
      }
    }
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Cloud className="h-4 w-4 text-gray-500" />;
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return '同步中...';
      case 'success':
        return '同步成功';
      case 'error':
        return '同步失败';
      default:
        return '未同步';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h2 className="text-lg font-semibold">数据同步设置</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600">
            ×
          </button>
        </div>

        <div className="space-y-6 p-4">
          {/* 功能说明 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              📋 同步功能将保存您的所有标签页分组数据和应用设置到云端，确保在不同设备间保持一致的使用体验。
            </p>
          </div>

          {/* 同步状态说明 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-800">💡 配置远程同步后，所有数据变更将自动同步到云端。</p>
          </div>

          {/* 同步状态 */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
            {config.lastSync && (
              <span className="text-xs text-gray-500">{new Date(config.lastSync).toLocaleString()}</span>
            )}
          </div>

          {/* 同步提供商选择 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">同步提供商</label>
            <div className="relative">
              <select
                value={config.provider}
                onChange={(e) => handleProviderChange(e.target.value as SyncProvider)}
                className="w-full appearance-none rounded-md border border-gray-300 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SyncProviderFactory.getSupportedProviders().map((provider) => (
                  <option key={provider} value={provider}>
                    {provider === 'github' ? 'GitHub Gist' : provider}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* GitHub 认证 */}
          {config.provider === 'github' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">GitHub 认证</label>
              <div className="space-y-2">
                {!isAuthenticated ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>未认证</span>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="输入 GitHub Personal Access Token"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleGitHubAuth}
                        disabled={!githubToken}
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        确认
                      </button>
                      <div className="text-center">
                        <button
                          onClick={openGitHubTokenPage}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          创建 GitHub Personal Access Token
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">需要 &apos;gist&apos; 权限的 Personal Access Token</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>已认证</span>
                    </div>
                    <button
                      onClick={handleRemoveSync}
                      className="w-full rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                    >
                      移除同步配置
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 自动同步说明 */}
          {isAuthenticated && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-800">✅ 已启用远程同步。所有数据变更将自动同步到云端。</p>
            </div>
          )}

          {/* 手动操作按钮 */}
          {isAuthenticated && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">手动操作</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleManualSync}
                  disabled={status === 'syncing'}
                  className="flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  同步
                </button>
                <button
                  onClick={handleUpload}
                  disabled={status === 'syncing'}
                  className="flex items-center justify-center gap-1 rounded-md bg-green-600 px-3 py-2 text-xs text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  上传
                </button>
                <button
                  onClick={handleDownload}
                  disabled={status === 'syncing'}
                  className="flex items-center justify-center gap-1 rounded-md bg-orange-600 px-3 py-2 text-xs text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3 w-3" />
                  下载
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
