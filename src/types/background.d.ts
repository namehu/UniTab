/**
 * Background Service Worker 相关类型定义
 */

// 标签页数据结构
export interface TabData {
  /** 标签页ID（可选，用于关闭标签页） */
  id?: number;
  /** 标签页标题 */
  title: string;
  /** 标签页URL */
  url: string;
  /** 网站图标URL */
  favIconUrl?: string;
}

// 标签页分组数据结构
export interface TabGroup {
  /** 分组唯一ID（时间戳） */
  id: number;
  /** 分组名称 */
  name: string;
  /** 创建时间（ISO字符串） */
  createdAt: string;
  /** 是否固定 */
  pinned?: boolean;
  /** 是否锁定（防止删除和修改） */
  locked?: boolean;
  /** 分组包含的标签页列表 */
  tabs: TabData[];
}

// 同步设置
export interface SyncSettings {
  /** 同步服务提供商 */
  provider: string | null;
  /** GitHub Gist ID */
  gistId: string | null;
  /** 最后同步时间 */
  lastSync: string | null;
}

// 应用设置
export interface AppSettings {
  /** 同步相关设置 */
  sync: SyncSettings;
  /** 排除列表（不保存的URL前缀） */
  excludeList: string[];
}

// 主数据结构
export interface StorageData {
  /** 数据版本号 */
  version: string;
  /** 应用设置 */
  settings: AppSettings;
  /** 标签页分组列表 */
  groups: TabGroup[];
}

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