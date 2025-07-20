import React, { useEffect, useState } from 'react';
import { Cloud, RotateCw } from 'lucide-react';
import { syncStatusManager, type SyncStatusInfo } from '../../utils/sync/SyncStatusManager';
import type { HeaderProps } from '../types';

/**
 * 应用头部组件
 * 包含应用标题、搜索框、新建分组按钮和设置按钮
 */
export const Header: React.FC<HeaderProps> = ({ onSearch, onNewGroup, onOpenSettings, onOpenSyncSettings }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>({ status: 'idle' });

  useEffect(() => {
    // 订阅同步状态变化
    const unsubscribe = syncStatusManager.subscribe(setSyncStatus);

    // 初始化时检查同步状态
    syncStatusManager.checkSyncStatus();

    return unsubscribe;
  }, []);

  // 根据同步状态获取图标
  const getSyncIcon = () => {
    return <Cloud className="h-5 w-5 text-gray-600" />;
  };

  // 根据同步状态获取状态指示器
  const getSyncStatusIndicator = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return (
          <div className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-white shadow-sm">
            <RotateCw className="h-1.5 w-1.5 animate-spin text-blue-500" />
          </div>
        );
      case 'success':
      case 'connected':
        return (
          <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-green-500 shadow-sm" />
        );
      case 'error':
        return (
          <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-red-500 shadow-sm" />
        );
      case 'connecting':
      case 'initializing':
        return (
          <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-yellow-500 shadow-sm" />
        );
      case 'idle':
      default:
        return null;
    }
  };

  // 根据同步状态获取提示信息
  const getSyncTooltip = () => {
    switch (syncStatus.status) {
      case 'initializing':
        return syncStatus.message || '正在初始化同步...';
      case 'connected':
        return syncStatus.message || '远程同步已连接';
      case 'syncing':
        return syncStatus.message || '正在同步数据...';
      case 'success':
        return syncStatus.message || '同步成功';
      case 'error':
        return syncStatus.message || '同步失败';
      case 'idle':
      default:
        return '点击配置同步设置';
    }
  };
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* 左侧：应用标题和图标 */}
          <div className="flex items-center space-x-4">
            <img src="../icons/icon48.svg" alt="Uni Tab" className="h-8 w-8" />
            <h1 className="text-xl font-semibold text-gray-900">标签页管理</h1>
          </div>

          {/* 右侧：搜索框和操作按钮 */}
          <div className="flex items-center space-x-4">
            {/* 搜索框 */}
            <input
              type="text"
              placeholder="搜索分组或标签页..."
              onChange={(e) => onSearch(e.target.value)}
              className="input-field w-64"
            />

            {/* 新建分组按钮 */}
            <button onClick={onNewGroup} className="btn btn-primary" title="创建新的标签页分组">
              新建分组
            </button>

            {/* 同步设置按钮（合并同步状态指示器） */}
            <button
              onClick={onOpenSyncSettings}
              className="relative rounded-full p-2 transition-colors hover:bg-gray-100"
              title={getSyncTooltip()}
            >
              {getSyncIcon()}
              {getSyncStatusIndicator()}
            </button>

            {/* 设置按钮 */}
            <button onClick={onOpenSettings} className="rounded-full p-2 hover:bg-gray-100" title="打开设置页面">
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
