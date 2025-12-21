---
sidebar_position: 3
---

# @rabjs/react API

React 响应式状态库集成 API 文档。

## 核心组件

### `observer(Component)`

高阶组件（HOC）。将 React 组件转换为响应式组件，自动追踪响应式数据变更。

**参数：**

- `Component: React.FunctionComponent<P> | React.ForwardRefExoticComponent<P>` - React 组件

**返回值：**

- `React.MemoExoticComponent<React.ForwardRefExoticComponent<P>>` - 包装后的响应式组件

**特性：**

- 自动依赖追踪
- 支持 React 并发模式
- 支持严格模式
- 支持 Fast Refresh
- 自动应用 `React.memo` 和 `forwardRef`
- 支持 ref 转发

**示例：**

```typescript
import React from 'react';
import { observer, observable } from '@rabjs/react';

const state = observable({ count: 0 });

const Counter = observer(() => {
  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.count++}>Increment</button>
    </div>
  );
});

export default Counter;
```

---

### `view(Component)`

通用组件包装器。支持函数组件和类组件，将其转换为响应式组件。

**参数：**

- `Component: React.ComponentType<P>` - React 组件（函数组件或类组件）

**返回值：**

- `React.ComponentType<P>` - 包装后的响应式组件

**特性：**

- 支持函数组件和类组件
- 函数组件使用 `observer` 实现
- 类组件使用 `observe` + `forceUpdate` 实现
- 自动追踪 observable 变化

**示例：**

```typescript
import React from 'react';
import { view, observable } from '@rabjs/react';

const state = observable({ name: 'Alice' });

// 函数组件
const UserProfile = view(() => {
  return (
    <div>
      <h1>{state.name}</h1>
      <input value={state.name} onChange={e => (state.name = e.target.value)} />
    </div>
  );
});

// 类组件
class UserCard extends React.Component {
  render() {
    return <div>{state.name}</div>;
  }
}

const ReactiveUserCard = view(UserCard);

export default UserProfile;
```

---

## Hooks

### `useObserver(fn, baseComponentName?)`

在组件中使用观察者。返回观察者的执行结果。

**参数：**

- `fn: () => T` - 观察者函数
- `baseComponentName?: string` - 组件名称（可选，用于调试）

**返回值：**

- `T` - 函数的返回值

**特性：**

- 使用 `useSyncExternalStore` 实现
- 支持 React 并发模式
- 支持严格模式
- 自动追踪 observable 访问

**示例：**

```typescript
import React from 'react';
import { useObserver, observable } from '@rabjs/react';

const state = observable({ count: 0 });

function Counter() {
  const count = useObserver(() => state.count, 'Counter');

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => state.count++}>Increment</button>
    </div>
  );
}
```

---

### `useLocalObservable(initializer)`

创建本地响应式状态。

**参数：**

- `initializer: () => T` - 初始化函数，返回初始状态对象

**返回值：**

- `T` - 响应式对象

**特性：**

- 在组件生命周期内保持不变
- 支持方法和计算属性
- 自动转换为 observable

**示例：**

```typescript
import React from 'react';
import { useLocalObservable, observer } from '@rabjs/react';

const Counter = observer(() => {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
    decrement() {
      this.count--;
    },
  }));

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.increment()}>+</button>
      <button onClick={() => state.decrement()}>-</button>
    </div>
  );
});

export default Counter;
```

---

### `useAsObservableSource(source)`

将 React props 或 state 转换为响应式源。

**参数：**

- `source: T` - 源对象

**返回值：**

- `T` - 响应式源对象

**特性：**

- 每次渲染时更新 observable 对象的属性
- 保持对象引用不变
- 支持在 computed 中使用

**示例：**

```typescript
import React from 'react';
import { useAsObservableSource, observer } from '@rabjs/react';

interface UserProps {
  name: string;
  age: number;
}

const UserCard = observer(({ name, age }: UserProps) => {
  const props = useAsObservableSource({ name, age });

  return (
    <div>
      <p>Name: {props.name}</p>
      <p>Age: {props.age}</p>
    </div>
  );
});

export default UserCard;
```

---

## 静态渲染（SSR）

### `enableStaticRendering(enabled)`

启用或禁用静态渲染模式。用于服务端渲染。

**参数：**

- `enabled: boolean` - 是否启用

**示例：**

```typescript
import { enableStaticRendering } from '@rabjs/react';

// 在服务端
if (typeof window === 'undefined') {
  enableStaticRendering(true);
}
```

---

### `isUsingStaticRendering()`

检查是否正在使用静态渲染模式。

**返回值：**

