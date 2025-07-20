# UniTab Hooks

## useAutoSync

统一的自动同步 Hook，用于在各个页面中处理自动同步逻辑。

### 功能特性

- 页面加载时检查同步
- 定时同步（仅在页面可见时）
- 网络状态监听
- 页面可见性检测
- 防重复同步（基于时间阈值）

### 使用方法

```typescript
import { useAutoSync } from '../hooks/useAutoSync';

// 基础用法 - 仅页面加载时检查
useAutoSync();

// 完整配置
useAutoSync({
  checkOnMount: true,                    // 页面加载时检查同步
  enablePeriodicSync: true,              // 启用定时同步
  enableNetworkListener: true,           // 启用网络状态监听
  syncThresholdMinutes: 30,              // 同步阈值（分钟）
  periodicSyncIntervalMinutes: 30        // 定时同步间隔（分钟）
});
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `checkOnMount` | boolean | true | 是否在页面加载时检查同步 |
| `enablePeriodicSync` | boolean | false | 是否启用定时同步（仅在页面可见时） |
| `enableNetworkListener` | boolean | false | 是否监听网络状态变化 |
| `syncThresholdMinutes` | number | 30 | 同步检查的时间阈值（分钟） |
| `periodicSyncIntervalMinutes` | number | 30 | 定时同步间隔（分钟） |

### 返回值

```typescript
const { checkAndSync, startPeriodicSync, stopPeriodicSync } = useAutoSync(options);
```

- `checkAndSync()`: 手动触发同步检查
- `startPeriodicSync()`: 手动启动定时同步
- `stopPeriodicSync()`: 手动停止定时同步

### 使用场景

#### Popup 页面
```typescript
// 仅在打开时检查同步
useAutoSync({
  checkOnMount: true,
  syncThresholdMinutes: 30
});
```

#### Tab List 页面
```typescript
// 完整的同步功能：页面检查 + 定时同步 + 网络监听
useAutoSync({
  checkOnMount: true,
  enablePeriodicSync: true,
  enableNetworkListener: true,
  syncThresholdMinutes: 30,
  periodicSyncIntervalMinutes: 30
});
```

#### Options 页面
```typescript
// 仅在打开时检查同步
useAutoSync({
  checkOnMount: true,
  syncThresholdMinutes: 30
});
```

### 工作原理

1. **时间阈值检查**: 只有当距离上次同步超过指定阈值时才会触发同步
2. **认证状态检查**: 只有在用户已配置 GitHub 同步且有有效 token 时才会执行同步
3. **页面可见性**: 定时同步只在页面可见时执行，避免后台资源浪费
4. **网络状态**: 网络恢复时自动触发同步检查
5. **自动清理**: 组件卸载时自动清理定时器和事件监听器

### 注意事项

- Hook 内部会自动处理错误，不会抛出异常
- 定时同步只在页面可见且网络在线时执行
- 所有同步操作都是静默的，不会显示 UI 提示
- 重复调用 `useAutoSync` 会重新初始化配置