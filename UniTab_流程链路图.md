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

    E --> I
    G --> J
    D --> G
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
    
    U->>P: 点击"聚合标签"按钮
    P->>BG: 发送 aggregateTabs 消息
    BG->>TM: 获取当前窗口标签页
    TM->>BG: 返回标签页列表
    BG->>BG: 过滤排除列表中的URL
    BG->>BG: 生成分组名称和ID
    BG->>SM: 保存新分组到本地存储
    SM->>BG: 保存成功
    BG->>TM: 关闭已聚合的标签页
    BG->>BG: 检查同步启用状态
    alt 同步已启用
        BG->>SyncManager: 异步执行同步
    else 同步未启用
        BG->>BG: 跳过同步
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
    
    D --> J[触发同步]
    G --> K[触发同步]
    I --> L[触发同步]
    
    J --> M[同步到远程]
    K --> M
    L --> M
```

## 3. 远程同步机制

### 3.1 同步系统初始化流程

```mermaid
sequenceDiagram
    participant BG as Background Script
    participant SI as SyncIntegration
    participant SM as SyncManager
    participant ST as Storage
    
    Note over BG: 扩展启动时
    BG->>SI: initializeSync()
    SI->>ST: 检查 sync.enabled 状态
    ST->>SI: 返回 sync.enabled 值
    
    alt sync.enabled = false
        SI->>BG: 记录日志：同步已禁用
        Note over SI: "Sync is disabled, skipping initialization"
    else sync.enabled = true
        SI->>SM: 初始化 SyncManager
        SM->>SM: 加载同步配置
        SM->>SM: 检查认证状态
        
        Note over SI: 实时同步已集成到操作流程中
        
        SI->>SI: 设置定期同步
        loop 每次定期同步
            SI->>ST: 检查 sync.enabled 状态
            alt sync.enabled = true
                SI->>SM: 执行定期同步
            else sync.enabled = false
                SI->>SI: 跳过定期同步
            end
        end
    end
```

### 3.2 同步系统架构

```mermaid
graph TB
    subgraph "同步管理层"
        A[SyncManager 同步管理器]
        C[GitHubSyncProvider GitHub提供商]
        D[SyncIntegration 同步集成]
    end
    
    subgraph "配置层"
        E[sync.enabled 开关]
        F[GitHub Token 认证]
        G[Gist API 访问]
    end
    
    subgraph "数据层"
        H[本地数据 Chrome Storage]
        I[远程数据 GitHub Gist]
    end
    
    D --> E
    E -->|enabled=true| A
    D --> A
    C --> F
    F --> G
    G --> I
    A --> H
    
    A -.->|冲突检测| J[冲突解决机制]
    J -.->|用户选择| K[覆盖策略]
```

### 3.3 手动同步流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 同步设置界面
    participant SM as SyncManager
    participant GP as GitHubProvider
    participant API as GitHub API
    
    U->>UI: 点击"同步"按钮
    UI->>SM: 调用 sync() 方法
    SM->>SM: 检查 sync.enabled 状态
    
    alt sync.enabled = false
        SM->>UI: 返回 "同步已禁用" 消息
        UI->>U: 显示同步禁用提示
    else sync.enabled = true
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
    end
```

### 3.4 实时同步流程

```mermaid
sequenceDiagram
    participant BG as Background
    participant SM as SyncManager
    participant GP as GitHubProvider
    
    Note over BG: 用户执行操作（删除分组等）
    BG->>BG: 检查 sync.enabled 状态
    
    alt sync.enabled = false
        BG->>BG: 记录日志：同步已禁用，跳过同步
    else sync.enabled = true
        BG->>SM: 异步调用 sync() 方法
        SM->>SM: 检查认证状态和配置
        
        alt 认证成功且配置正确
            SM->>GP: 执行同步操作
            
            alt 同步成功
                SM->>SM: 更新同步状态
                Note over SM: 同步完成
            else 同步失败
                SM->>SM: 记录错误日志
                Note over SM: 同步失败，等待下次操作重试
            end
        else 认证失败或配置错误
            SM->>SM: 记录日志：等待用户配置
        end
    end
```