- `boolean` - 如果启用了静态渲染返回 true

**示例：**

```typescript
import { isUsingStaticRendering } from '@rabjs/react';

if (isUsingStaticRendering()) {
  console.log('Running on server');
}
```

---

## 依赖注入系统

### `DomainContext`

React Context，用于提供服务容器。

**类型：**

```typescript
const DomainContext: React.Context<DomainContextValue>;

interface DomainContextValue {
  container: Container;
}
```

**示例：**

```typescript
import React from 'react';
import { DomainContext, Container } from '@rabjs/react';

const container = new Container();

function App() {
  return (
    <DomainContext.Provider value={{ container }}>
      <YourComponent />
    </DomainContext.Provider>
  );
}
```

---

### `useService(identifier, scope?)`

在组件中获取服务实例。

**参数：**

- `identifier: ServiceIdentifier<T>` - 服务标识符（类、字符串或 Symbol）
- `scope?: ServiceScope` - 服务作用域（可选，Singleton 或 Transient）

**返回值：**

- `T` - 服务实例

**特性：**

- 支持多种标识符类型
- 支持 Singleton 和 Transient 作用域
- Transient 实例缓存在组件 ref 中
- 按作用域链向上查找服务

**重载：**

```typescript
// 重载1: 传入类构造函数
useService<T extends Service>(identifier: new (...args: any[]) => T): T;

// 重载2: 传入字符串或 Symbol
useService<T extends Service = Service>(identifier: string | symbol): T;

// 重载3: 传入类构造函数和 scope
useService<T extends Service>(
  identifier: new (...args: any[]) => T,
  scope: ServiceScope
): T;

// 重载4: 传入字符串或 Symbol 和 scope
useService<T extends Service = Service>(
  identifier: string | symbol,
  scope: ServiceScope
): T;
```

**示例：**

```typescript
import React from 'react';
import { useService, observer } from '@rabjs/react';

class UserService {
  users = [];

  getUsers() {
    return this.users;
  }
}

const UserList = observer(() => {
  const userService = useService(UserService);

  return (
    <ul>
      {userService.getUsers().map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
});

export default UserList;
```

---

### `useContainer()`

获取当前的服务容器。

**返回值：**

- `Container` - 服务容器

**特性：**

- 用于高级场景
- 支持手动注册服务
- 访问容器信息

**示例：**

```typescript
import React from 'react';
import { useContainer } from '@rabjs/react';

function Component() {
  const container = useContainer();

  const service = container.resolve('MyService');

  return <div>{/* ... */}</div>;
}
```

---

### `useObserverService(identifier, selector, scope?)`

获取服务实例并自动追踪其 observable 属性的变化。

**参数：**

- `identifier: ServiceIdentifier<T>` - 服务标识符
- `selector: (service: T) => S` - 选择器函数，用于选择要追踪的属性
- `scope?: ServiceScope` - 服务作用域（可选）

**返回值：**

- `[S, T]` - 元组，包含选择的状态和完整的服务实例

**特性：**

- 结合 `useService` 和 `useObserver` 的功能
- 自动追踪选择器返回的值
- 当被追踪的属性变化时自动重新渲染

**重载：**

```typescript
// 重载1: 传入类构造函数
useObserverService<T extends Service, S = any>(
  identifier: new (...args: any[]) => T,
  selector: (service: T) => S
): [S, T];

// 重载2: 传入字符串或 Symbol
useObserverService<T extends Service = Service, S = any>(
  identifier: string | symbol,
  selector: (service: T) => S
): [S, T];

// 重载3: 传入类构造函数和 scope
useObserverService<T extends Service, S = any>(
  identifier: new (...args: any[]) => T,
  selector: (service: T) => S,
  scope: ServiceScope
): [S, T];

// 重载4: 传入字符串或 Symbol 和 scope
useObserverService<T extends Service = Service, S = any>(
  identifier: string | symbol,
  selector: (service: T) => S,
  scope: ServiceScope
): [S, T];
```

**示例：**

```typescript
import React from 'react';
import { useObserverService } from '@rabjs/react';

class CounterService {
  count = 0;

  increment() {
    this.count++;
  }
}

function Counter() {
  const [count, counterService] = useObserverService(CounterService, svc => svc.count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => counterService.increment()}>Increment</button>
    </div>
  );
}

export default Counter;
```

---

### `useViewService(identifier, selector, scope?)`

获取服务实例并使用 view 包装。

**参数：**

- `identifier: ServiceIdentifier<T>` - 服务标识符
- `selector: (service: T) => S` - 选择器函数
- `scope?: ServiceScope` - 服务作用域（可选）

