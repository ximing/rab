# 调试指南

RSJS 提供了完整的调试工具和 API，帮助你追踪 observable 的变化、分析性能问题和理解响应式系统的工作原理。

## 快速开始

### 使用内置调试器

最简单的方式是使用 `debuggerReaction` 函数，它会记录所有的 observable 操作（除了 `get`、`has`、`iterate` 等读操作）。

```typescript
import { observer, useService, bindServices, debuggerReaction } from '@rabjs/react';

class CounterService {
  @observable count = 0;

  increment() {
    this.count++;
  }
}

// 在 observer 中启用调试
const Counter = observer(
  () => {
    const service = useService(CounterService);
    return (
      <div>
        <p>Count: {service.count}</p>
        <button onClick={() => service.increment()}>+1</button>
      </div>
    );
  },
  { debugger: debuggerReaction }
);

export default bindServices(Counter, [CounterService]);
```

当你点击按钮时，控制台会输出：

```
数据变更触发了 schedule:
target Object { count: 0 }
key count
type set
value: 1
oldValue: 0
```

## 调试 API

### debuggerReaction

内置的调试器函数，用于记录所有数据变更操作。

```typescript
import { debuggerReaction, type Operation } from '@rabjs/react';

// 基础用法
const MyComponent = observer(
  () => <div>...</div>,
  { debugger: debuggerReaction }
);

// 或在 useObserver 中使用
useObserver(
  () => <div>...</div>,
  'MyComponent',
  { debugger: debuggerReaction }
);
```

**特点：**
- ✅ 自动过滤读操作（`get`、`has`、`iterate`）
- ✅ 只记录数据变更操作（`set`、`add`、`delete`、`clear`）
- ✅ 格式化输出，易于阅读
- ✅ 包含旧值和新值对比

### 自定义调试器

对于更复杂的调试需求，你可以实现自定义调试器。

#### 基础自定义调试器

```typescript
import { observer, useService, bindServices, type Operation } from '@rabjs/react';

const MyComponent = observer(
  () => {
    const service = useService(MyService);
    return <div>{service.data}</div>;
  },
  {
    debugger: (operation: Operation) => {
      console.log(`[${operation.type}] ${String(operation.key)}`);
    },
  }
);

export default bindServices(MyComponent, [MyService]);
```

#### Operation 对象详解

```typescript
interface Operation {
  target: object;           // 被操作的对象
  key: PropertyKey;         // 属性键（可以是字符串或 Symbol）
  type: OperationType;      // 操作类型
  value?: unknown;          // 新值（set/add 时有值）
  oldValue?: unknown;       // 旧值（set 时有值）
  receiver?: unknown;       // Proxy receiver
}

type OperationType = 'get' | 'has' | 'iterate' | 'add' | 'set' | 'delete' | 'clear';
```

**操作类型说明：**

| 类型      | 说明                 | 何时触发                    |
| --------- | -------------------- | --------------------------- |
| `get`     | 属性读取             | 访问对象属性                |
| `has`     | 属性检查             | 使用 `in` 操作符            |
| `iterate` | 迭代操作             | `for...in`、`Object.keys()` |
| `add`     | 添加新属性           | 添加不存在的属性            |
| `set`     | 修改属性             | 修改已存在的属性            |
| `delete`  | 删除属性             | 使用 `delete` 操作符        |
| `clear`   | 清空集合             | `Map.clear()`、`Set.clear()` |

#### 高级自定义调试器

