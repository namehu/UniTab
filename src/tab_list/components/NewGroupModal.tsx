import React, { useState, useEffect } from 'react';
import type { Tab, NewGroupModalProps } from '../types';

/**
 * 新建分组模态框组件
 * 允许用户创建新的标签页分组，可以选择当前窗口的标签页
 */
export const NewGroupModal: React.FC<NewGroupModalProps> = ({ 
  onClose, 
  onSave 
}) => {
  const [name, setName] = useState("");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selectedTabs, setSelectedTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 加载当前窗口的标签页
   */
  useEffect(() => {
    const loadTabs = async () => {
      try {
        setLoading(true);
        const currentTabs = await chrome.tabs.query({ currentWindow: true });
        
        // 过滤掉当前页面和扩展页面
        const filteredTabs = currentTabs.filter(tab => {
          return !tab.url?.includes('chrome-extension://') && 
                 !tab.url?.startsWith('chrome://') &&
                 !tab.url?.startsWith('edge://') &&
                 !tab.url?.startsWith('about:');
        });
        
        const formattedTabs = filteredTabs.map(tab => ({
          id: tab.id || 0,
          url: tab.url || '',
          title: tab.title || 'Untitled',
          favIconUrl: tab.favIconUrl
        }));
        
        setTabs(formattedTabs);
      } catch (error) {
        console.error('Error loading tabs:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTabs();
  }, []);

  /**
   * 切换标签页选择状态
   */
  const toggleTabSelection = (tab: Tab) => {
    if (selectedTabs.some(t => t.id === tab.id)) {
      setSelectedTabs(selectedTabs.filter(t => t.id !== tab.id));
    } else {
      setSelectedTabs([...selectedTabs, tab]);
    }
  };

  /**
   * 全选/取消全选
   */
  const toggleSelectAll = () => {
    if (selectedTabs.length === tabs.length) {
      setSelectedTabs([]);
    } else {
      setSelectedTabs([...tabs]);
    }
  };

  /**
   * 保存分组
   */
  const handleSave = () => {
    if (name.trim() === '') {
      alert('请输入分组名称');
      return;
    }
    
    if (selectedTabs.length === 0) {
      alert('请至少选择一个标签页');
      return;
    }
    
    onSave(name, selectedTabs);
  };

  /**
   * 生成默认分组名称
   */
  const generateDefaultName = () => {
    const now = new Date();
    const formattedDate = now.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return `标签页分组 - ${formattedDate}`;
  };

  /**
   * 使用默认名称
   */
  const useDefaultName = () => {
    setName(generateDefaultName());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* 模态框头部 */}
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">创建新分组</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
            title="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 分组名称 */}
        <div className="p-6 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            分组名称
          </label>
          <div className="flex space-x-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入分组名称"
              className="input-field flex-1"
              autoFocus
            />
            <button 
              onClick={useDefaultName}
              className="btn btn-secondary"
              title="使用默认名称"
            >
              使用默认名称
            </button>
          </div>
        </div>

        {/* 标签页选择 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              选择要保存的标签页
            </h3>
            <button 
              onClick={toggleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedTabs.length === tabs.length ? '取消全选' : '全选'}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : tabs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              没有可保存的标签页
            </div>
          ) : (
            <div className="space-y-2">
              {tabs.map((tab) => {
                const isSelected = selectedTabs.some(t => t.id === tab.id);
                return (
                  <div
                    key={tab.id}
                    onClick={() => toggleTabSelection(tab)}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTabSelection(tab)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <img
                      src={tab.favIconUrl || "../icons/icon16.svg"}
                      alt=""
                      className="w-4 h-4 mr-3 flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "../icons/icon16.svg";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate" title={tab.title}>
                        {tab.title}
                      </div>
                      <div className="text-sm text-gray-500 truncate" title={tab.url}>
                        {tab.url}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
          <button onClick={onClose} className="btn btn-secondary">
            取消
          </button>
          <button 
            onClick={handleSave} 
            className="btn btn-primary"
            disabled={selectedTabs.length === 0 || name.trim() === ''}
          >
            创建分组
            {selectedTabs.length > 0 && (
              <span className="ml-1 text-sm">({selectedTabs.length})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};