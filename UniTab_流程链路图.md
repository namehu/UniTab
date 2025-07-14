# UniTab 标签处理与远程同步机制流程图

## 1. 整体架构概览

```mermaid
graph TB
    subgraph "用户界面层"
        A[Popup 弹窗] --> B[Tab List 主页面]
        C[Options 设置页] --> B
    end
    
    subgraph "核心处理层"
        D[Background Service Worker]
        E[Storage Manager]
        F[Tab Manager]
        G[Sync Manager]
        H[Realtime Sync Manager]
    end
    
    subgraph "数据存储层"
        I[Chrome Storage Local]
        J[GitHub Gist Remote]
    end
    
    A --> D
    B --> D
    C --> D
    D --> E
    D --> F
    D --> G
    D --> H
    E --> I
    G --> J
    H --> G
```

## 2. 标签处理流程

### 2.1 标签聚合流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant P as Popup/UI
    participant BG as Background
    participant TM as TabManager
    participant SM as StorageManager
    participant RS as RealtimeSyncManager
    
    U->>P: 点击"聚合标签"按钮
    P->>BG: 发送 aggregateTabs 消息
    BG->>TM: 获取当前窗口标签页
    TM->>BG: 返回标签页列表
    BG->>BG: 过滤排除列表中的URL
    BG->>BG: 生成分组名称和ID
    BG->>SM: 保存新分组到本地存储
    SM->>BG: 保存成功
    BG->>TM: 关闭已聚合的标签页
    BG->>RS: 触发实时同步 (create_group)
    RS->>RS: 检查认证状态
    alt 认证成功
        RS->>SyncManager: 执行同步
    else 认证失败
        RS->>RS: 记录待处理任务
    end
    BG->>P: 返回成功响应
    P->>U: 显示成功提示
```

### 2.2 标签恢复流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant TL as TabList页面
    participant BG as Background
    participant TM as TabManager
    
    U->>TL: 点击"恢复分组"按钮
    TL->>BG: 发送 restoreTabs 消息
    BG->>TM: 创建新标签页
    loop 每个标签URL
        TM->>TM: 创建标签页
    end
    alt 在新窗口打开
        TM->>TM: 创建新窗口
        TM->>TM: 在新窗口中打开标签
    else 在当前窗口打开
        TM->>TM: 在当前窗口打开标签
    end
    TM->>BG: 返回恢复结果
    BG->>TL: 返回成功响应
    TL->>U: 显示恢复完成
```

### 2.3 分组管理流程

```mermaid
flowchart TD
    A[分组操作] --> B{操作类型}
    
    B -->|删除分组| C[检查锁定状态]
    C -->|未锁定| D[从存储中删除]
    C -->|已锁定| E[显示错误提示]
    
    B -->|重命名分组| F[更新分组名称]
    F --> G[保存到存储]
    
    B -->|锁定/解锁| H[切换锁定状态]
    H --> I[保存到存储]
    
    D --> J[触发实时同步 delete_group]
    G --> K[触发实时同步 update_group]
    I --> L[触发实时同步 toggle_group_lock]
    
    J --> M[同步到远程]
    K --> M
    L --> M
```

## 3. 远程同步机制

### 3.1 同步系统架构

```mermaid
graph TB
    subgraph "同步管理层"
        A[SyncManager 同步管理器]
        B[RealtimeSyncManager 实时同步管理器]
        C[GitHubSyncProvider GitHub提供商]
    end
    
    subgraph "认证层"
        D[GitHub Token 认证]
        E[Gist API 访问]
    end
    
    subgraph "数据层"
        F[本地数据 Chrome Storage]
        G[远程数据 GitHub Gist]
    end
    
    A --> C
    B --> A
    C --> D
    D --> E
    E --> G
    A --> F
    
    A -.->|冲突检测| H[冲突解决机制]
    H -.->|用户选择| I[覆盖策略]
```

### 3.2 手动同步流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 同步设置界面
    participant SM as SyncManager
    participant GP as GitHubProvider
    participant API as GitHub API
    
    U->>UI: 点击"同步"按钮
    UI->>SM: 调用 sync() 方法
    SM->>SM: 设置状态为 'syncing'
    SM->>GP: 检查认证状态
    GP->>API: 验证 Token
    API->>GP: 返回认证结果
    
    alt 认证成功
        SM->>SM: 获取本地数据
        SM->>GP: 下载远程数据
        GP->>API: 获取 Gist 内容
        API->>GP: 返回远程数据
        
        SM->>SM: 检测冲突
        alt 无冲突
            SM->>SM: 智能合并数据
            SM->>SM: 保存本地数据
            SM->>GP: 上传合并后数据
            GP->>API: 更新 Gist
            SM->>UI: 返回同步成功
        else 有冲突
            SM->>UI: 返回冲突信息
            UI->>U: 显示冲突解决对话框
            U->>UI: 选择解决方案
            UI->>SM: 调用 resolveConflict()
            SM->>SM: 应用解决方案
            SM->>GP: 上传解决后数据
        end
    else 认证失败
        SM->>UI: 返回认证错误
        UI->>U: 显示认证失败提示
    end
