# 案例 1：简单计数器（基础示例）

这是最简单的 RSJS 使用案例，展示了如何创建一个基础的计数器应用。

## 场景描述

实现一个简单的计数器，支持增加和减少操作。这个案例展示了：

- 如何创建一个基础的 Service
- 如何在 React 组件中使用 Service
- 如何使用 `observer` 和 `bindServices`

## 完整代码

### 1. 定义 Service

```typescript
// services/CounterService.ts
import { Service } from '@rabjs/react';

export class CounterService extends Service {
  // 状态
  count = 0;

  // 方法
  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }

  reset() {
    this.count = 0;
  }
}
```

### 2. 创建 React 组件

```typescript
// components/Counter.tsx
import React from 'react';
import { observer, useService, bindServices } from '@rabjs/react';
import { CounterService } from '../services/CounterService';

// 使用 observer 包装组件，使其能够追踪 Service 中的状态变化
const CounterContent = observer(() => {
  // 通过 useService 获取 Service 实例
  const service = useService(CounterService);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>计数器</h1>

      {/* 显示当前计数 */}
      <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '20px 0' }}>{service.count}</div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={() => service.decrement()}
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          -1
        </button>

        <button onClick={() => service.reset()} style={{ padding: '10px 20px', fontSize: '16px' }}>
          重置
        </button>

        <button
          onClick={() => service.increment()}
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          +1
        </button>
      </div>
    </div>
  );
});

// 使用 bindServices 导出组件，注册所需的 Service
export default bindServices(CounterContent, [CounterService]);
```

### 3. 在应用中使用

```typescript
// App.tsx
import Counter from './components/Counter';

export default function App() {
  return (
    <div>
      <Counter />
    </div>
  );
}
```

## 工作原理

1. **Service 定义**：`CounterService` 继承自 `Service` 基类，定义了状态 `count` 和操作方法
2. **observer 包装**：`observer` HOC 使组件能够自动追踪 Service 中的状态变化
3. **useService 获取**：`useService(CounterService)` 从依赖注入容器中获取 Service 实例
4. **bindServices 注册**：`bindServices` 创建依赖注入容器，注册 `CounterService`，并通过 Context 提供给组件树

## 关键特性

✅ **自动追踪**：当 `service.count` 变化时，组件自动重新渲染  
✅ **无需手动订阅**：不需要手动管理订阅和取消订阅  
✅ **类型安全**：完整的 TypeScript 类型推导  
✅ **简洁易用**：最少的代码实现完整功能

## 常见问题

### Q: 为什么需要 `observer`？

A: `observer` 使组件能够自动追踪组件中访问的 observable 属性。当这些属性变化时，组件会自动重新渲染。

### Q: 为什么需要 `bindServices`？

A: `bindServices` 创建一个依赖注入容器，注册所需的 Service，并通过 React Context 提供给组件树中的所有组件。

### Q: 如何在多个组件中共享 Service？

A: 只需在根组件使用 `bindServices` 注册 Service，所有子组件都可以通过 `useService` 获取同一个 Service 实例。

## 下一步

- 查看 [案例 2：待办事项列表](./02-todo-list.md) 了解更复杂的状态管理
- 查看 [案例 3：用户管理系统](./03-user-management.md) 了解异步操作和依赖注入
