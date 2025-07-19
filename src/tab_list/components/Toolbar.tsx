import React from 'react';
import type { ToolbarProps } from '../types';

/**
 * 工具栏组件
 * 显示统计信息、排序选项和视图切换
 */
export const Toolbar: React.FC<ToolbarProps> = ({ 
  stats, 
  sort, 
  onSortChange, 
  view, 
  onViewChange 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* 左侧：统计信息 */}
        <div className="flex items-center space-x-6">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{stats.groupCount}</span> 个分组
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{stats.tabCount}</span> 个标签页
          </div>
        </div>
        
        {/* 右侧：排序和视图控制 */}
        <div className="flex items-center space-x-4">
          {/* 排序选择器 */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">排序：</label>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as any)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">最新创建</option>
              <option value="oldest">最早创建</option>
              <option value="name">名称</option>
              <option value="tabs">标签页数量</option>
            </select>
          </div>
          
          {/* 视图切换按钮 */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewChange('list')}
              className={`p-2 rounded ${view === 'list' 
                ? 'bg-white shadow-sm text-blue-600' 
                : 'text-gray-600 hover:text-gray-900'
              }`}
              title="列表视图"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => onViewChange('grid')}
              className={`p-2 rounded ${view === 'grid' 
                ? 'bg-white shadow-sm text-blue-600' 
                : 'text-gray-600 hover:text-gray-900'
              }`}
              title="网格视图"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};