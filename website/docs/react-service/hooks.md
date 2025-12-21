# Hooks API 参考

RSJS 提供了一套完整的 Hooks API，用于在 React 组件中使用 Service 和响应式状态。

## 核心 Hooks

### useService

`useService` 是在 React 组件中获取 Service 实例的核心 Hook。

#### 基础用法

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

class UserService extends Service {
  @observable user: any = null;

  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    this.user = await response.json();
  }
}

const UserProfile = observer(() => {
  // 获取 Service 实例
  const userService = useService(UserService);

  return (
    <div>
      <p>用户: {userService.user?.name}</p>
      <button onClick={() => userService.fetchUser('123')}>加载用户</button>
    </div>
  );
});

export default bindServices(UserProfile, [UserService]);
```

#### 类型推导

```typescript
// 方式 1: 使用类构造函数（推荐）- 自动类型推导
const userService = useService(UserService); // 类型: UserService

// 方式 2: 使用字符串标识符 - 需要显式指定泛型
const userService = useService<UserService>('userService');

// 方式 3: 使用 Symbol 标识符
const USER_SERVICE = Symbol('userService');
const userService = useService<UserService>(USER_SERVICE);
```

#### 服务作用域

```typescript
import { ServiceScope } from '@rabjs/service';

// Singleton（默认）- 容器内共享同一实例
const userService = useService(UserService);

// Transient - 每个组件实例独立
const componentService = useService(ComponentService, { scope: ServiceScope.Transient });
```

**Singleton vs Transient:**

| 特性         | Singleton  | Transient    |
| ------------ | ---------- | ------------ |
| **实例数量** | 容器内唯一 | 每个组件独立 |
| **生命周期** | 与容器绑定 | 与组件绑定   |
| **使用场景** | 共享状态   | 组件私有状态 |
| **性能**     | 更好       | 稍差         |

#### 作用域链查找

`useService` 支持作用域链查找，会从当前容器向上查找父容器：

```typescript
// 应用根容器
const AppContent = observer(() => {
  const appService = useService(AppService);
  return <PageComponent />;
});

export const App = bindServices(AppContent, [AppService]);

// 页面容器
const PageContent = observer(() => {
  const appService = useService(AppService); // ✅ 从父容器查找
  const pageService = useService(PageService); // ✅ 从当前容器查找
  return <div />;
});

export const Page = bindServices(PageContent, [PageService]);
```

#### 错误处理

```typescript
const MyComponent = observer(() => {
  try {
    const service = useService(MyService);
    return <div>{service.data}</div>;
  } catch (error) {
    // 服务未找到或容器错误
    return <div>服务加载失败</div>;
  }
});
```

### useContainer

`useContainer` 用于获取当前容器实例，适用于高级场景。

#### 基础用法

```typescript
import { useContainer } from '@rabjs/react';

const DebugComponent = () => {
  const container = useContainer();

  return (
    <div>
      <p>容器名称: {String(container.getName())}</p>
      <p>已注册服务: {container.getServiceIdentifiers().length}</p>
    </div>
  );
};
```

#### 高级用法

```typescript
// 动态注册服务
const DynamicComponent = () => {
  const container = useContainer();

  React.useEffect(() => {
    // 动态注册服务
    container.register(DynamicService);

    return () => {
      // 清理
      container.unregister(DynamicService);
    };
  }, [container]);

  return <div />;
};

// 检查服务是否存在
const ConditionalComponent = () => {
  const container = useContainer();
  const hasService = container.has(OptionalService);

  return hasService ? <ServiceView /> : <NoServiceView />;
};
```

### useContainerEvents

`useContainerEvents` 用于获取容器的事件系统，实现组件间通信。

#### 基础用法

```typescript
import { useContainerEvents } from '@rabjs/react';

const MessageSender = () => {
  const events = useContainerEvents();

  const sendMessage = () => {
    events.emit('message:sent', { text: 'Hello', from: 'Sender' });
  };

  return <button onClick={sendMessage}>发送消息</button>;
};

