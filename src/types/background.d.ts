/**
 * Background Service Worker 相关类型定义
 * 注意：TabData、TabGroup、StorageData 等数据结构已迁移到 storage.d.ts
 */

// 统计信息
export interface Statistics {
  /** 分组总数 */
  groupCount: number;
  /** 标签页总数 */
  tabCount: number;
  /** 锁定分组数量 */
  lockedGroups: number;
  /** 平均每个分组的标签页数量 */
  averageTabsPerGroup?: number;
}

// 消息类型定义
export type MessageAction = 
  | 'aggregateTabs'
  | 'getData'
  | 'saveData'
  | 'restoreTabs'
  | 'createGroup'
  | 'updateGroupName'
  | 'toggleGroupLock'
  | 'deleteGroup'
  | 'getStatistics'
  | 'exportData'
  | 'importData'
  | 'clearAllData';

// 消息请求结构
export interface MessageRequest {
  /** 操作类型 */
  action: MessageAction;
  /** 请求数据（根据不同action类型而变化） */
  data?: any;
  /** 分组ID（用于分组相关操作） */
  groupId?: number;
  /** 新名称（用于重命名操作） */
  newName?: string;
  /** 标签页列表（用于恢复和创建操作） */
  tabs?: TabData[];
  /** 分组名称（用于创建操作） */
  name?: string;
  /** 导出格式（用于导出操作） */
  format?: 'json' | 'csv';
  /** 是否在新窗口中打开 */
  openInNewWindow?: boolean;
}

// 消息响应结构
export interface MessageResponse {
  /** 操作是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
}

// 导出格式类型
export type ExportFormat = 'json' | 'csv';

// Chrome API 相关类型扩展
export interface ChromeTab extends chrome.tabs.Tab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  pinned: boolean;
}

// 工具函数类型
export type AsyncFunction<T = void> = () => Promise<T>;
export type AsyncFunctionWithParam<P, T = void> = (param: P) => Promise<T>;
export type AsyncFunctionWithParams<P1, P2, T = void> = (param1: P1, param2: P2) => Promise<T>;