**返回值：**

- `[S, T]` - 元组，包含选择的状态和完整的服务实例

**特性：**

- `useObserverService` 的别名
- 提供更简洁的命名

**示例：**

```typescript
import React from 'react';
import { useViewService } from '@rabjs/react';

class UserService {
  user = null;

  async loadUser(id: string) {
    this.user = await fetch(`/api/users/${id}`).then(r => r.json());
  }
}

function UserProfile() {
  const [user, userService] = useViewService(UserService, svc => svc.user);

  React.useEffect(() => {
    userService.loadUser('1');
  }, [userService]);

  return <div>{user && <h1>{user.name}</h1>}</div>;
}

export default UserProfile;
```

---

### `useContainerEvents()`

获取容器事件系统。

**返回值：**

- `EventSystem` - 事件系统实例

**特性：**

- 用于监听容器事件
- 支持服务生命周期事件

**示例：**

```typescript
import React from 'react';
import { useContainerEvents } from '@rabjs/react';

function Component() {
  const events = useContainerEvents();

  React.useEffect(() => {
    const unsubscribe = events.on('service:registered', event => {
      console.log('Service registered:', event);
    });

    return unsubscribe;
  }, [events]);

  return <div>{/* ... */}</div>;
}
```

---

### `bindServices(Component, servicesList)`

绑定多个服务到组件。

**参数：**

- `Component: React.ComponentType<P>` - React 组件
- `servicesList: ServiceDefinition[]` - 服务定义数组

**返回值：**

- `React.ComponentType<P>` - 包装后的组件

**特性：**

- 自动创建服务容器
- 自动注册服务
- 支持多种服务定义格式
- 自动处理组件包装

**服务定义格式：**

```typescript
type ServiceDefinition =
  | ServiceClass // 直接传入类
  | [ServiceIdentifier, ServiceClass | ServiceFactory | RegisterOptions] // 标识符 + 实现
  | [ServiceIdentifier, ServiceClass | ServiceFactory, RegisterOptions]; // 标识符 + 实现 + 选项
```

**示例：**

```typescript
import React from 'react';
import { bindServices, useService, observer } from '@rabjs/react';

class UserService {
  users = [];
}

class TodoService {
  todos = [];
}

const MyComponent = observer(() => {
  const userService = useService(UserService);
  const todoService = useService(TodoService);

  return (
    <div>
      <p>Users: {userService.users.length}</p>
      <p>Todos: {todoService.todos.length}</p>
    </div>
  );
});

// 绑定服务
export default bindServices(MyComponent, [UserService, TodoService]);
```

---

## 工具函数

### `observerFinalizationRegistry`

用于管理观察者的生命周期。

**特性：**

- 自动清理观察者
- 防止内存泄漏
- 支持 React 并发模式

**示例：**

```typescript
import { observerFinalizationRegistry } from '@rabjs/react';

// 自动清理观察者
```

---

### `printDebugValue(value)`

打印调试信息。

**参数：**

- `value: any` - 要打印的值

**示例：**

```typescript
import { printDebugValue } from '@rabjs/react';

printDebugValue(state);
```

---

## 重新导出的 API

### 来自 `@rabjs/observer`

```typescript
// Observable API
export { observable, shadowObservable } from '@rabjs/observer';

// Observer API
export { observe, unobserve } from '@rabjs/observer';
export type { ObserveOptions } from '@rabjs/observer';

// Configuration API
export { configure, resetGlobalConfig } from '@rabjs/observer';
export type { ConfigureOptions } from '@rabjs/observer';

// Types
export type { Reaction, ReactionScheduler, Operation, OperationType } from '@rabjs/observer';

// Utility functions
export { isObservable, raw } from '@rabjs/observer';

// Handlers for testing
export { proxyHandlers, shadowProxyHandler } from '@rabjs/observer';
```

---

### 来自 `@rabjs/service`

```typescript
// Service 类和类型
export { Service } from '@rabjs/service';
export type { MethodState, ExtractMethods } from '@rabjs/service';

// 装饰器
export { Action, SyncAction, Inject, Debounce, Throttle, Memo, On, Once } from '@rabjs/service';

// IOC 容器
export { Container, getGlobalContainer, register, resolve, has } from '@rabjs/service';
export type {
  ServiceIdentifier,
  ServiceClass,
  ServiceFactory,
  RegisterOptions,
  ContainerOptions,
} from '@rabjs/service';

// 事件系统
export { EventSystem } from '@rabjs/service';
export type { EventScope, EventSystemOptions } from '@rabjs/service';
```