```

### 3.3 实时同步流程

```mermaid
sequenceDiagram
    participant BG as Background
    participant RS as RealtimeSyncManager
    participant SM as SyncManager
    participant GP as GitHubProvider
    
    Note over BG: 用户执行操作（删除分组等）
    BG->>RS: triggerSync(operation, data)
    RS->>RS: 检查是否启用实时同步
    
    alt 实时同步已启用
        RS->>RS: 创建同步任务
        RS->>RS: 添加到待处理队列
        RS->>RS: 开始处理任务
        
        loop 处理待处理任务
            RS->>SM: 调用 sync() 方法
            SM->>GP: 执行同步操作
            
            alt 同步成功
                RS->>RS: 移除任务
                RS->>RS: 通知页面同步完成
            else 同步失败
                RS->>RS: 增加重试计数
                alt 未达到最大重试次数
                    RS->>RS: 延迟后重试
                else 达到最大重试次数
                    RS->>RS: 标记任务失败
                    RS->>RS: 通知页面同步失败
                end
            end
        end
    else 实时同步已禁用
        RS->>RS: 记录日志：跳过同步
        Note over RS: 显示 "Realtime sync is disabled"
    end
```

### 3.4 冲突检测与解决流程

```mermaid
flowchart TD
    A[开始同步] --> B[获取本地数据]
    B --> C[获取远程数据]
    C --> D{数据状态检查}
    
    D -->|仅本地有数据| E[上传本地数据]
    D -->|仅远程有数据| F[下载远程数据]
    D -->|本地和远程都有数据| G[冲突检测]
    
    G --> H{设备ID检查}
    H -->|相同设备| I[直接合并]
    H -->|不同设备| J{GitHub账号检查}
    
    J -->|相同账号| K{数据差异检查}
    J -->|不同账号| L[设备冲突]
    
    K -->|无显著差异| I
    K -->|有显著差异| M[数据冲突]
    
    L --> N[显示冲突对话框]
    M --> N
    
    N --> O{用户选择}
    O -->|使用本地数据| P[本地覆盖远程]
    O -->|使用远程数据| Q[远程覆盖本地]
    O -->|智能合并| R[执行智能合并]
    
    E --> S[同步完成]
    F --> S
    I --> S
    P --> S
    Q --> S
    R --> S
```

## 4. 数据流向图

```mermaid
flowchart LR
    subgraph "用户操作"
        A1[聚合标签]
        A2[恢复标签]
        A3[管理分组]
        A4[手动同步]
    end
    
    subgraph "本地处理"
        B1[Background Script]
        B2[Chrome Storage]
        B3[实时同步队列]
    end
    
    subgraph "远程同步"
        C1[GitHub认证]
        C2[Gist API]
        C3[远程存储]
    end
    
    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    
    B1 --> B2
    B1 --> B3
    
    B3 --> C1
    C1 --> C2
    C2 --> C3
    
    C3 -.->|冲突检测| B1
    B1 -.->|冲突解决| C2
```

## 5. 关键组件说明

### 5.1 核心组件职责

| 组件 | 职责 | 关键方法 |
|------|------|----------|
| **Background Script** | 消息处理、业务逻辑协调 | `aggregateCurrentWindowTabs()`, `deleteGroup()`, `restoreTabs()` |
| **SyncManager** | 同步逻辑管理、冲突处理 | `sync()`, `detectConflict()`, `resolveConflict()` |
| **RealtimeSyncManager** | 实时同步任务管理 | `triggerSync()`, `processPendingTasks()` |
| **GitHubSyncProvider** | GitHub API 交互 | `upload()`, `download()`, `isAuthenticated()` |
| **StorageManager** | 本地数据管理 | `getData()`, `setData()` |

### 5.2 数据同步策略

1. **实时同步触发条件**：
   - 创建分组 (`create_group`)
   - 更新分组 (`update_group`)
   - 删除分组 (`delete_group`)
   - 切换锁定状态 (`toggle_group_lock`)
   - 聚合标签 (`aggregate_tabs`)

2. **冲突解决策略**：
   - 同设备：直接合并
   - 同账号不同设备：检查数据差异
   - 不同账号：提示用户选择

3. **重试机制**：
   - 最大重试次数：3次
   - 退避策略：指数退避
   - 基础延迟：1秒
   - 最大延迟：30秒

## 6. 错误处理机制

```mermaid
flowchart TD
    A[操作执行] --> B{是否成功}
    B -->|成功| C[触发实时同步]
    B -->|失败| D[显示错误信息]
    
    C --> E{认证状态}
    E -->|已认证| F[执行同步]
    E -->|未认证| G[添加到待处理队列]
    
    F --> H{同步结果}
    H -->|成功| I[完成]
    H -->|失败| J[重试机制]
    
    J --> K{重试次数}
    K -->|未达上限| L[延迟重试]
    K -->|达到上限| M[标记失败]
    
    L --> F
    M --> N[通知用户]
```

---

*此流程图描述了 UniTab 浏览器扩展的完整标签处理和远程同步机制，包括用户操作流程、数据同步策略、冲突解决方案和错误处理机制。*