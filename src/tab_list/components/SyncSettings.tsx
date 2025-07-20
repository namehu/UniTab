import React, { useState, useEffect } from 'react';
import { Settings, Github, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { UnifiedSyncManager } from '../../utils/sync/UnifiedSyncManager';
import { UnifiedStorageManager } from '../../utils/storage/UnifiedStorageManager';
import type { GitHubUserInfo, SyncResult } from '../../types/storage';

interface SyncSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncSettings: React.FC<SyncSettingsProps> = ({ isOpen, onClose }) => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<GitHubUserInfo | null>(null);
  const [token, setToken] = useState('');
  const [gistId, setGistId] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSyncStatus();
    }
  }, [isOpen]);

  const loadSyncStatus = async () => {
    try {
      const configured = await UnifiedSyncManager.isConfigured();
      const authenticated = await UnifiedSyncManager.isAuthenticated();
      const user = await UnifiedSyncManager.getGitHubUserInfo();

      setIsConfigured(configured);
      setIsAuthenticated(authenticated);
      setUserInfo(user);

      if (configured) {
        const settings = await UnifiedStorageManager.getSettings();
        setGistId(settings.sync.github?.gistId || '');
      }
    } catch (error) {
      console.error('加载同步状态失败:', error);
    }
  };

  const handleConfigure = async () => {
    if (!token.trim()) {
      setMessage({ type: 'error', text: '请输入 GitHub Token' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result: SyncResult = await UnifiedSyncManager.configureGitHub(token.trim(), gistId.trim() || undefined);

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await loadSyncStatus();
        setToken(''); // 清空 token 输入
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '配置失败，请检查网络连接' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const result: SyncResult = await UnifiedSyncManager.sync();

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '同步失败，请检查网络连接' });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearConfig = async () => {
    if (!confirm('确定要清除同步配置吗？这将断开与 GitHub 的连接。')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result: SyncResult = await UnifiedSyncManager.clearSyncConfig();

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await loadSyncStatus();
        setToken('');
        setGistId('');
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '清除配置失败' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">同步设置</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* 状态显示 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">配置状态</span>
              <div className="flex items-center space-x-1">
                {isConfigured ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">已配置</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">未配置</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">认证状态</span>
              <div className="flex items-center space-x-1">
                {isAuthenticated ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">已认证</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">未认证</span>
                  </>
                )}
              </div>
            </div>

            {userInfo && (
              <div className="flex items-center space-x-3 rounded-lg bg-gray-50 p-3">
                <img src={userInfo.avatar_url} alt={userInfo.name} className="h-8 w-8 rounded-full" />
                <div>
                  <div className="text-sm font-medium text-gray-900">{userInfo.name}</div>
                  <div className="text-xs text-gray-500">@{userInfo.login}</div>
                </div>
              </div>
            )}
          </div>

          {/* 配置表单 */}
          {!isAuthenticated && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">GitHub Personal Access Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">需要 &apos;gist&apos; 权限的 GitHub Token</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Gist ID (可选)</label>
                <input
                  type="text"
                  value={gistId}
                  onChange={(e) => setGistId(e.target.value)}
                  placeholder="留空将自动创建新的 Gist"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleConfigure}
                disabled={loading || !token.trim()}
                className="flex w-full items-center justify-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                <span>{loading ? '配置中...' : '配置 GitHub 同步'}</span>
              </button>
            </div>
          )}

          {/* 同步操作 */}
          {isAuthenticated && (
            <div className="space-y-4">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex w-full items-center justify-center space-x-2 rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                <span>{syncing ? '同步中...' : '立即同步'}</span>
              </button>

              <button
                onClick={handleClearConfig}
                disabled={loading}
                className="w-full rounded-md border border-red-300 px-4 py-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                清除同步配置
              </button>
            </div>
          )}

          {/* 消息显示 */}
          {message && (
            <div
              className={`flex items-start space-x-2 rounded-lg p-3 ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : message.type === 'error'
                    ? 'bg-red-50 text-red-800'
                    : 'bg-blue-50 text-blue-800'
              }`}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          {/* 帮助信息 */}
          <div className="space-y-1 text-xs text-gray-500">
            <p>• 需要创建 GitHub Personal Access Token 并授予 &apos;gist&apos; 权限</p>
            <p>• 数据将加密存储在私有 Gist 中</p>
            <p>• 支持多设备间的数据同步</p>
          </div>
        </div>
      </div>
    </div>
  );
};