### 3.5 冲突检测与解决流程

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
| **SyncIntegration** | 同步系统集成、初始化控制 | `initializeSync()`, `setupPeriodicSync()`, `checkSyncEnabled()` |
| **SyncManager** | 同步逻辑管理、冲突处理 | `sync()`, `upload()`, `download()`, `enableAutoSync()`, `detectConflict()`, `resolveConflict()` |

| **GitHubSyncProvider** | GitHub API 交互 | `upload()`, `download()`, `isAuthenticated()` |
| **StorageManager** | 本地数据管理 | `getData()`, `setData()` |

### 5.2 数据同步策略

1. **同步启用检查**：
   - 所有同步操作前都会检查 `sync.enabled` 状态
   - 系统初始化时检查是否启用同步功能
   - 定期同步和实时同步都遵循此检查
   - 禁用时跳过所有同步操作并记录日志

2. **实时同步触发**：
   - 所有数据变更操作后都会检查同步状态
   - 如果同步启用且配置正确，则异步执行同步
   - 同步失败不影响用户操作，会在下次操作时重试

3. **冲突解决策略**：
   - 同设备：直接合并
   - 同账号不同设备：检查数据差异
   - 不同账号：提示用户选择

4. **简化的错误处理**：
   - 同步失败时记录日志但不阻塞用户操作
   - 依赖下次操作或定期同步来重试
   - 用户可以手动触发同步来解决问题

## 6. 错误处理机制

```mermaid
flowchart TD
    A[操作执行] --> B{是否成功}
    B -->|成功| C[检查 sync.enabled]
    B -->|失败| D[显示错误信息]
    
    C -->|enabled=false| E[跳过同步]
    C -->|enabled=true| F[异步执行同步]
    
    F --> G{认证状态}
    G -->|已认证| H[执行同步]
    G -->|未认证| I[记录日志等待配置]
    
    H --> J{同步结果}
    J -->|成功| K[完成]
    J -->|失败| L[记录错误日志]
    
    L --> M[等待下次操作重试]
    I --> N[完成]
    E --> K
    M --> K
```

## 7. 远程同步设计方案详细说明

### 7.1 设计目标

本方案旨在为 UniTab 设计一个健壮、可靠、支持离线操作的多设备数据同步机制。

* **数据一致性:** 确保用户在设备 A、B、C 上的数据，在与远程服务器同步后，能够达到最终一致。
* **离线优先:** 用户可以随时断开远程连接，在纯本地模式下无缝进行所有操作（增、删、改）。
* **智能重连:** 当用户重新启用同步时，系统能够智能合并离线期间的本地修改和云端的变更。
* **冲突解决:** 优雅地处理并发修改导致的冲突，最大限度地避免数据丢失。

### 7.2 核心原则

1. **单一事实来源 (Single Source of Truth):** 当连接时，远程 GitHub Gist 存储的数据被视为最高权威的"主版本"。
2. **元数据驱动 (Metadata-Driven):** 所有同步决策都基于元数据（最后修改时间、同步开关状态等）。
3. **乐观锁 & 三路合并:** 沿用此前的核心策略。在写入前检查远程状态，并在冲突时执行三路合并。

### 7.3 数据结构扩展

在 settings 中增加一个关键的布尔值字段 sync.enabled。

```json
{
  "version": "1.2.0",
  "metadata": {
    "lastModified": "2025-07-15T12:30:00.123Z",
    "lastSyncTimestamp": "2025-07-15T12:25:00.000Z",
    "deviceId": "device_unique_id_A"
  },
  "settings": {
    "sync": {
      "enabled": true, // <-- 核心开关
      "provider": "github",
      "gistId": "YOUR_GIST_ID"
    },
    "excludeList": [ "localhost" ]
  },
  "groups": [ ... ] // 结构不变
}
```