---

## 类型定义

### `ServiceIdentifier<T>`

服务标识符类型。

```typescript
type ServiceIdentifier<T = any> = string | symbol | (new (...args: any[]) => T);
```

### `ServiceFactory<T>`

服务工厂函数类型。

```typescript
type ServiceFactory<T = any> = (container: Container) => T;
```

### `ServiceClass<T>`

服务类类型。

```typescript
type ServiceClass<T = any> = new (...args: any[]) => T;
```

### `ServiceDefinition<T>`

服务定义类型。

```typescript
type ServiceDefinition<T = any> =
  | ServiceClass<T>
  | {
      identifier: ServiceIdentifier<T>;
      factory: ServiceFactory<T> | ServiceClass<T> | T;
    };
```

### `ProviderOptions`

提供者选项类型。

```typescript
interface ProviderOptions {
  // 容器名称（用于调试）
  name?: string;

  // 是否启用严格模式
  strict?: boolean;
}
```

### `ProviderResult<P>`

提供者结果类型。

```typescript
interface ProviderResult<P = any> {
  // Provider 组件
  Provider: React.ComponentType<{ children: React.ReactNode }>;

  // 原始组件
  Component: React.ComponentType<P>;

  // 获取容器（仅用于测试）
  getContainer?: () => Container;
}
```

### `DomainComponent<P>`

Domain 组件类型。

```typescript
type DomainComponent<P = any> = React.ComponentType<P>;
```

### `DomainContextValue`

Domain Context 值类型。

```typescript
interface DomainContextValue {
  // 当前容器
  container: Container;
}
```

---

## 使用示例

### 完整应用示例

```typescript
import React from 'react';
import {
  observer,
  observable,
  useLocalObservable,
  useService,
  bindServices,
  Action,
} from '@rabjs/react';

// 定义服务
class TodoService {
  todos: Array<{ id: number; title: string; completed: boolean }> = [];

  @Action
  addTodo(title: string) {
    this.todos.push({
      id: Date.now(),
      title,
      completed: false,
    });
  }

  @Action
  toggleTodo(id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }
}

// 定义组件
const TodoList = observer(() => {
  const todoService = useService(TodoService);

  return (
    <ul>
      {todoService.todos.map(todo => (
        <li
          key={todo.id}
          onClick={() => todoService.toggleTodo(todo.id)}
          style={{
            textDecoration: todo.completed ? 'line-through' : 'none',
          }}
        >
          {todo.title}
        </li>
      ))}
    </ul>
  );
});

const TodoInput = observer(() => {
  const todoService = useService(TodoService);
  const [input, setInput] = React.useState('');

  const handleAdd = () => {
    if (input.trim()) {
      todoService.addTodo(input);
      setInput('');
    }
  };

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} placeholder="Add a todo..." />
      <button onClick={handleAdd}>Add</button>
    </div>
  );
});

// 应用入口
const App = observer(() => {
  return (
    <div>
      <h1>Todo App</h1>
      <TodoInput />
      <TodoList />
    </div>
  );
});

// 绑定服务并导出
export default bindServices(App, [TodoService]);
```

---

## 最佳实践

1. **使用 `observer` 包装组件**：确保组件响应数据变更

2. **使用 `useLocalObservable` 管理本地状态**：避免过度使用 useState

3. **合理使用依赖注入**：提高代码可测试性

4. **及时清理服务**：避免内存泄漏

5. **使用 TypeScript**：获得更好的类型安全

6. **避免在渲染期间创建新对象**：可能导致无限循环

7. **使用 `useObserverService` 而不是 `useService` + `observer`**：更简洁高效

8. **合理选择服务作用域**：
   - Singleton：全局共享状态
   - Transient：组件级别状态

---

## 常见问题

**Q: `observer` 和 `view` 有什么区别？**

A: `observer` 是 HOC，只支持函数组件；`view` 支持函数组件和类组件。

**Q: 如何处理异步操作？**

A: 使用 `@Action` 装饰器或在 useEffect 中处理。

**Q: 支持 TypeScript 吗？**

A: 完全支持，提供完整的类型定义。

**Q: 如何调试？**

A: 使用 `printDebugValue()` 或浏览器开发者工具。

**Q: 性能如何？**

A: 自动依赖追踪，只在必要时重新渲染，性能优异。

**Q: `useObserverService` 和 `useViewService` 有什么区别？**

A: 功能相同，`useViewService` 是 `useObserverService` 的别名。

**Q: 如何在服务器端渲染中使用？**

A: 在服务端调用 `enableStaticRendering(true)` 禁用响应式追踪。