const MessageReceiver = () => {
  const events = useContainerEvents();
  const [messages, setMessages] = React.useState<string[]>([]);

  React.useEffect(() => {
    const handler = (data: { text: string; from: string }) => {
      setMessages(prev => [...prev, `${data.from}: ${data.text}`]);
    };

    events.on('message:sent', handler);

    return () => {
      events.off('message:sent', handler);
    };
  }, [events]);

  return (
    <ul>
      {messages.map((msg, i) => (
        <li key={i}>{msg}</li>
      ))}
    </ul>
  );
};
```

#### 事件作用域

```typescript
// 容器级别事件（默认）
const LocalEvents = () => {
  const events = useContainerEvents();

  React.useEffect(() => {
    // 只在当前容器内有效
    events.on('local:event', data => {
      console.log('Local event:', data);
    });
  }, [events]);

  return <button onClick={() => events.emit('local:event', {})}>发送本地事件</button>;
};

// 全局事件（需要通过 Service）
const GlobalEvents = observer(() => {
  const service = useService(MyService);

  React.useEffect(() => {
    // 通过 Service 发送全局事件
    service.on(
      'global:event',
      data => {
        console.log('Global event:', data);
      },
      'global'
    );
  }, [service]);

  return <button onClick={() => service.emit('global:event', {}, 'global')}>发送全局事件</button>;
});
```

#### 类型安全的事件

```typescript
interface UserEvent {
  id: number;
  name: string;
  action: 'login' | 'logout';
}

const TypedEvents = () => {
  const events = useContainerEvents();

  React.useEffect(() => {
    const handler = (user: UserEvent) => {
      console.log(`User ${user.name} ${user.action}`);
    };

    events.on('user:action', handler);
    return () => events.off('user:action', handler);
  }, [events]);

  const handleLogin = () => {
    const user: UserEvent = { id: 1, name: 'John', action: 'login' };
    events.emit('user:action', user);
  };

  return <button onClick={handleLogin}>登录</button>;
};
```

#### 与 Service 配合使用

```typescript
class NotificationService extends Service {
  notifications: string[] = [];

  constructor() {
    super();

    // Service 内部监听容器事件
    this.on('notification:add', (message: string) => {
      this.notifications.push(message);
    });
  }
}

const NotificationSender = () => {
  const events = useContainerEvents();

  return <button onClick={() => events.emit('notification:add', '新通知')}>添加通知</button>;
};

const NotificationList = observer(() => {
  const service = useService(NotificationService);

  return (
    <ul>
      {service.notifications.map((notif, i) => (
        <li key={i}>{notif}</li>
      ))}
    </ul>
  );
});

const App = () => (
  <>
    <NotificationSender />
    <NotificationList />
  </>
);

export default bindServices(App, [NotificationService]);
```

### useObserverService

`useObserverService` 结合了 `useService` 和 `useObserver` 的功能，让组件在不使用 `@observer` HOC 的情况下也能实现响应式更新。

> 💡 **推荐**: 优先使用 `observer` + `useService` 的方式。`useObserverService` 适用于无法使用 HOC 的场景。

#### 基础用法

```typescript
import { useObserverService } from '@rabjs/react';

class CounterService extends Service {
  @observable count = 0;

  increment() {
    this.count++;
  }
}

// 不使用 observer HOC
const Counter = () => {
  // 返回 [selectedState, service]
  const [state, service] = useObserverService(CounterService, svc => ({ count: svc.count }));

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => service.increment()}>+1</button>
    </div>
  );
};

export default bindServices(Counter, [CounterService]);
```

#### 选择器模式

```typescript
class UserService extends Service {
  @observable user = { name: 'John', age: 30, email: 'john@example.com' };

  updateName(name: string) {
    this.user.name = name;
  }
}

// 选择单个属性
const UserName = () => {
  const [name, service] = useObserverService(UserService, svc => svc.user.name);

  return <p>Name: {name}</p>;
};