```typescript
import { observer, useService, bindServices, type Operation } from '@rabjs/react';

class PerformanceDebugger {
  private operationCounts: Record<string, number> = {};
  private operationTimes: Record<string, number[]> = {};

  debug = (operation: Operation) => {
    const key = `${operation.type}:${String(operation.key)}`;

    // 统计操作次数
    this.operationCounts[key] = (this.operationCounts[key] || 0) + 1;

    // 记录操作时间
    if (!this.operationTimes[key]) {
      this.operationTimes[key] = [];
    }
    this.operationTimes[key].push(Date.now());

    // 输出详细信息
    console.group(`[${operation.type.toUpperCase()}] ${String(operation.key)}`);
    console.log('Target:', operation.target);
    if (operation.value !== undefined) {
      console.log('New Value:', operation.value);
    }
    if (operation.oldValue !== undefined) {
      console.log('Old Value:', operation.oldValue);
    }
    console.groupEnd();
  };

  getStats() {
    return {
      operationCounts: this.operationCounts,
      operationTimes: this.operationTimes,
      totalOperations: Object.values(this.operationCounts).reduce((a, b) => a + b, 0),
    };
  }

  reset() {
    this.operationCounts = {};
    this.operationTimes = {};
  }
}

const debugger = new PerformanceDebugger();

const MyComponent = observer(
  () => {
    const service = useService(MyService);
    return (
      <div>
        <div>{service.data}</div>
        <button onClick={() => console.log(debugger.getStats())}>
          显示统计信息
        </button>
      </div>
    );
  },
  { debugger: debugger.debug }
);

export default bindServices(MyComponent, [MyService]);
```

## 调试场景

### 场景 1：追踪特定属性的变化

```typescript
import { observer, useService, bindServices, type Operation } from '@rabjs/react';

const UserComponent = observer(
  () => {
    const userService = useService(UserService);
    return <div>{userService.user.name}</div>;
  },
  {
    debugger: (operation: Operation) => {
      // 只记录 user 属性的变化
      if (operation.key === 'user') {
        console.log(`User changed:`, operation.value);
      }
    },
  }
);

export default bindServices(UserComponent, [UserService]);
```

### 场景 2：性能分析

```typescript
import { observer, useService, bindServices, type Operation } from '@rabjs/react';

const PerformanceComponent = observer(
  () => {
    const service = useService(MyService);

    const operationLog = React.useRef<Operation[]>([]);

    const debugger = (operation: Operation) => {
      operationLog.current.push(operation);

      // 如果操作过于频繁，发出警告
      if (operationLog.current.length > 100) {
        console.warn('⚠️ 过多的 observable 操作，可能存在性能问题');
        console.table(
          operationLog.current.reduce(
            (acc, op) => {
              const key = `${op.type}:${String(op.key)}`;
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          )
        );
        operationLog.current = [];
      }
    };

    return <div>{service.data}</div>;
  },
  { debugger }
);

export default bindServices(PerformanceComponent, [MyService]);
```

### 场景 3：条件调试

```typescript
import { observer, useService, bindServices, type Operation } from '@rabjs/react';

// 只在开发环境启用调试
const debugger =
  process.env.NODE_ENV === 'development'
    ? (operation: Operation) => {
        console.log(`[${operation.type}] ${String(operation.key)}`);
      }
    : undefined;

const MyComponent = observer(
  () => {
    const service = useService(MyService);
    return <div>{service.data}</div>;
  },
  { debugger }
);

export default bindServices(MyComponent, [MyService]);
```

### 场景 4：调试数组操作

```typescript
import { observer, useService, bindServices, type Operation } from '@rabjs/react';

class TodoService {
  @observable todos: Array<{ id: number; title: string }> = [];

  addTodo(title: string) {
    this.todos.push({ id: Date.now(), title });
  }

  removeTodo(id: number) {
    const index = this.todos.findIndex(t => t.id === id);
    if (index > -1) {
      this.todos.splice(index, 1);
    }
  }
}

const TodoList = observer(
  () => {
    const todoService = useService(TodoService);

    return (
      <div>
        <button onClick={() => todoService.addTodo('New Task')}>Add</button>
        <ul>
          {todoService.todos.map(todo => (
            <li key={todo.id}>
              {todo.title}
              <button onClick={() => todoService.removeTodo(todo.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    );
  },
  {
    debugger: (operation: Operation) => {
      // 追踪数组操作
      if (operation.key === 'todos') {
        console.log(`Array operation: ${operation.type}`, {
          value: operation.value,
          oldValue: operation.oldValue,
        });
      }
    },
  }
);

export default bindServices(TodoList, [TodoService]);
```

## 在 useObserver 中调试

