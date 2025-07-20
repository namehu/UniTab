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

import type { Statistics, MessageRequest, MessageResponse, ExportFormat } from './types/background.js';
import type { TabInfo } from './types/storage.js';

import { UnifiedStorageManager } from './utils/storage/UnifiedStorageManager.js';
import { UnifiedSyncManager } from './utils/sync/UnifiedSyncManager.js';
import { TabManager } from './utils/tabs.js';

// 防抖同步相关变量
let syncDebounceTimer: NodeJS.Timeout | null = null;
const SYNC_DEBOUNCE_DELAY = 5000; // 5秒防抖延迟

/**
 * 检查是否配置了远程同步并触发同步（带防抖处理）
 */
async function triggerSyncIfEnabled(): Promise<void> {
  try {
    const isAuthenticated = await UnifiedSyncManager.isAuthenticated();
    console.log('Is remote sync authenticated:', isAuthenticated);

    if (!isAuthenticated) {
      console.log('Remote sync not configured or not authenticated, skipping auto sync');
      return;
    }

    // 清除之前的防抖定时器
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }

    // 设置新的防抖定时器
    syncDebounceTimer = setTimeout(async () => {
      console.log('Triggering debounced sync after data change');
      try {
        await UnifiedSyncManager.sync();
        console.log('Debounced sync completed successfully');
      } catch (error) {
        console.error('Debounced sync failed:', error);
      }
      syncDebounceTimer = null;
    }, SYNC_DEBOUNCE_DELAY);
    
    console.log('Sync scheduled with debounce delay');
  } catch (error) {
    console.error('Error checking sync config:', error);
  }
}

/**
 * 立即触发同步（不使用防抖，用于启动时等场景）
 */
async function triggerSyncImmediately(): Promise<void> {
  try {
    const isAuthenticated = await UnifiedSyncManager.isAuthenticated();
    if (!isAuthenticated) {
      console.log('Remote sync not configured or not authenticated, skipping immediate sync');
      return;
    }

    console.log('Triggering immediate sync');
    await UnifiedSyncManager.sync();
    console.log('Immediate sync completed successfully');
  } catch (error) {
    console.error('Immediate sync failed:', error);
  }
}

// ==================== 初始化和事件监听 ====================

/**
 * 插件安装或更新时的初始化
 */
chrome.runtime.onInstalled.addListener(async (): Promise<void> => {
  console.log('UniTab extension installed/updated');

  // 确保数据结构存在
  await UnifiedStorageManager.initializeDefaultData();
  
  // 如果已配置同步，执行一次完整同步
  await triggerSyncImmediately();
  
  // 设置定时同步任务
  await setupPeriodicSync();
});

/**
 * 浏览器启动时的初始化
 */
chrome.runtime.onStartup.addListener(async (): Promise<void> => {
  console.log('Browser startup detected');
  
  // 检查上次同步时间，如果超过阈值则自动同步
  await checkAndSyncOnStartup();
  
  // 设置定时同步任务
  await setupPeriodicSync();
});

/**
 * Service Worker 启动时的初始化
 */
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service Worker suspending');
});

/**
 * 检查启动时是否需要同步
 */
async function checkAndSyncOnStartup(): Promise<void> {
  try {
    const isAuthenticated = await UnifiedSyncManager.isAuthenticated();
    if (!isAuthenticated) {
      console.log('Sync not configured, skipping startup sync');
      return;
    }

    const settings = await UnifiedStorageManager.getSettings();
    const lastSync = settings.sync.lastSync;
    
    if (!lastSync) {
      console.log('No previous sync found, triggering startup sync');
      await triggerSyncImmediately();
      return;
    }

    const lastSyncTime = new Date(lastSync).getTime();
    const now = Date.now();
    const startupSyncThreshold = 60 * 60 * 1000; // 1小时
    
    if (now - lastSyncTime > startupSyncThreshold) {
      console.log('Last sync was over threshold, triggering startup sync');
      await triggerSyncImmediately();
    } else {
      console.log('Recent sync found, skipping startup sync');
    }
  } catch (error) {
    console.error('Error checking startup sync:', error);
  }
}

/**
 * 设置定时同步任务
 */
