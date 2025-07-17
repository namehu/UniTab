// oxlint-disable max-lines
/**
 * Background Service Worker
 * 处理核心的标签页管理逻辑
 *
 * 主要功能：
 * - 监听插件图标点击事件
 * - 聚合当前窗口标签页
 * - 处理来自其他组件的消息
 * - 管理数据存储和同步
 */

import type {
  StorageData,
  TabGroup,
  TabData,
  Statistics,
  MessageRequest,
  MessageResponse,
  ExportFormat
} from './types/background.js';

import { StorageManager, createResponse, generateId, formatDate, updateDataMetadata } from './utils/storage.js';
import { TabManager } from './utils/tabs.js';
import { syncManager } from './utils/sync/SyncManager.js';
import { initializeSync, handleSyncMessages } from './background/syncIntegration.js';

/**
 * 检查是否配置了远程同步并触发同步
 */
async function triggerSyncIfEnabled(): Promise<void> {
  try {
    // 检查是否配置了远程同步提供商
    const config = syncManager.config;
    console.log('Checking sync config:', config);

    if (!config.providerConfig || Object.keys(config.providerConfig).length === 0) {
      console.log('Remote sync not configured, skipping auto sync');
      return; // 未配置远程同步，跳过
    }

    console.log('Triggering auto sync after data change');
    // 异步触发同步，不等待结果
    syncManager.sync().catch((error) => {
      console.log('Background sync failed:', error);
    });
  } catch (error) {
    console.error('Error checking sync status:', error);
  }
}

// ==================== 初始化和事件监听 ====================

/**
 * 插件安装时的初始化处理
 * 检查是否已有数据，如果没有则初始化默认数据
 */
chrome.runtime.onInstalled.addListener(async (): Promise<void> => {
  console.log('Uni Tab installed');

  try {
    await StorageManager.initialize();
    // 初始化同步系统
    await initializeSync();
  } catch (error) {
    console.error('Failed to initialize storage or sync:', error);
  }
});

/**
 * 监听插件图标点击事件
 * 如果点击时没有popup（比如在某些特殊页面），则直接执行聚合操作
 */
chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab): Promise<void> => {
  await aggregateCurrentWindowTabs();
});

// ==================== 核心功能函数 ====================

/**
 * 聚合当前窗口的标签页
 * 将符合条件的标签页保存为一个分组，并关闭这些标签页
 */
async function aggregateCurrentWindowTabs(): Promise<void> {
  try {
    // 获取当前窗口的所有标签页
    const tabs = await TabManager.getCurrentWindowTabs();

    // 获取存储数据和排除列表
    const data = await StorageManager.getData();
    const excludeList = data.settings.excludeList || [];

    // 过滤可保存的标签页
    const tabsToSave = TabManager.filterSaveableTabs(tabs, excludeList);

    if (tabsToSave.length === 0) {
      console.log('No tabs to save');
      return;
    }

    // 创建新的标签页分组
    const newGroup: TabGroup = {
      id: generateId(),
      name: `标签页分组 - ${formatDate(new Date())}`,
      createdAt: new Date().toISOString(),
      pinned: false,
      locked: false,
      tabs: TabManager.chromeTabsToTabData(tabsToSave)
    };

    // 保存到存储
    data.groups.unshift(newGroup); // 添加到开头

    // 更新元数据
    updateDataMetadata(data);

    await StorageManager.setData(data);

    // 关闭已保存的标签页
    const tabIdsToClose = tabsToSave.map((tab) => tab.id).filter(Boolean) as number[];
    await TabManager.closeTabs(tabIdsToClose);

    // 打开标签页列表页面
    await chrome.tabs.create({ url: chrome.runtime.getURL('tab_list.html') });

    console.log(`Saved ${tabsToSave.length} tabs to group: ${newGroup.name}`);

    // 触发实时同步
    await triggerSyncIfEnabled();
  } catch (error) {
    console.error('Error aggregating tabs:', error);
  }
}

/**
 * 恢复标签页
 * @param tabs 要恢复的标签页列表
 * @param openInNewWindow 是否在新窗口中打开
 */
async function restoreTabs(tabs: TabData[], openInNewWindow = false): Promise<void> {
  try {
    await TabManager.restoreTabs(tabs, openInNewWindow);
  } catch (error) {
    console.error('Error restoring tabs:', error);
    throw error;
  }
}

// ==================== 分组管理函数 ====================

/**
 * 创建新分组
 * @param name 分组名称
 * @param tabs 标签页列表
 */
