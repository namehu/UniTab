import React, { useState, useEffect } from "react";
import type { TabData, TabGroup } from '../types/background';

// 类型别名以保持兼容性
type Tab = TabData & { id: number };
type Group = Omit<TabGroup, 'id' | 'pinned' | 'locked'> & { id: string; };

const App: React.FC = () => {
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadRecentGroups = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: "getData",
        });
        if (response.success && response.data.groups.length > 0) {
          setRecentGroups(response.data.groups.slice(0, 3));
        } else {
          setRecentGroups([]);
        }
      } catch (error) {
        console.error("Error loading recent groups:", error);
        setRecentGroups([]);
      }
    };
    loadRecentGroups();
  }, []);

  const handleAggregate = async () => {
    console.log("handleAggregate called"); // 调试信息
    setLoading(true);
    try {
      console.log("Sending aggregateTabs message"); // 调试信息
      const response = await chrome.runtime.sendMessage({
        action: "aggregateTabs",
      });
      console.log("Response received:", response); // 调试信息
      if (response.success) {
        console.log("Aggregation successful, closing window"); // 调试信息
        // 可以添加一个提示，但由于窗口会关闭，可能看不到
        setTimeout(() => window.close(), 500);
      } else {
        console.error("Aggregation failed:", response.error);
        alert(`聚合失败: ${response.error}`); // 添加用户可见的错误提示
      }
    } catch (error) {
      console.error("Error aggregating tabs:", error);
      alert(`聚合出错: ${error}`); // 添加用户可见的错误提示
    } finally {
      setLoading(false);
    }
  };

  const openTabList = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tab_list.html") });
    window.close();
  };

  const openOptions = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    window.close();
  };

  const restoreGroup = async (group: Group) => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "restoreTabs",
        tabs: group.tabs,
      });
      if (response.success) {
        setTimeout(() => window.close(), 500);
      } else {
        console.error("Restore failed:", response.error);
      }
    } catch (error) {
      console.error("Error restoring group:", error);
    } finally {
      setLoading(false);
    }
  };

  const openGroupDetail = (groupId: string) => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`tab_list.html#group-${groupId}`),
    });
    window.close();
  };

  return (
    <div className="w-80 bg-gray-50">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-700">处理中...</span>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-800">Uni Tab</h1>
          <button
            onClick={openTabList}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            查看全部
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAggregate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              ></path>
            </svg>
            <span>聚合当前窗口标签</span>
          </button>
          <div className="text-xs text-gray-500 text-center">
            将当前窗口的标签页保存并关闭
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">最近的分组</h2>
          <div className="space-y-2">
            {recentGroups.length > 0 ? (
              recentGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => openGroupDetail(group.id)}
                  className="group-item bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md cursor-pointer fade-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-800 truncate">
                        {group.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {group.tabs.length} 个标签页 •{" "}
                        {new Date(group.createdAt).toLocaleDateString("zh-CN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="ml-2 flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreGroup(group);
                        }}
                        className="restore-group text-blue-600 hover:text-blue-800 p-1"
                        title="恢复所有标签页"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 text-sm py-4">
                暂无保存的标签页分组
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
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
