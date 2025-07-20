/**
 * 全局同步状态管理器
 * 类似 jotai/zustand 的订阅机制，管理所有同步相关的状态变化
 */

export type SyncStatus = 'idle' | 'initializing' | 'connecting' | 'connected' | 'syncing' | 'success' | 'error';

export interface SyncStatusInfo {
  status: SyncStatus;
  message?: string;
  lastSyncTime?: string;
  operation?: string; // 当前执行的操作描述
}

type SyncStatusListener = (status: SyncStatusInfo) => void;

class SyncStatusManager {
  private static instance: SyncStatusManager;
  private listeners: Set<SyncStatusListener> = new Set();
  private currentStatus: SyncStatusInfo = { status: 'idle' };
  private syncTimeout?: NodeJS.Timeout;

  private constructor() {}

  static getInstance(): SyncStatusManager {
    if (!SyncStatusManager.instance) {
      SyncStatusManager.instance = new SyncStatusManager();
    }
    return SyncStatusManager.instance;
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    // 立即通知当前状态
    listener(this.currentStatus);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取当前状态
   */
  getCurrentStatus(): SyncStatusInfo {
    return { ...this.currentStatus };
  }

  /**
   * 更新状态并通知所有订阅者
   */
  private updateStatus(status: SyncStatusInfo) {
    this.currentStatus = { ...status };
    this.notifyListeners();
  }

  /**
   * 通知所有订阅者
   */
  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentStatus);
      } catch (error) {
        console.error('同步状态监听器执行错误:', error);
      }
    });
  }

  /**
   * 设置初始化状态
   */
  setInitializing(message?: string) {
    this.updateStatus({
      status: 'initializing',
      message: message || '正在初始化同步...',
      operation: '初始化'
    });
  }

  /**
   * 设置为连接中状态
   */
  setConnecting(message?: string) {
    this.updateStatus({
      status: 'connecting',
      message: message || '连接远程服务中...'
    });
  }

  /**
   * 设置已连接状态
   */
  setConnected(message?: string) {
    this.updateStatus({
      status: 'connected',
      message: message || '已连接到远程同步',
      lastSyncTime: new Date().toISOString()
    });
  }

  /**
   * 设置同步中状态
   */
  setSyncing(operation?: string, message?: string) {
    this.clearSyncTimeout();
    this.updateStatus({
      status: 'syncing',
      message: message || `正在同步${operation ? `: ${operation}` : '...'}`,
      operation
    });
  }

  /**
   * 设置同步成功状态
   */
  setSuccess(operation?: string, message?: string) {
    this.updateStatus({
      status: 'success',
      message: message || `${operation || '同步'}成功`,
      lastSyncTime: new Date().toISOString(),
      operation
    });
  }

  /**
   * 设置同步失败状态
   */
  setError(operation?: string, message?: string) {
    this.clearSyncTimeout();
    this.updateStatus({
      status: 'error',
      message: message || `${operation || '同步'}失败`,
      operation
    });
  }

  /**
   * 设置空闲状态
   */
  setIdle() {
    this.clearSyncTimeout();
    this.updateStatus({
      status: 'idle'
    });
  }

  /**
   * 清除定时器
   */
  private clearSyncTimeout() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = undefined;
    }
  }

  /**
   * 检查并初始化同步状态
   */
  async checkSyncStatus() {
    try {
      this.setInitializing('检查同步配置...');
      
      // 动态导入避免循环依赖
      const { UnifiedSyncManager } = await import('./UnifiedSyncManager');
      
      const isConfigured = await UnifiedSyncManager.isConfigured();
      const isAuthenticated = await UnifiedSyncManager.isAuthenticated();
      
      if (isConfigured && isAuthenticated) {
        this.setConnected('远程同步已就绪');
      } else {
        this.setIdle();
      }
    } catch (error) {
      console.error('检查同步状态失败:', error);
      this.setError('初始化', '检查同步状态失败');
    }
  }

  /**
   * 执行数据操作并自动同步
   */
  async executeWithSync<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      this.setSyncing(operationName);
      
      // 执行操作
      const result = await operation();
      
      // 检查是否需要同步
      const { UnifiedSyncManager } = await import('./UnifiedSyncManager');
      const isConfigured = await UnifiedSyncManager.isConfigured();
      const isAuthenticated = await UnifiedSyncManager.isAuthenticated();
      
      if (isConfigured && isAuthenticated) {
        // 执行同步
        const syncResult = await UnifiedSyncManager.sync();
        
        if (syncResult.success) {
          this.setSuccess(operationName, `${operationName}并同步成功`);
        } else {
          this.setError(operationName, `${operationName}成功，但同步失败: ${syncResult.message}`);
        }
      } else {
        this.setSuccess(operationName, `${operationName}成功`);
      }
      
      return result;
    } catch (error) {
      console.error(`${operationName}失败:`, error);
      this.setError(operationName, `${operationName}失败`);
      throw error;
    }
  }
}

// 导出单例实例
export const syncStatusManager = SyncStatusManager.getInstance();
export default syncStatusManager;