async function createGroup(name?: string, tabs: TabData[] = []): Promise<void> {
  try {
    const data = await StorageManager.getData();
    const newGroup: TabGroup = {
      id: generateId(),
      name: name || `标签页分组 - ${formatDate(new Date())}`,
      createdAt: new Date().toISOString(),
      pinned: false,
      locked: false,
      tabs: tabs.map(
        (tab: TabData): TabData => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl || generateFavIconUrl(tab.url)
        })
      )
    };

    data.groups.unshift(newGroup);

    // 更新元数据
    updateDataMetadata(data);

    await StorageManager.setData(data);

    // 关闭已保存的标签页（如果有ID）
    const tabIdsToClose = tabs.map((tab) => tab.id).filter(Boolean) as number[];
    if (tabIdsToClose.length > 0) {
      await TabManager.closeTabs(tabIdsToClose);
    }

    console.log(`Created group: ${newGroup.name}`);

    // 触发实时同步
    // 触发同步（如果启用）
    await triggerSyncIfEnabled();
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
}

/**
 * 更新分组名称
 * @param groupId 分组ID
 * @param newName 新名称
 */
async function updateGroupName(groupId: number, newName: string): Promise<void> {
  try {
    const data = await StorageManager.getData();
    const group = data.groups.find((g: TabGroup) => g.id === groupId);

    if (!group) {
      throw new Error('分组不存在');
    }

    if (group.locked) {
      throw new Error('无法修改已锁定的分组');
    }

    group.name = newName;

    // 更新元数据
    updateDataMetadata(data);

    await StorageManager.setData(data);

    console.log(`Updated group name: ${groupId} -> ${newName}`);

    // 触发实时同步
    // 触发同步（如果启用）
    await triggerSyncIfEnabled();
  } catch (error) {
    console.error('Error updating group name:', error);
    throw error;
  }
}

/**
 * 切换分组锁定状态
 * @param groupId 分组ID
 */
async function toggleGroupLock(groupId: number): Promise<void> {
  try {
    const data = await StorageManager.getData();
    const group = data.groups.find((g: TabGroup) => g.id === groupId);

    if (!group) {
      throw new Error('分组不存在');
    }

    group.locked = !group.locked;

    // 更新元数据
    updateDataMetadata(data);

    await StorageManager.setData(data);

    console.log(`Toggled group lock: ${groupId} -> ${group.locked ? 'locked' : 'unlocked'}`);

    // 触发实时同步
    // 触发同步（如果启用）
    await triggerSyncIfEnabled();
  } catch (error) {
    console.error('Error toggling group lock:', error);
    throw error;
  }
}

/**
 * 删除分组
 * @param groupId 分组ID
 */
