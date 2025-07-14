import React from 'react'
import type { Tab, Group, GroupListProps } from '../types'

/**
 * 分组列表组件
 * 根据视图模式显示分组列表（网格或列表）
 */
export const GroupList: React.FC<GroupListProps> = ({ groups, view, onGroupClick }) => {
  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分组</h3>
        <p className="text-gray-500">点击&ldquo;新建分组&rdquo;开始管理您的标签页</p>
      </div>
    )
  }

  return (
    <div
      className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}
    >
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} view={view} onClick={() => onGroupClick(group)} />
      ))}
    </div>
  )
}

/**
 * 分组卡片组件属性接口
 */
interface GroupCardProps {
  /** 分组数据 */
  group: Group
  /** 视图模式 */
  view: string
  /** 点击回调 */
  onClick: () => void
}

/**
 * 分组卡片组件
 * 显示单个分组的信息
 */
const GroupCard: React.FC<GroupCardProps> = ({ group, view, onClick }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDomainCount = (tabs: Tab[]) => {
    const domains = new Set(
      tabs.map((tab) => {
        try {
          return new URL(tab.url).hostname
        } catch {
          return 'unknown'
        }
      })
    )
    return domains.size
  }

  if (view === 'list') {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-medium text-gray-900 truncate">{group.name}</h3>
              {group.locked && (
                <span className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  已锁定
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
              <span>{group.tabs.length} 个标签页</span>
              <span>{getDomainCount(group.tabs)} 个域名</span>
              <span>{formatDate(group.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {group.tabs.slice(0, 4).map((tab, index) => (
              <img
                key={index}
                src={tab.favIconUrl || '../icons/icon16.svg'}
                alt={tab.title}
                className="w-4 h-4"
                title={tab.title}
              />
            ))}
            {group.tabs.length > 4 && <span className="text-xs text-gray-400">+{group.tabs.length - 4}</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 truncate pr-2">{group.name}</h3>
        {group.locked && (
          <span className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full flex-shrink-0">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            锁定
          </span>
        )}
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">标签页数量</span>
          <span className="font-medium text-gray-900">{group.tabs.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">域名数量</span>
          <span className="font-medium text-gray-900">{getDomainCount(group.tabs)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">创建时间</span>
          <span className="font-medium text-gray-900">{formatDate(group.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        {group.tabs.slice(0, 6).map((tab, index) => (
          <img
            key={index}
            src={tab.favIconUrl || '../icons/icon16.svg'}
            alt={tab.title}
            className="w-4 h-4"
            title={tab.title}
          />
        ))}
        {group.tabs.length > 6 && <span className="text-xs text-gray-400 ml-2">+{group.tabs.length - 6}</span>}
      </div>
    </div>
  )
}
