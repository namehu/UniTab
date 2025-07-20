import React, { useState, useEffect } from 'react';
import { Archive } from 'lucide-react';
import { useAutoSync } from '../hooks/useAutoSync';
import type { TabGroup } from '../types/storage';

// 类型别名以保持兼容性
type Group = Omit<TabGroup, 'id' | 'pinned' | 'locked'> & { id: string };

const App: React.FC = () => {
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  // 使用自动同步 hook
  useAutoSync({
    checkOnMount: true,
    syncThresholdMinutes: 30
  });

  useEffect(() => {
    const loadRecentGroups = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getData'
        });
        if (response.success && response.data.groups.length > 0) {
          return setRecentGroups(response.data.groups.slice(0, 3));
        }
        setRecentGroups([]);
      } catch (error) {
        console.error('Error loading recent groups:', error);
      }
      setRecentGroups([]);
    };
    loadRecentGroups();
  }, []);

  const handleAggregate = async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'aggregateTabs'
      });
      if (response.success) {
        setTimeout(() => window.close(), 500);
      } else {
        alert(`聚合失败: ${response.error}`); // 添加用户可见的错误提示
      }
    } catch (error) {
      alert(`聚合出错: ${error}`); // 添加用户可见的错误提示
    } finally {
      setLoading(false);
    }
  };

  const openTabList = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tab_list.html') });
    window.close();
  };

  const openOptions = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    window.close();
  };

  const restoreGroup = async (group: Group) => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'restoreTabs',
        tabs: group.tabs
      });
      if (response.success) {
        setTimeout(() => window.close(), 500);
      } else {
        console.error('Restore failed:', response.error);
      }
    } catch (error) {
      console.error('Error restoring group:', error);
    } finally {
      setLoading(false);
    }
  };

  const openGroupDetail = (groupId: string) => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`tab_list.html#group-${groupId}`)
    });
    window.close();
  };

  return (
    <div className="w-80 bg-gray-50">
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="flex items-center space-x-3 rounded-lg bg-white p-4">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600" />
            <span className="text-sm text-gray-700">处理中...</span>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">Uni Tab</h1>
          <button onClick={openTabList} className="text-sm text-blue-600 hover:text-blue-800">
            查看全部
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAggregate}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-blue-700"
          >
            <Archive className="h-5 w-5" />
            <span>聚合当前窗口标签</span>
          </button>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-gray-700">最近的分组</h2>
          <div className="space-y-2">
            {recentGroups.length ? (
              recentGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => openGroupDetail(group.id)}
                  className="group-item fade-in cursor-pointer rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-gray-800">{group.name}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {group.tabs.length} 个标签页 •{' '}
                        {new Date(group.createdAt).toLocaleDateString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="ml-2 flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreGroup(group);
                        }}
                        className="restore-group p-1 text-blue-600 hover:text-blue-800"
                        title="恢复所有标签页"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-sm text-gray-500">暂无保存的标签页分组</div>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-4">
          <div className="flex justify-between text-xs text-gray-500">
            <button onClick={openOptions} className="hover:text-gray-700">
              设置
            </button>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