async function deleteGroup(groupId: number): Promise<void> {
  try {
    const data = await StorageManager.getData();
    const groupIndex = data.groups.findIndex((g: TabGroup) => g.id === groupId);

    if (groupIndex === -1) {
      throw new Error('分组不存在');
    }

    const group = data.groups[groupIndex];
    if (group.locked) {
      throw new Error('无法删除已锁定的分组');
    }

    data.groups.splice(groupIndex, 1);

    // 更新元数据
    updateDataMetadata(data);

    await StorageManager.setData(data);

    console.log(`Deleted group: ${groupId}`);

    // 触发实时同步
    // 触发同步（如果启用）
    await triggerSyncIfEnabled();
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
}

// ==================== 统计和数据管理函数 ====================

/**
 * 获取统计信息
 * @returns 统计数据
 */
async function getStatistics(): Promise<Statistics> {
  try {
    const data = await StorageManager.getData();
    const groupCount = data.groups.length;
    const tabCount = data.groups.reduce((total: number, group: TabGroup) => total + group.tabs.length, 0);
    const lockedGroups = data.groups.filter((g: TabGroup) => g.locked).length;

    return {
      groupCount,
      tabCount,
      lockedGroups,
      averageTabsPerGroup: groupCount > 0 ? Math.round((tabCount / groupCount) * 10) / 10 : 0
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    throw error;
  }
}

/**
 * 导出数据
 * @param format 导出格式（json 或 csv）
 */
async function exportData(format: ExportFormat): Promise<void> {
  try {
    const data = await StorageManager.getData();
    let content: string;
    let filename: string;
    let mimeType: string;

    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      filename = `tab-sorter-backup-${dateStr}.json`;
      mimeType = 'application/json';
    } else if (format === 'csv') {
      const csvRows = ['分组名称,标签标题,URL,创建时间,是否锁定'];
      data.groups.forEach((group: TabGroup) => {
        group.tabs.forEach((tab: TabData) => {
          const row = [
            `"${group.name}"`,
            `"${tab.title}"`,
            `"${tab.url}"`,
            `"${group.createdAt}"`,
            `"${group.locked ? '是' : '否'}"`
          ].join(',');
          csvRows.push(row);
        });
      });
      content = csvRows.join('\n');
      filename = `tab-sorter-backup-${dateStr}.csv`;
      mimeType = 'text/csv';
    } else {
      throw new Error('不支持的导出格式');
    }

    // 创建下载
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: url,
      filename: filename
    });

    console.log(`Exported data as ${format}: ${filename}`);
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

/**
 * 导入数据
 * @param importedData 要导入的数据
 */
async function importData(importedData: Partial<StorageData>): Promise<void> {
  try {
    // 验证数据格式
    if (!importedData.groups || !Array.isArray(importedData.groups)) {
      throw new Error('无效的数据格式');
    }

    const currentData = await StorageManager.getData();

    // 合并数据，避免ID冲突
    const maxId = Math.max(0, ...currentData.groups.map((g: TabGroup) => g.id));
    importedData.groups.forEach((group: TabGroup, index: number) => {
      group.id = maxId + index + 1;
      group.createdAt = group.createdAt || new Date().toISOString();
      group.locked = group.locked || false;
    });

    currentData.groups.push(...importedData.groups);

    // 更新元数据
    updateDataMetadata(currentData);

    await StorageManager.setData(currentData);

    console.log(`Imported ${importedData.groups.length} groups`);

    // 触发实时同步
    // 触发同步（如果启用）
    await triggerSyncIfEnabled();
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
}

/**
 * 清空所有数据
 * 重置为默认数据结构
 */
async function clearAllData(): Promise<void> {
  try {
    await StorageManager.clear();
    console.log('Cleared all data');

    // 触发实时同步
    // 触发同步（如果启用）
    await triggerSyncIfEnabled();
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

// ==================== 工具函数 ====================

/**
 * 生成网站图标URL
 * @param url 网站URL
 * @returns 图标URL
 */
function generateFavIconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${hostname}`;
  } catch {
    return '';
  }
}

// ==================== 消息处理 ====================

/**
 * 监听来自其他组件的消息
 * 处理各种操作请求并返回响应
 */
chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean => {
    // 异步处理消息的包装函数
    const handleAsync = async (): Promise<void> => {
      try {
        switch (request.action) {
          case 'aggregateTabs':
            await aggregateCurrentWindowTabs();
            sendResponse(createResponse(true));
            break;

          case 'getData':
            const data = await StorageManager.getData();
            sendResponse(createResponse(true, data));
            break;

          case 'saveData':
            if (!request.data) {
              throw new Error('缺少数据参数');
            }
            await StorageManager.setData(request.data);
            sendResponse(createResponse(true));
            break;

          case 'restoreTabs':
            if (!request.tabs) {
              throw new Error('缺少标签页参数');
            }
            await restoreTabs(request.tabs, request.openInNewWindow);
            sendResponse(createResponse(true));
            break;

          case 'createGroup':
            await createGroup(request.name, request.tabs);
            sendResponse(createResponse(true));
            break;

          case 'updateGroupName':
            if (typeof request.groupId !== 'number' || !request.newName) {
              throw new Error('缺少必要参数');
            }
            await updateGroupName(request.groupId, request.newName);
            sendResponse(createResponse(true));
            break;

          case 'toggleGroupLock':
            if (typeof request.groupId !== 'number') {
              throw new Error('缺少分组ID参数');
            }
            await toggleGroupLock(request.groupId);
            sendResponse(createResponse(true));
            break;

          case 'deleteGroup':
            if (typeof request.groupId !== 'number') {
              throw new Error('缺少分组ID参数');
            }
            await deleteGroup(request.groupId);
            sendResponse(createResponse(true));
            break;

          case 'getStatistics':
            const stats = await getStatistics();
            sendResponse(createResponse(true, stats));
            break;

          case 'exportData':
            if (!request.format) {
              throw new Error('缺少导出格式参数');
            }
            await exportData(request.format);
            sendResponse(createResponse(true));
            break;

          case 'importData':
            if (!request.data) {
              throw new Error('缺少导入数据参数');
            }
            await importData(request.data);
            sendResponse(createResponse(true));
            break;

          case 'clearAllData':
            await clearAllData();
            sendResponse(createResponse(true));
            break;

          default:
            // 尝试处理同步相关消息
            const syncHandled = handleSyncMessages(request, sender, sendResponse);
            if (!syncHandled) {
              throw new Error(`未知的操作类型: ${request.action}`);
            }
            return; // 同步消息已处理，直接返回
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        console.error(`Error handling message ${request.action}:`, error);
        sendResponse(createResponse(false, undefined, errorMessage));
      }
    };

    // 执行异步处理
    handleAsync();

    // 保持消息通道开放以支持异步响应
    return true;
  }
);
