import { useEffect, useRef } from 'react';
import { UnifiedSyncManager } from '../utils/sync/UnifiedSyncManager';
import { UnifiedStorageManager } from '../utils/storage/UnifiedStorageManager';

interface UseAutoSyncOptions {
  /**
   * 同步检查的时间阈值（分钟），默认30分钟
   */
  syncThresholdMinutes?: number;
  
  /**
   * 是否在页面加载时检查同步，默认true
   */
  checkOnMount?: boolean;
  
  /**
   * 是否启用定时同步（仅在页面可见时），默认false
   */
  enablePeriodicSync?: boolean;
  
  /**
   * 定时同步间隔（分钟），默认30分钟
   */
  periodicSyncIntervalMinutes?: number;
  
  /**
   * 是否监听网络状态变化，默认false
   */
  enableNetworkListener?: boolean;
}

/**
 * 自动同步 Hook
 * 提供统一的同步检查和触发逻辑
 */
export const useAutoSync = (options: UseAutoSyncOptions = {}) => {
  const {
    syncThresholdMinutes = 30,
    checkOnMount = true,
    enablePeriodicSync = false,
    periodicSyncIntervalMinutes = 30,
    enableNetworkListener = false
  } = options;

  const periodicSyncRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisible = useRef(true);

  /**
   * 检查并触发同步
   */
  const checkAndSync = async () => {
    try {
      const settings = await UnifiedStorageManager.getSettings();
      
      // 检查用户是否已认证
      if (!settings.sync.github?.token) {
        return;
      }
      
      // 检查是否存在同步记录
      if (!settings.sync.lastSync) {
        return;
      }
      
      // 检查上次同步时间
      const lastSyncTime = new Date(settings.sync.lastSync).getTime();
      const currentTime = Date.now();
      const timeDiff = currentTime - lastSyncTime;
      const thresholdMs = syncThresholdMinutes * 60 * 1000;
      
      // 如果超过阈值，触发后台静默同步
      if (timeDiff > thresholdMs) {
        console.log(`Last sync was ${Math.round(timeDiff / (60 * 1000))} minutes ago, triggering background sync`);
        await UnifiedSyncManager.sync();
      }
    } catch (error) {
      console.error('Auto sync check failed:', error);
    }
  };

  /**
   * 启动定时同步
   */
  const startPeriodicSync = () => {
    if (periodicSyncRef.current) {
      clearInterval(periodicSyncRef.current);
    }
    
    periodicSyncRef.current = setInterval(() => {
      if (isPageVisible.current) {
        checkAndSync();
      }
    }, periodicSyncIntervalMinutes * 60 * 1000);
  };

  /**
   * 停止定时同步
   */
  const stopPeriodicSync = () => {
    if (periodicSyncRef.current) {
      clearInterval(periodicSyncRef.current);
      periodicSyncRef.current = null;
    }
  };

  /**
   * 处理页面可见性变化
   */
  const handleVisibilityChange = () => {
    isPageVisible.current = !document.hidden;
    
    if (enablePeriodicSync) {
      if (isPageVisible.current) {
        // 页面变为可见时，检查同步并启动定时器
        checkAndSync();
        startPeriodicSync();
      } else {
        // 页面变为隐藏时，停止定时器
        stopPeriodicSync();
      }
    }
  };

  /**
   * 处理网络状态变化
   */
  const handleNetworkChange = () => {
    if (navigator.onLine && isPageVisible.current) {
      console.log('Network restored, triggering sync check');
      checkAndSync();
    }
  };

  useEffect(() => {
    // 页面加载时检查同步
    if (checkOnMount) {
      checkAndSync();
    }

    // 启用定时同步
    if (enablePeriodicSync) {
      startPeriodicSync();
      
      // 监听页面可见性变化
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // 启用网络状态监听
    if (enableNetworkListener) {
      window.addEventListener('online', handleNetworkChange);
    }

    // 清理函数
    return () => {
      stopPeriodicSync();
      
      if (enablePeriodicSync) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      
      if (enableNetworkListener) {
        window.removeEventListener('online', handleNetworkChange);
      }
    };
  }, [checkOnMount, enablePeriodicSync, enableNetworkListener, syncThresholdMinutes, periodicSyncIntervalMinutes]);

  return {
    checkAndSync,
    startPeriodicSync,
    stopPeriodicSync
  };
};