// 选择多个属性
const UserInfo = () => {
  const [info, service] = useObserverService(UserService, svc => ({
    name: svc.user.name,
    age: svc.user.age,
  }));

  return (
    <div>
      <p>Name: {info.name}</p>
      <p>Age: {info.age}</p>
    </div>
  );
};

// 选择计算属性
const UserDisplay = () => {
  const [display, service] = useObserverService(
    UserService,
    svc => `${svc.user.name} (${svc.user.age})`
  );

  return <p>{display}</p>;
};
```

#### 性能优化

```typescript
class TodoService extends Service {
  @observable todos: Array<{ id: number; title: string; done: boolean }> = [];

  toggleTodo(id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
  }
}

// ✅ 好 - 只选择需要的数据
const TodoCount = () => {
  const [count] = useObserverService(TodoService, svc => svc.todos.length);

  return <p>总数: {count}</p>;
};

// ✅ 好 - 选择过滤后的数据
const ActiveTodos = () => {
  const [activeTodos] = useObserverService(TodoService, svc => svc.todos.filter(t => !t.done));

  return (
    <ul>
      {activeTodos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
};

// ❌ 不好 - 选择整个对象
const AllTodos = () => {
  const [todos] = useObserverService(
    TodoService,
    svc => svc.todos // 任何 todo 变化都会触发重新渲染
  );

  return <div>{todos.length}</div>;
};
```

#### 与 Transient Scope 配合

```typescript
import { ServiceScope } from '@rabjs/service';

const ComponentWithTransient = () => {
  const [state, service] = useObserverService(
    ComponentService,
    svc => svc.state,
    ServiceScope.Transient // 每个组件实例独立
  );

  return <div>{state.value}</div>;
};
```

#### observer vs useObserverService

```typescript
// 方式 1: observer + useService（推荐）
const TodoList1 = observer(() => {
  const service = useService(TodoService);

  return (
    <ul>
      {service.todos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
});

// 方式 2: useObserverService
const TodoList2 = () => {
  const [todos, service] = useObserverService(TodoService, svc => svc.todos);

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
};
```

**对比:**

| 特性           | observer + useService | useObserverService |
| -------------- | --------------------- | ------------------ |
| **代码简洁性** | ✅ 更简洁             | 需要选择器函数     |
| **性能**       | ✅ 自动优化           | 需要手动优化选择器 |
| **灵活性**     | 访问所有属性          | ✅ 精确控制追踪    |
| **推荐度**     | ✅ 推荐               | 特殊场景           |

## 低级 Hooks

> ⚠️ **注意**: 以下 Hooks 是为了兼容性和特殊场景而提供的。**推荐优先使用 Service + observer 的方式**，详见 [深入 Service](./service-deep-dive.md)。

## useObserver

`useObserver` 是一个低级 Hook，用于在函数组件中追踪 observable 的变化。

### 基础用法

```typescript
import { useObserver, useLocalObservable } from '@rabjs/react';

export function Counter() {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
  }));

  // useObserver 会追踪 state.count 的访问
  return useObserver(() => (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.increment()}>+1</button>
    </div>
  ));
}
```

### 工作原理

`useObserver` 通过以下步骤工作：

1. **创建 Reaction** - 在首次渲染时创建一个 reaction
2. **追踪访问** - 在渲染函数执行时追踪所有 observable 属性的访问
3. **订阅变化** - 当这些属性变化时，自动触发组件重新渲染
4. **清理资源** - 组件卸载时自动清理 reaction

### 性能特性

- ✅ 细粒度追踪 - 只追踪实际访问的属性
- ✅ 自动批量更新 - 多个属性变化只触发一次重新渲染
- ✅ 自动内存管理 - 使用 FinalizationRegistry 自动清理
- ✅ 支持并发模式 - 完全兼容 React 18+ 并发特性

### 调试支持

`useObserver` 支持通过 `debugger` 选项来追踪 observable 的操作，用于调试和性能分析。

#### 基础调试

```typescript
import { useObserver, useLocalObservable, debuggerReaction } from '@rabjs/react';

