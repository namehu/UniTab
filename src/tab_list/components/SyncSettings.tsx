/**
 * 同步设置组件
 * 提供同步配置、认证、手动同步等功能
 */

import React, { useState, useEffect } from 'react'
import {
  Cloud,
  CloudOff,
  Settings,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import type { SyncConfig, SyncStatus, SyncProvider } from '../../types/sync'
import { syncManager } from '../../utils/sync/SyncManager'
import { SyncProviderFactory } from '../../utils/sync/SyncProviderFactory'

interface SyncSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export const SyncSettings: React.FC<SyncSettingsProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<SyncConfig>(syncManager.config)
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus())
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string>('')
  const [githubToken, setGithubToken] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)

  // 监听同步状态变化
  useEffect(() => {
    const handleStatusChange = (newStatus: SyncStatus) => {
      setStatus(newStatus)
    }

    syncManager.onStatusChange(handleStatusChange)

    // 初始化认证状态
    checkAuthStatus()

    return () => {
      // 清理监听器（实际实现中可能需要提供取消监听的方法）
    }
  }, [])

  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      const provider = SyncProviderFactory.createProvider(config.provider)
      // 重新初始化provider以加载最新配置
      await provider.initialize({})
      const authenticated = await provider.isAuthenticated()
      setIsAuthenticated(authenticated)
      console.log('Auth status checked:', authenticated)
    } catch (error) {
      console.error('Check auth status failed:', error)
      setIsAuthenticated(false)
    }
  }

  // 处理提供商变更
  const handleProviderChange = async (provider: SyncProvider) => {
    const newConfig = {
      ...config,
      provider,
      providerConfig: {}
    }

    setConfig(newConfig)
    await syncManager.setConfig(newConfig)
    setIsAuthenticated(false)
  }

  // 处理自动同步设置
  const handleAutoSyncChange = async (autoSync: boolean) => {
    const newConfig = { ...config, autoSync }
    setConfig(newConfig)
    await syncManager.setConfig(newConfig)
  }

  // 处理同步间隔变更
  const handleSyncIntervalChange = async (syncInterval: number) => {
    const newConfig = { ...config, syncInterval }
    setConfig(newConfig)
    await syncManager.setConfig(newConfig)
  }

  // 处理GitHub认证
  const handleGitHubAuth = async () => {
    if (showTokenInput && githubToken) {
      // 使用手动输入的Token
      try {
        // 首先验证token是否有效
        const testResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
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
        }

        setConfig(newConfig)
        await syncManager.setConfig(newConfig)

        // 直接保存到GitHubSyncProvider的配置中
        await chrome.storage.local.set({
          'sync_github_config': {
            token: githubToken,
            filename: 'unitab-data.json',
            description: 'UniTab Browser Extension Data'
          }
        });

        // 检查认证状态
        await checkAuthStatus()
        setShowTokenInput(false)
        setGithubToken('')
        alert('Token保存成功！')
      } catch (error) {
        console.error('GitHub auth with token failed:', error)
        alert(error instanceof Error ? error.message : '认证失败，请检查Token是否有效')
      }
    } else {
      // 打开GitHub Token创建页面
      setIsAuthenticating(true)
      try {
        const provider = SyncProviderFactory.createProvider('github')
        await provider.initialize(config.providerConfig)
        await provider.authenticate()

        // 显示token输入框
        setShowTokenInput(true)
      } catch (error) {
        console.error('GitHub auth failed:', error)
        alert('打开GitHub页面失败，请手动访问：https://github.com/settings/tokens/new')
      } finally {
        setIsAuthenticating(false)
      }
    }
  }

  // 手动同步
  const handleManualSync = async () => {
    try {
      const result = await syncManager.sync()
      if (result.success) {
        setLastSyncTime(new Date().toLocaleString())
        alert('同步成功')
      } else {
        alert(`同步失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Manual sync failed:', error)
      alert('同步失败，请重试')
    }
  }

  // 上传数据
  const handleUpload = async () => {
    try {
      const result = await syncManager.upload()
      if (result.success) {
        alert('上传成功')
      } else {
        alert(`上传失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert('上传失败，请重试')
    }
  }

  // 下载数据
  const handleDownload = async () => {
    if (confirm('下载远程数据将覆盖本地数据，确定要继续吗？')) {
      try {
        const result = await syncManager.download()
        if (result.success) {
          alert('下载成功')
          // 刷新页面以显示新数据
          window.location.reload()
        } else {
          alert(`下载失败: ${result.error}`)
        }
      } catch (error) {
        console.error('Download failed:', error)
        alert('下载失败，请重试')
      }
    }
  }

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Cloud className="w-4 h-4 text-gray-500" />
    }
  }

  // 获取状态文本
  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return '同步中...'
      case 'success':
        return '同步成功'
      case 'error':
        return '同步失败'
      default:
        return '未同步'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg font-semibold">数据同步设置</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            ×
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* 功能说明 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              📋 同步功能将保存您的所有标签页分组数据和应用设置到云端，确保在不同设备间保持一致的使用体验。
            </p>
          </div>

          {/* 同步状态 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">同步提供商</label>
            <select
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value as SyncProvider)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SyncProviderFactory.getSupportedProviders().map((provider) => (
                <option key={provider} value={provider}>
                  {provider === 'github' ? 'GitHub Gist' : provider}
                </option>
              ))}
            </select>
          </div>

          {/* GitHub 认证 */}
          {config.provider === 'github' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">GitHub 认证</label>
              <div className="space-y-2">
                {!isAuthenticated ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>未认证</span>
                    </div>

                    {!showTokenInput ? (
                      <div className="space-y-2">
                        <button
                          onClick={handleGitHubAuth}
                          disabled={isAuthenticating}
                          className="w-full px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAuthenticating ? '打开GitHub页面中...' : '创建 GitHub Personal Access Token'}
                        </button>
                        <button
                          onClick={() => setShowTokenInput(true)}
                          className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                        >
                          手动输入 Personal Access Token
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="password"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder="输入 GitHub Personal Access Token"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleGitHubAuth}
                            disabled={!githubToken}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            确认
                          </button>
                          <button
                            onClick={() => {
                              setShowTokenInput(false)
                              setGithubToken('')
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                          >
                            取消
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">需要 &apos;gist&apos; 权限的 Personal Access Token</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>已认证</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 自动同步设置 */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.autoSync}
                onChange={(e) => handleAutoSyncChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">启用自动同步</span>
            </label>
          </div>

          {/* 同步间隔设置 */}
          {config.autoSync && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">同步间隔（分钟）</label>
              <select
                value={config.syncInterval}
                onChange={(e) => handleSyncIntervalChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 分钟</option>
                <option value={15}>15 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={60}>1 小时</option>
                <option value={180}>3 小时</option>
              </select>
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
                  className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  同步
                </button>
                <button
                  onClick={handleUpload}
                  disabled={status === 'syncing'}
                  className="flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  <Upload className="w-3 h-3" />
                  上传
                </button>
                <button
                  onClick={handleDownload}
                  disabled={status === 'syncing'}
                  className="flex items-center justify-center gap-1 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  <Download className="w-3 h-3" />
                  下载
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
