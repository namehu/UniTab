import React, { useState } from 'react';
import type { Tab, Group, GroupDetailModalProps } from '../types';

/**
 * 分组详情模态框组件
 * 显示分组的详细信息，支持编辑、锁定、删除等操作
 */
export const GroupDetailModal: React.FC<GroupDetailModalProps> = ({ 
  group, 
  onClose, 
  onUpdate 
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);

  /**
   * 保存分组名称
   */
  const handleNameSave = async () => {
    if (groupName.trim() === '' || groupName === group.name) {
      setIsEditingName(false);
      setGroupName(group.name);
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: "updateGroupName",
        groupId: group.id,
        newName: groupName,
      });
      setIsEditingName(false);
      onUpdate();
    } catch (error) {
      alert("修改失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  /**
   * 切换分组锁定状态
   */
  const handleToggleLock = async () => {
    try {
      await chrome.runtime.sendMessage({
        action: "toggleGroupLock",
        groupId: group.id,
      });
      onUpdate();
    } catch (error) {
      alert("操作失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  /**
   * 删除分组
   */
  const handleDeleteGroup = async () => {
    if (group.locked) {
      alert("无法删除已锁定的分组");
      return;
    }
    if (confirm("确定要删除这个分组吗？此操作不可恢复。")) {
      try {
        await chrome.runtime.sendMessage({
          action: "deleteGroup",
          groupId: group.id,
        });
        onClose();
        onUpdate();
      } catch (error) {
        alert("删除失败: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  /**
   * 恢复分组中的所有标签页
   */
  const handleRestoreGroup = async () => {
    try {
      await chrome.runtime.sendMessage({
        action: "restoreTabs",
        tabs: group.tabs,
      });
      onClose();
    } catch (error) {
      alert("恢复失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  /**
   * 在新窗口中恢复标签页
   */
  const handleRestoreInNewWindow = async () => {
    try {
      await chrome.runtime.sendMessage({
        action: "restoreTabs",
        tabs: group.tabs,
        openInNewWindow: true,
      });
      onClose();
    } catch (error) {
      alert("恢复失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 模态框头部 */}
        <div className="p-6 border-b flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {isEditingName ? (
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onBlur={handleNameSave}
                onKeyPress={(e) => e.key === "Enter" && handleNameSave()}
                autoFocus
                className="input-field text-lg font-semibold"
                disabled={group.locked}
              />
            ) : (
              <h2
                onDoubleClick={() => !group.locked && setIsEditingName(true)}
                className={`text-xl font-semibold text-gray-900 ${
                  !group.locked ? "cursor-pointer hover:text-blue-600" : ""
                }`}
                title={!group.locked ? "双击编辑名称" : "已锁定，无法编辑"}
              >
                {group.name}
              </h2>
            )}
            {group.locked && (
              <span className="inline-flex items-center px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
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

        {/* 分组信息 */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">标签页数量：</span>
              <span className="font-medium text-gray-900">{group.tabs.length}</span>
            </div>
            <div>
              <span className="text-gray-500">创建时间：</span>
              <span className="font-medium text-gray-900">{formatDate(group.createdAt)}</span>
            </div>
            <div>
              <span className="text-gray-500">状态：</span>
              <span className={`font-medium ${
                group.locked ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {group.locked ? '已锁定' : '正常'}
              </span>
            </div>
          </div>
        </div>

        {/* 标签页列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">标签页列表</h3>
          <div className="space-y-2">
            {group.tabs.map((tab, index) => (
              <div
                key={`${tab.id}-${index}`}
                className="flex items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-100"
              >
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
                <a
                  href={tab.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 text-blue-600 hover:text-blue-800 flex-shrink-0"
                  title="在新标签页中打开"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="p-6 border-t bg-gray-50 flex justify-between">
          <div className="flex space-x-3">
            <button
              onClick={handleToggleLock}
              className={`btn ${
                group.locked ? "btn-secondary" : "btn-warning"
              }`}
              title={group.locked ? "解锁分组" : "锁定分组"}
            >
              {group.locked ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                  </svg>
                  解锁分组
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  锁定分组
                </>
              )}
            </button>
            <button
              onClick={handleDeleteGroup}
              className="btn btn-danger"
              disabled={group.locked}
              title={group.locked ? "无法删除已锁定的分组" : "删除分组"}
            >
              删除分组
            </button>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleRestoreInNewWindow} 
              className="btn btn-secondary"
              title="在新窗口中恢复所有标签页"
            >
              新窗口恢复
            </button>
            <button 
              onClick={handleRestoreGroup} 
              className="btn btn-primary"
              title="在当前窗口中恢复所有标签页"
            >
              恢复标签页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};