export function DebugCounter() {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
  }));

  // 使用 debuggerReaction 追踪所有操作
  return useObserver(
    () => (
      <div>
        <p>Count: {state.count}</p>
        <button onClick={() => state.increment()}>+1</button>
      </div>
    ),
    'DebugCounter',
    { debugger: debuggerReaction }
  );
}
```

#### 自定义调试器

```typescript
import { useObserver, useLocalObservable, type Operation } from '@rabjs/react';

export function CustomDebugComponent() {
  const state = useLocalObservable(() => ({
    user: { name: 'John', age: 30 },
    updateName(name: string) {
      this.user.name = name;
    },
  }));

  // 自定义调试器，只记录 set 操作
  const customDebugger = (operation: Operation) => {
    if (operation.type === 'set') {
      console.log(
        `[SET] ${String(operation.key)}: ${operation.oldValue} -> ${operation.value}`
      );
    }
  };

  return useObserver(
    () => (
      <div>
        <p>Name: {state.user.name}</p>
        <input
          value={state.user.name}
          onChange={e => state.updateName(e.target.value)}
        />
      </div>
    ),
    'CustomDebugComponent',
    { debugger: customDebugger }
  );
}
```

#### Operation 对象结构

```typescript
interface Operation {
  target: object;           // 被操作的对象
  key: PropertyKey;         // 属性键
  type: OperationType;      // 操作类型
  value?: unknown;          // 新值（set/add 时）
  oldValue?: unknown;       // 旧值（set 时）
  receiver?: unknown;       // Proxy receiver
}

type OperationType = 'get' | 'has' | 'iterate' | 'add' | 'set' | 'delete' | 'clear';
```

#### 高级调试示例

```typescript
import { useObserver, useLocalObservable, type Operation } from '@rabjs/react';

export function AdvancedDebugComponent() {
  const state = useLocalObservable(() => ({
    todos: [] as Array<{ id: number; title: string; done: boolean }>,
    addTodo(title: string) {
      this.todos.push({ id: Date.now(), title, done: false });
    },
    toggleTodo(id: number) {
      const todo = this.todos.find(t => t.id === id);
      if (todo) todo.done = !todo.done;
    },
  }));

  // 详细的调试器，记录所有操作并统计
  const operationStats = React.useRef<Record<string, number>>({});

  const detailedDebugger = (operation: Operation) => {
    const key = `${operation.type}:${String(operation.key)}`;
    operationStats.current[key] = (operationStats.current[key] || 0) + 1;

    console.group(`[${operation.type.toUpperCase()}] ${String(operation.key)}`);
    console.log('Target:', operation.target);
    if (operation.value !== undefined) console.log('Value:', operation.value);
    if (operation.oldValue !== undefined) console.log('Old Value:', operation.oldValue);
    console.groupEnd();
  };

  return useObserver(
    () => (
      <div>
        <button onClick={() => state.addTodo('New Task')}>Add Todo</button>
        <ul>
          {state.todos.map(todo => (
            <li key={todo.id}>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => state.toggleTodo(todo.id)}
              />
              <span>{todo.title}</span>
            </li>
          ))}
        </ul>
        <details>
          <summary>操作统计</summary>
          <pre>{JSON.stringify(operationStats.current, null, 2)}</pre>
        </details>
      </div>
    ),
    'AdvancedDebugComponent',
    { debugger: detailedDebugger }
  );
}
```

### 高级用法

```typescript
// 追踪多个 observable
export function Dashboard() {
  const userService = useLocalObservable(() => new UserService());
  const statsService = useLocalObservable(() => new StatsService());

  return useObserver(() => (
    <div>
      <h1>{userService.name}</h1>
      <p>访问量: {statsService.views}</p>
      <p>点赞数: {statsService.likes}</p>
    </div>
  ));
}