`useObserver` Hook 也支持调试选项：

```typescript
import { useObserver, useLocalObservable, debuggerReaction } from '@rabjs/react';

export function DebugComponent() {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
  }));

  return useObserver(
    () => (
      <div>
        <p>Count: {state.count}</p>
        <button onClick={() => state.increment()}>+1</button>
      </div>
    ),
    'DebugComponent',
    { debugger: debuggerReaction }
  );
}
```

## 浏览器开发者工具集成

### 使用 Chrome DevTools

1. **打开 DevTools** - 按 `F12` 或 `Cmd+Option+I`
2. **切换到 Console 标签**
3. **启用调试器** - 在组件中添加 `debugger` 选项
4. **观察输出** - 在 Console 中查看所有操作

### 设置条件断点

```typescript
import { observer, useService, bindServices, type Operation } from '@rabjs/react';

const MyComponent = observer(
  () => {
    const service = useService(MyService);
    return <div>{service.data}</div>;
  },
  {
    debugger: (operation: Operation) => {
      // 在特定条件下设置断点
      if (operation.key === 'criticalField' && operation.type === 'set') {
        debugger; // 浏览器会在这里暂停
      }
    },
  }
);

export default bindServices(MyComponent, [MyService]);
```

## 常见调试问题

### 问题 1：调试器没有被触发

**原因：** 可能是因为组件没有访问 observable 属性。

**解决方案：**

```typescript
// ❌ 错误 - 没有访问 observable
const MyComponent = observer(
  () => {
    const service = useService(MyService);
    // 没有使用 service 的任何属性
    return <div>Hello</div>;
  },
  { debugger: debuggerReaction }
);

// ✅ 正确 - 访问 observable 属性
const MyComponent = observer(
  () => {
    const service = useService(MyService);
    return <div>{service.data}</div>; // 访问了 data 属性
  },
  { debugger: debuggerReaction }
);
```

### 问题 2：调试器输出过多

**原因：** 可能是频繁的属性访问或不必要的重新渲染。

**解决方案：**

```typescript
// 过滤不需要的操作
const debugger = (operation: Operation) => {
  // 只记录 set 和 delete 操作
  if (['set', 'delete'].includes(operation.type)) {
    console.log(`[${operation.type}] ${String(operation.key)}`);
  }
};
```

### 问题 3：性能下降

**原因：** 调试器本身可能会影响性能。

**解决方案：**

```typescript
// 只在开发环境启用
const debugger =
  process.env.NODE_ENV === 'development'
    ? debuggerReaction
    : undefined;

const MyComponent = observer(
  () => {
    const service = useService(MyService);
    return <div>{service.data}</div>;
  },
  { debugger }
);
```

## 最佳实践

### 1. 在开发环境启用调试

```typescript
const debugger =
  process.env.NODE_ENV === 'development' ? debuggerReaction : undefined;

const MyComponent = observer(
  () => <div>...</div>,
  { debugger }
);
```

### 2. 使用有意义的组件名称

```typescript
// ✅ 好 - 清晰的组件名称
useObserver(() => <div>...</div>, 'UserProfileCard', { debugger });

// ❌ 不好 - 模糊的名称
useObserver(() => <div>...</div>, 'Component', { debugger });
```

### 3. 针对性调试

```typescript
// ✅ 好 - 只调试特定属性
const debugger = (operation: Operation) => {
  if (operation.key === 'targetProperty') {
    console.log(operation);
  }
};

// ❌ 不好 - 记录所有操作
const debugger = (operation: Operation) => {
  console.log(operation);
};
```

### 4. 使用类型安全的调试器

```typescript
import { type Operation } from '@rabjs/react';

const debugger = (operation: Operation): void => {
  // TypeScript 会检查 operation 的类型
  console.log(operation.type, operation.key);
};
```

## 下一步

- 📖 了解 [响应式状态原理](../observer/introduction.md)
- 🔧 了解 [Service 深入指南](./service-deep-dive.md)
- 🏗️ 了解 [Service 领域架构](./service-domain.md)
- 🎯 了解 [observer vs view](./observer-vs-view.md)