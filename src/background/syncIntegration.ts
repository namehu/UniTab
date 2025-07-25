/**
 * Background Script 中的同步集成示例
 * 展示如何在后台脚本中使用同步功能
 */

import { syncManager } from '../utils/sync/SyncManager';
import type { SyncStatus } from '../types/sync';

/**
 * 初始化同步系统
 */
export async function initializeSync(): Promise<void> {
  try {
    // 监听同步状态变化
    syncManager.onStatusChange((status: SyncStatus) => {
      console.log('Sync status changed:', status);

      // 可以在这里发送消息给其他页面通知状态变化
      chrome.runtime
        .sendMessage({
          type: 'SYNC_STATUS_CHANGED',
          status
        })
        .catch(() => {
          // 忽略没有监听器的错误
        });
    });

    console.log('Sync system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize sync system:', error);
  }
}

/**
 * 处理来自其他页面的同步相关消息
 */
export function handleSyncMessages(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  switch (request.action) {
    case 'sync':
      handleSyncRequest(sendResponse);
      return true; // 异步响应

    case 'upload':
      handleUploadRequest(sendResponse);
      return true;

    default:
      return false; // 不处理此消息
  }
}

/**
 * 检查是否配置了远程同步提供商
 */
async function checkSyncConfigured(): Promise<boolean> {
  try {
    const config = syncManager.config;
    return config.providerConfig && Object.keys(config.providerConfig).length > 0;
  } catch {
    return false;
  }
}

/**
 * 处理同步请求
 */
async function handleSyncRequest(sendResponse: (response: any) => void): Promise<void> {
  try {
    const result = await syncManager.sync();
    sendResponse({
      success: result.success,
      error: result.error,
      timestamp: result.timestamp
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    });
  }
}

/**
 * 处理上传请求
 */
async function handleUploadRequest(sendResponse: (response: any) => void): Promise<void> {
  try {
    const result = await syncManager.upload();
    sendResponse({
      success: result.success,
      error: result.error,
      timestamp: result.timestamp
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
}

/**
 * 在扩展启动时自动同步（如果配置了）
 */
export async function performStartupSync(): Promise<void> {
  try {
    const syncConfigured = await checkSyncConfigured();
    if (!syncConfigured) {
      console.log('Remote sync not configured, skipping startup sync');
      return;
    }

    const config = syncManager.config;

    // 如果上次同步时间超过同步间隔，则执行同步
    if (config.lastSync) {
      const lastSyncTime = new Date(config.lastSync).getTime();
      const now = Date.now();
      const intervalMs = 60 * 1000;

      if (now - lastSyncTime > intervalMs) {
        console.log('Performing startup sync...');
        await syncManager.sync();
      }
    } else {
      // 首次使用，尝试下载远程数据
      console.log('First time sync, attempting to download remote data...');
      try {
        await syncManager.download();
      } catch (error) {
        // 如果下载失败，可能是没有远程数据，忽略错误
        console.log('No remote data found, will upload local data on next sync');
      }
    }
  } catch (error) {
    console.error('Startup sync failed:', error);
  }
}