// 条件渲染
export function ConditionalRender() {
  const state = useLocalObservable(() => ({
    isVisible: false,
    toggle() {
      this.isVisible = !this.isVisible;
    },
  }));

  return useObserver(() => (
    <div>
      <button onClick={() => state.toggle()}>切换</button>
      {state.isVisible && <p>现在可见</p>}
    </div>
  ));
}

// 列表渲染
export function TodoList() {
  const service = useLocalObservable(() => new TodoService());

  return useObserver(() => (
    <ul>
      {service.todos.map(todo => (
        <li key={todo.id}>
          {/* 每个 todo 的变化都会被追踪 */}
          <input type="checkbox" checked={todo.done} onChange={() => service.toggleTodo(todo.id)} />
          <span>{todo.title}</span>
        </li>
      ))}
    </ul>
  ));
}
```

## useLocalObservable

`useLocalObservable` 用于在组件内创建本地 observable 对象。

> 💡 **建议**: 对于 Service 类，推荐使用 `observer` + `useService` + `bindServices` 的方式。`useLocalObservable` 适合创建简单的本地状态对象。

### 基础用法

```typescript
import { useLocalObservable, useObserver } from '@rabjs/react';

export function Counter() {
  // 创建本地 observable 对象
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
    decrement() {
      this.count--;
    },
  }));

  return useObserver(() => (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.increment()}>+1</button>
      <button onClick={() => state.decrement()}>-1</button>
    </div>
  ));
}
```

### 生命周期

```typescript
export function LifecycleExample() {
  const state = useLocalObservable(() => {
    console.log('创建 observable');
    return {
      count: 0,
      increment() {
        this.count++;
      },
    };
  });

  React.useEffect(() => {
    console.log('组件挂载');
    return () => {
      console.log('组件卸载，observable 会被清理');
    };
  }, []);

  return useObserver(() => (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.increment()}>+1</button>
    </div>
  ));
}
```

## useAsObservableSource

`useAsObservableSource` 用于将 props 或其他值转换为 observable 对象。

### 基础用法

```typescript
import { useAsObservableSource, useLocalObservable, useObserver } from '@rabjs/react';

interface UserProps {
  userId: string;
  userName: string;
}

export function UserProfile({ userId, userName }: UserProps) {
  // 将 props 转换为 observable
  const observableProps = useAsObservableSource({ userId, userName });

  // 创建依赖于 props 的计算属性
  const state = useLocalObservable(() => ({
    get displayName() {
      return `User: ${observableProps.userName}`;
    },
    get profileUrl() {
      return `/users/${observableProps.userId}`;
    },
  }));

  return useObserver(() => (
    <div>
      <h1>{state.displayName}</h1>
      <a href={state.profileUrl}>查看完整资料</a>
    </div>
  ));
}
```

### 高级用法

```typescript
interface FilterProps {
  category: string;
  sortBy: 'name' | 'date';
  limit: number;
}

export function FilteredList({ category, sortBy, limit }: FilterProps) {
  const observableProps = useAsObservableSource({ category, sortBy, limit });

  const state = useLocalObservable(() => ({
    items: [] as any[],

    async loadItems() {
      const response = await fetch(
        `/api/items?category=${observableProps.category}&sort=${observableProps.sortBy}&limit=${observableProps.limit}`
      );
      this.items = await response.json();
    },

    get displayItems() {
      return this.items.slice(0, observableProps.limit);
    },
  }));

  // 当 props 变化时重新加载
  React.useEffect(() => {
    state.loadItems();
  }, [observableProps.category, observableProps.sortBy, observableProps.limit]);

  return useObserver(() => (
    <ul>
      {state.displayItems.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  ));
}
```

## Hooks 使用场景对比

### 核心 Hooks（推荐）

```typescript
// ✅ 推荐 - Service + observer + useService
const AppContent = observer(() => {
  const userService = useService(UserService);
  const todoService = useService(TodoService);

  return (
    <div>
      <p>用户: {userService.name}</p>
      <ul>
        {todoService.todos.map(todo => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(AppContent, [UserService, TodoService]);
```

### 事件通信

```typescript
// ✅ 推荐 - useContainerEvents 用于组件间通信
const Sender = () => {
  const events = useContainerEvents();
  return <button onClick={() => events.emit('message', 'Hello')}>发送</button>;
};

const Receiver = () => {
  const events = useContainerEvents();
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    const handler = (data: string) => setMsg(data);
    events.on('message', handler);
    return () => events.off('message', handler);
  }, [events]);

  return <p>{msg}</p>;
};
```

### 无 HOC 场景

```typescript
// useObserverService - 无法使用 observer HOC 时
const Counter = () => {
  const [state, service] = useObserverService(CounterService, svc => ({ count: svc.count }));

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => service.increment()}>+1</button>
    </div>
  );
};
```

### 低级 Hooks

```typescript
// useLocalObservable + useObserver - 组件级别的临时状态
export function LocalCounter() {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
  }));

  return useObserver(() => (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.increment()}>+1</button>
    </div>
  ));
}
```

## 最佳实践

### 1. 优先使用 Service 方式

```typescript
// ✅ 推荐
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});