async function setupPeriodicSync(): Promise<void> {
  try {
    // 清除现有的定时任务
    await chrome.alarms.clear('periodicSync');
    
    // 创建新的定时任务（每2小时）
    await chrome.alarms.create('periodicSync', {
      delayInMinutes: 120, // 2小时
      periodInMinutes: 120 // 每2小时重复
    });
    
    console.log('Periodic sync alarm set up');
  } catch (error) {
    console.error('Error setting up periodic sync:', error);
  }
}

/**
 * 监听定时任务触发
 */
chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === 'periodicSync') {
    console.log('Periodic sync alarm triggered');
    await triggerSyncImmediately();
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

    // 获取设置和排除列表
    const settings = await UnifiedStorageManager.getSettings();
    const excludeList = settings.excludeList || [];

    // 过滤可保存的标签页
    const tabsToSave = TabManager.filterSaveableTabs(tabs, excludeList);

    if (tabsToSave.length === 0) {
      console.log('No tabs to save');
      return;
    }

    // 转换标签页数据
    const tabInfos: TabInfo[] = TabManager.chromeTabsToTabData(tabsToSave);

    // 创建新的标签页分组
    const newGroup = await UnifiedStorageManager.addGroup({
      name: `标签页分组 - ${formatDate()}`,
      pinned: false,
      tabs: tabInfos
    });

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
async function restoreTabs(tabs: TabInfo[], openInNewWindow = false): Promise<void> {
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
async function createGroup(name?: string, tabs: TabInfo[] = []): Promise<void> {
  try {
    const tabInfos: TabInfo[] = tabs.map((tab) => ({
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl || generateFavIconUrl(tab.url)
    }));

    const newGroup = await UnifiedStorageManager.addGroup({
      name: name || `标签页分组 - ${formatDate()}`,
      pinned: false,
      tabs: tabInfos
    });

    console.log(`Created group: ${newGroup.name}`);

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
    const result = await UnifiedStorageManager.updateGroup(groupId, { name: newName });

    if (!result.success) {
      throw new Error(result.error || 'Failed to update group name');
    }

    console.log(`Updated group name: ${groupId} -> ${newName}`);

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
    const groups = await UnifiedStorageManager.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (!group) {
      throw new Error('分组不存在');
    }

    const newLockedState = !group.locked;
    const result = await UnifiedStorageManager.updateGroup(groupId, { locked: newLockedState });

    if (!result.success) {
      throw new Error(result.error || 'Failed to toggle group lock');
    }

    console.log(`Toggled group lock: ${groupId} -> ${newLockedState ? 'locked' : 'unlocked'}`);

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
    // 检查分组是否存在且未锁定
    const groups = await UnifiedStorageManager.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (!group) {
      throw new Error('分组不存在');
    }

    if (group.locked) {
      throw new Error('无法删除已锁定的分组');
    }

    const result = await UnifiedStorageManager.deleteGroup(groupId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete group');
    }

    console.log(`Deleted group: ${groupId}`);

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
    return await UnifiedStorageManager.getStatistics();
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
    const result = await UnifiedStorageManager.exportData();
    console.log(`Exported data as ${format}:`, result);
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

/**
 * 导入数据
 * @param importedData 要导入的数据
 */
async function importData(importedData: any): Promise<void> {
  try {
    const result = await UnifiedStorageManager.importData(importedData);

    if (!result.success) {
      throw new Error(result.error || 'Failed to import data');
    }

    console.log(`Imported data successfully`);

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
    const result = await UnifiedStorageManager.clearAllData();

    if (!result.success) {
      throw new Error(result.error || 'Failed to clear data');
    }

    console.log('All data cleared');

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

/**
 * 创建标准化的消息响应
 * @param success 操作是否成功
 * @param data 响应数据
 * @param error 错误信息
 * @returns 标准化的消息响应
 */
function createResponse(success: boolean, data?: any, error?: string): MessageResponse {
  return {
    success,
    data,
    error
  };
}

/**
 * 格式化日期为 ISO 字符串
 * @returns ISO 格式的日期字符串
 */
function formatDate(): string {
  return new Date().toISOString();
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
            const data = await UnifiedStorageManager.getData();
            sendResponse(createResponse(true, data));
            break;

          case 'saveData':
            if (!request.data) {
              throw new Error('缺少数据参数');
            }
            const result = await UnifiedStorageManager.setData(request.data);
            if (!result.success) {
              throw new Error(result.error || 'Failed to save data');
            }
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
            throw new Error(`未知的操作类型: ${request.action}`);
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
