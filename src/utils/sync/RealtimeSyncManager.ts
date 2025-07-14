/**
 * 实时同步管理器
 * 负责在数据变更时立即触发同步，并提供重试机制
 */

import { syncManager } from './SyncManager';
import type { SyncResult } from '../../types/sync';

/**
 * 同步操作类型
 */
export type SyncOperation = 
  | 'create_group'
  | 'update_group'
  | 'delete_group'
  | 'toggle_group_lock'
  | 'aggregate_tabs'
  | 'import_data'
  | 'clear_data';

/**
 * 重试配置
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // 基础延迟时间（毫秒）
  maxDelay: number; // 最大延迟时间（毫秒）
  backoffMultiplier: number; // 退避倍数
}

/**
 * 同步任务
 */
interface SyncTask {
  id: string;
  operation: SyncOperation;
  timestamp: number;
  retryCount: number;
  data?: any;
}

/**
 * 实时同步管理器类
 */
export class RealtimeSyncManager {
  private static instance: RealtimeSyncManager;
  private isEnabled: boolean = false;
  private pendingTasks: Map<string, SyncTask> = new Map();
  private isProcessing: boolean = false;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1秒
    maxDelay: 30000, // 30秒
    backoffMultiplier: 2
  };

  private constructor() {
    this.initialize();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): RealtimeSyncManager {
    if (!RealtimeSyncManager.instance) {
      RealtimeSyncManager.instance = new RealtimeSyncManager();
    }
    return RealtimeSyncManager.instance;
  }

  /**
   * 初始化实时同步管理器
   */
  private async initialize(): Promise<void> {
    try {
      console.log('Initializing realtime sync manager...');
      
      // 检查是否有有效的认证
      const isAuthenticated = await this.checkAuthentication();
      
      // 实时同步只依赖于认证状态，不依赖于autoSync配置
      // 这样用户在配置同步后，实时同步就会自动启用
      this.isEnabled = isAuthenticated;
      
      if (this.isEnabled) {
        console.log('Realtime sync manager initialized and enabled');
        // 启动时处理可能存在的待处理任务
        this.processPendingTasks();
      } else {
        console.log('Realtime sync manager initialized but disabled (authenticated:', isAuthenticated, ')');
        console.log('To enable realtime sync, please configure GitHub authentication in sync settings');
      }
    } catch (error) {
      console.error('Failed to initialize realtime sync manager:', error);
      this.isEnabled = false;
    }
  }

  /**
   * 检查认证状态
   */
  private async checkAuthentication(): Promise<boolean> {
    try {
      const provider = (syncManager as any).provider;
      if (!provider) {
        try {
          await (syncManager as any).initializeProvider();
        } catch (error) {
          console.log('Provider initialization failed, likely no config yet:', (error as Error).message);
          return false;
        }
      }
      
      const isAuth = await (syncManager as any).provider?.isAuthenticated() || false;
      console.log('Authentication check result:', isAuth);
      return isAuth;
    } catch (error) {
      console.error('Failed to check authentication:', error);
      return false;
    }
  }

  /**
   * 启用实时同步
   */
  public async enable(): Promise<void> {
    const isAuthenticated = await this.checkAuthentication();
    if (isAuthenticated) {
      this.isEnabled = true;
      console.log('Realtime sync enabled');
      this.processPendingTasks();
    } else {
      console.warn('Cannot enable realtime sync: not authenticated');
    }
  }

  /**
   * 禁用实时同步
   */
  public disable(): void {
    this.isEnabled = false;
    this.pendingTasks.clear();
    console.log('Realtime sync disabled');
  }

  /**
   * 触发同步操作
   */
  public async triggerSync(operation: SyncOperation, data?: any): Promise<void> {
    if (!this.isEnabled) {
      console.log('Realtime sync is disabled, skipping sync for operation:', operation);
      return;
    }

    const taskId = this.generateTaskId(operation);
    const task: SyncTask = {
      id: taskId,
      operation,
      timestamp: Date.now(),
      retryCount: 0,
      data
    };

    this.pendingTasks.set(taskId, task);
    console.log('Sync task queued:', operation, 'with ID:', taskId);

    // 立即尝试处理任务
    this.processPendingTasks();
  }

  /**
   * 处理待处理的同步任务
   */
  private async processPendingTasks(): Promise<void> {
    if (this.isProcessing || this.pendingTasks.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // 按时间戳排序处理任务
      const tasks = Array.from(this.pendingTasks.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      for (const task of tasks) {
        await this.processTask(task);
      }
    } catch (error) {
      console.error('Error processing pending sync tasks:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 处理单个同步任务
   */
  private async processTask(task: SyncTask): Promise<void> {
    try {
      console.log('Processing sync task:', task.operation, 'attempt:', task.retryCount + 1);
      
      const result = await syncManager.sync();
      
      if (result.success) {
        console.log('Sync task completed successfully:', task.operation);
        this.pendingTasks.delete(task.id);
        
        // 通知其他页面同步成功
        this.notifyPages('REALTIME_SYNC_SUCCESS', {
          operation: task.operation,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync task failed:', task.operation, 'error:', error);
      await this.handleTaskFailure(task, error);
    }
  }

  /**
   * 处理任务失败
   */
  private async handleTaskFailure(task: SyncTask, error: any): Promise<void> {
    task.retryCount++;

    if (task.retryCount >= this.retryConfig.maxRetries) {
      console.error('Sync task failed permanently after', this.retryConfig.maxRetries, 'retries:', task.operation);
      this.pendingTasks.delete(task.id);
      
      // 通知其他页面同步失败
      this.notifyPages('REALTIME_SYNC_FAILED', {
        operation: task.operation,
        error: error instanceof Error ? error.message : String(error),
        retryCount: task.retryCount
      });
      return;
    }

    // 计算重试延迟（指数退避）
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, task.retryCount - 1),
      this.retryConfig.maxDelay
    );

    console.log('Scheduling retry for sync task:', task.operation, 'in', delay, 'ms');
    
    setTimeout(() => {
      if (this.pendingTasks.has(task.id)) {
        this.processPendingTasks();
      }
    }, delay);
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(operation: SyncOperation): string {
    return `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 通知其他页面
   */
  private notifyPages(type: string, data: any): void {
    chrome.runtime.sendMessage({
      type,
      data
    }).catch(() => {
      // 忽略没有监听器的错误
    });
  }

  /**
   * 获取待处理任务数量
   */
  public getPendingTaskCount(): number {
    return this.pendingTasks.size;
  }

  /**
   * 获取待处理任务列表
   */
  public getPendingTasks(): SyncTask[] {
    return Array.from(this.pendingTasks.values());
  }

  /**
   * 清除所有待处理任务
   */
  public clearPendingTasks(): void {
    this.pendingTasks.clear();
    console.log('All pending sync tasks cleared');
  }

  /**
   * 更新重试配置
   */
  public updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    console.log('Retry config updated:', this.retryConfig);
  }

  /**
   * 检查是否启用
   */
  public isRealtimeSyncEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * 强制同步（忽略启用状态）
   */
  public async forceSync(): Promise<SyncResult> {
    console.log('Force sync triggered');
    return await syncManager.sync();
  }
}

// 导出单例实例
export const realtimeSyncManager = RealtimeSyncManager.getInstance();