import React from 'react';
import { Cloud } from 'lucide-react';
import type { HeaderProps } from '../types';

/**
 * 应用头部组件
 * 包含应用标题、搜索框、新建分组按钮和设置按钮
 */
export const Header: React.FC<HeaderProps> = ({ 
  onSearch, 
  onNewGroup, 
  onOpenSettings,
  onOpenSyncSettings 
}) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 左侧：应用标题和图标 */}
          <div className="flex items-center space-x-4">
            <img 
              src="../icons/icon48.svg" 
              alt="Uni Tab" 
              className="w-8 h-8" 
            />
            <h1 className="text-xl font-semibold text-gray-900">
              标签页管理
            </h1>
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
            <button 
              onClick={onNewGroup} 
              className="btn btn-primary"
              title="创建新的标签页分组"
            >
              新建分组
            </button>
            
            {/* 同步设置按钮 */}
            <button
              onClick={onOpenSyncSettings}
              className="p-2 rounded-full hover:bg-gray-100"
              title="同步设置"
            >
              <Cloud className="w-6 h-6 text-gray-600" />
            </button>
            
            {/* 设置按钮 */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full hover:bg-gray-100"
              title="打开设置页面"
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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