export default bindServices(MyComponent, [MyService]);

// ❌ 避免
export function MyComponent() {
  const state = useLocalObservable(() => ({ data: null }));
  return useObserver(() => <div>{state.data}</div>);
}
```

### 2. 正确的 Hook 顺序

```typescript
// ✅ 正确
export function Component() {
  const state = useLocalObservable(() => ({ count: 0 }));
  const observableProps = useAsObservableSource({ value: 1 });

  React.useEffect(() => {
    // ...
  }, []);

  return useObserver(() => <div>{state.count}</div>);
}

// ❌ 错误 - Hook 顺序不一致
export function Component({ value }: any) {
  if (value > 0) {
    const state = useLocalObservable(() => ({ count: 0 }));
  }
  // ...
}
```

### 3. 避免在 useObserver 外访问 observable

```typescript
// ✅ 正确
export function Component() {
  const state = useLocalObservable(() => ({ count: 0 }));
  return useObserver(() => <div>{state.count}</div>);
}

// ❌ 错误
export function Component() {
  const state = useLocalObservable(() => ({ count: 0 }));
  const count = state.count; // 在 useObserver 外访问
  return <div>{count}</div>;
}
```

## Hooks 选择指南

| 场景                  | 推荐 Hook                            | 原因                              |
| --------------------- | ------------------------------------ | --------------------------------- |
| **获取 Service 实例** | `useService`                         | 核心 Hook，支持类型推导和作用域链 |
| **响应式组件**        | `observer` + `useService`            | 最佳实践，自动追踪所有访问        |
| **组件间通信**        | `useContainerEvents`                 | 容器级别事件，支持发送和监听      |
| **跨领域通信**        | Service 的 `emit/on` + `'global'`    | 全局事件，跨所有容器              |
| **无 HOC 场景**       | `useObserverService`                 | 精确控制追踪，适合特殊场景        |
| **获取容器实例**      | `useContainer`                       | 高级场景，动态注册服务            |
| **组件临时状态**      | `useLocalObservable` + `useObserver` | 简单、轻量的本地状态              |
| **Props 响应式**      | `useAsObservableSource`              | 自动追踪 props 变化               |

### 推荐优先级

1. **首选**: `observer` + `useService` + `bindServices`
2. **事件通信**: `useContainerEvents` 或 Service 的事件方法
3. **特殊场景**: `useObserverService`（无法使用 HOC 时）
4. **高级场景**: `useContainer`（动态注册服务）
5. **临时状态**: `useLocalObservable` + `useObserver`

## 下一步

- 🔧 了解 [深入 Service](./service-deep-dive.md) 的推荐方式
- 🏗️ 了解 [Service 领域](./service-domain.md) 的架构设计
- 🔍 了解 [observer vs view](./observer-vs-view.md) 的区别
- 🌐 查看 [SSR 支持](./ssr.md)
- 📖 学习 [响应式状态](../observer/introduction.md) 的底层原理