### 7.4 同步状态与流程

#### 7.4.1 状态定义

* **在线模式 (Sync Enabled):** settings.sync.enabled 为 true。插件会在启动、本地修改后、定时触发自动同步流程。
* **离线模式 (Sync Disabled):** settings.sync.enabled 为 false。插件不会执行任何网络请求，所有操作都只影响本地 chrome.storage。

#### 7.4.2 更新后的同步流程图

```mermaid
graph TD
    A["同步事件触发<br>(启动、修改、定时、<b>重连</b>)"] --> B{"检查 sync.enabled 状态"};
    B -- "🔴 禁用 (false)" --> C["不执行任何操作，结束"];
    B -- "🟢 启用 (true)" --> D{"获取远程元数据<br>(Gist last_updated_at)"};

    D --> E{"比较 远程时间戳<br>与 本地lastSyncTimestamp"};
    E --> F_NO_CHANGE["时间戳相同<br>✅ 无需操作，结束"];
    E --> G_REMOTE_NEW["远程版本更新"];
    E --> H_LOCAL_NEW["仅本地版本更新"];

    G_REMOTE_NEW --> I{"本地有无修改?<br>(local.lastModified > local.lastSyncTimestamp)"};
    I --> J_PULL["无本地修改<br>🚀 拉取远程数据覆盖本地"];
    I --> K_CONFLICT["有本地修改<br>🚨 检测到冲突!"];

    H_LOCAL_NEW --> L_PUSH["🚀 推送本地数据至远程"];
    L_PUSH --> M["成功后，更新本地<br>lastSyncTimestamp"];

    K_CONFLICT --> N{"执行三路合并算法"};
    N -- "合并成功" --> L_PUSH;
    N -- "需要用户介入" --> O["UI提示用户选择<br><b>(保留本地/保留远程/智能合并)</b>"];

    J_PULL --> M;
    M --> P["✅ 同步完成"];
```

#### 7.4.3 关键场景处理

1. **断开同步 (用户操作):**
   * 用户在选项页关闭同步开关。
   * 插件将 settings.sync.enabled 设置为 false。
   * 所有正在进行的或计划中的同步任务都将取消。
   * 此时 lastSyncTimestamp 将被"冻结"，成为未来恢复同步时的重要基准。

2. **离线期间操作:**
   * 用户正常进行增、删、改分组和标签页。
   * 每次修改都会更新 metadata.lastModified 时间戳，但 lastSyncTimestamp 保持不变。

3. **重新连接同步 (用户操作):**
   * 用户在选项页重新打开同步开关。
   * 这会立即触发一次手动的、高优先级的 **"同步事件"**。
   * 流程启动，进入流程图的 A 点。
   * 系统会发现 remote_timestamp (来自 Gist) 和 local.lastModified 都可能大于被"冻结"的 lastSyncTimestamp，这会大概率导向 K_CONFLICT (冲突检测)。
   * **冲突处理:**
     * 系统执行 **三路合并** 算法。
     * **如果可以自动合并** (例如，云端新增了一个分组，本地修改了另一个分组的名称)，则自动完成并推送。
     * **如果发生复杂冲突** (例如，云端和本地都修改了同一个分组的名称)，则必须由用户介入。插件将弹出一个模态框，提供清晰的选项：
       * **保留云端版本**: 放弃所有本地离线修改，用云端数据完全覆盖本地。
       * **保留本地版本**: 用本地数据覆盖云端版本，这可能会导致其他设备的修改丢失。
       * 尝试智能合并: (默认推荐) 执行三路合并算法，并展示合并预览（如果可行）。

---

*此流程图描述了 UniTab 浏览器扩展的完整标签处理和远程同步机制，包括用户操作流程、数据同步策略、冲突解决方案和错误处理机制。*