/**
 * 标签页管理相关的类型定义
 */

/**
 * 标签页接口
 */
export interface Tab {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

/**
 * 分组接口
 */
export interface Group {
  id: string;
  name: string;
  tabs: Tab[];
  createdAt: string;
  locked?: boolean;
}

/**
 * 统计信息接口
 */
export interface Stats {
  /** 分组数量 */
  groupCount: number;
  /** 标签页总数 */
  tabCount: number;
}

/**
 * 排序类型
 */
export type SortType = 'newest' | 'oldest' | 'name' | 'tabs';

/**
 * 视图类型
 */
export type ViewType = 'grid' | 'list';

/**
 * 组件Props接口定义
 */

/**
 * 头部组件属性接口
 */
export interface HeaderProps {
  /** 搜索回调函数 */
  onSearch: (query: string) => void;
  /** 新建分组回调函数 */
  onNewGroup: () => void;
  /** 打开设置回调函数 */
  onOpenSettings: () => void;
}

/**
 * 工具栏组件属性接口
 */
export interface ToolbarProps {
  /** 统计信息 */
  stats: Stats;
  /** 当前排序方式 */
  sort: SortType;
  /** 排序方式改变回调 */
  onSortChange: (sort: SortType) => void;
  /** 当前视图模式 */
  view: ViewType;
  /** 视图模式改变回调 */
  onViewChange: (view: ViewType) => void;
}

/**
 * 分组列表组件属性接口
 */
export interface GroupListProps {
  /** 分组列表 */
  groups: Group[];
  /** 视图模式 */
  view: ViewType;
  /** 分组点击回调 */
  onGroupClick: (group: Group) => void;
}

/**
 * 分组详情模态框属性接口
 */
export interface GroupDetailModalProps {
  /** 分组数据 */
  group: Group;
  /** 关闭回调 */
  onClose: () => void;
  /** 更新回调 */
  onUpdate: () => void;
}

/**
 * 新建分组模态框属性接口
 */
export interface NewGroupModalProps {
  /** 关闭回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (name: string, tabs: Tab[]) => void;
}