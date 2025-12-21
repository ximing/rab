# observer 对比 view

了解 `observer` 和 `view` 两种 HOC 的区别，以及如何选择。

## 快速对比

| 特性         | observer    | view        |
| ------------ | ----------- | ----------- |
| 支持函数组件 | ✅ 推荐     | ❌ 不支持   |
| 支持类组件   | ✅ 支持     | ✅ 支持     |
| 性能         | ⚡ 更优     | 一般        |
| 并发模式     | ✅ 完全支持 | ⚠️ 有限支持 |
| 推荐度       | ⭐⭐⭐⭐⭐  | ⭐⭐        |

## observer - 推荐方式

`observer` 是 RSJS 推荐的 HOC，用于将函数组件转换为响应式组件。

### 工作原理

```typescript
// observer 的工作流程
1. 包装函数组件
2. 使用 useObserver Hook 追踪 observable 访问
3. 当 observable 变化时，自动重新渲染
4. 支持 React 并发模式和严格模式
```

### 基础用法

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

// ✅ 推荐 - 使用 observer 包装函数组件
const CounterContent = observer(() => {
  const service = useService(CounterService);

  return (
    <div>
      <p>Count: {service.count}</p>
      <button onClick={() => service.increment()}>+1</button>
    </div>
  );
});

export default bindServices(CounterContent, [CounterService]);
```

### 优势

#### 1. 完全支持函数组件

```typescript
// ✅ observer 完全支持函数组件
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});
```

#### 2. 支持 React Hooks

```typescript
// ✅ observer 支持在组件中使用 Hooks
const MyComponent = observer(() => {
  const service = useService(MyService);
  const [localState, setLocalState] = React.useState(0);

  React.useEffect(() => {
    // 可以在 effect 中访问 service
    console.log(service.data);
  }, [service.data]);

  return <div>{service.data}</div>;
});
```

#### 3. 更好的性能

```typescript
// observer 使用 useSyncExternalStore 实现
// 性能更优，内存占用更少
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});
```

#### 4. 完全支持并发模式

```typescript
// ✅ observer 完全兼容 React 18+ 并发特性
const MyComponent = observer(() => {
  const service = useService(MyService);
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div>{service.data}</div>
    </Suspense>
  );
});
```

#### 5. 支持 forwardRef

```typescript
// ✅ observer 支持 forwardRef
const MyComponent = observer(
  React.forwardRef((props, ref) => {
    const service = useService(MyService);
    return <div ref={ref}>{service.data}</div>;
  })
);
```

#### 6. 调试支持

```typescript
// ✅ observer 支持通过 options 传递 debugger 进行调试
import { observer, useService, bindServices, debuggerReaction } from '@rabjs/react';

const DebugComponent = observer(
  () => {
    const service = useService(MyService);
    return <div>{service.data}</div>;
  },
  {
    debugger: debuggerReaction, // 追踪所有 observable 操作
  }
);

export default bindServices(DebugComponent, [MyService]);
```

## view - 兼容方式

`view` 是一个兼容性 HOC，主要用于支持类组件。

### 工作原理

```typescript
// view 的工作流程
1. 检测组件类型（函数组件或类组件）
2. 对于函数组件：直接使用 observer
3. 对于类组件：
   - 创建响应式包装类
   - 重写 render 方法
   - 使用 observe + setState 实现响应式
```

### 基础用法

```typescript
import { view } from '@rabjs/react';

// 类组件
class MyComponent extends React.Component {
  render() {
    return <div>{this.props.data}</div>;
  }
}

// 使用 view 包装
export default view(MyComponent);
```

### 限制

#### 1. 函数组件会被转换为 observer

```typescript
// ❌ 不推荐 - view 对函数组件没有额外优势
const MyComponent = view(() => {
  return <div>Hello</div>;
});

// ✅ 推荐 - 直接使用 observer
const MyComponent = observer(() => {
  return <div>Hello</div>;
});
```

#### 2. 类组件支持有限

```typescript
// ⚠️ view 对类组件的支持有限
class MyComponent extends React.Component {
  // 某些生命周期方法可能不完全支持
  componentDidMount() {
    // ...
  }

  render() {
    return <div>{this.props.data}</div>;
  }
}

export default view(MyComponent);
```

#### 3. 性能不如 observer

```typescript
// view 使用 observe + setState 实现
// 性能不如 observer 的 useSyncExternalStore
class MyComponent extends React.Component {
  render() {
    return <div>{this.props.data}</div>;
  }
}

export default view(MyComponent); // 性能一般
```

## 使用场景

### 使用 observer 的场景

```typescript
// ✅ 函数组件 - 优先使用 observer
const UserList = observer(() => {
  const userService = useService(UserService);
  return (
    <ul>
      {userService.users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
});

export default bindServices(UserList, [UserService]);
```

```typescript
// ✅ 需要使用 Hooks - 必须使用 observer
const SearchBox = observer(() => {
  const searchService = useService(SearchService);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    searchService.search(query);
  }, [query]);

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
});

export default bindServices(SearchBox, [SearchService]);
```

```typescript
// ✅ 需要 forwardRef - 使用 observer
const Input = observer(
  React.forwardRef((props, ref) => {
    const inputService = useService(InputService);
    return <input ref={ref} value={inputService.value} />;
  })
);

export default bindServices(Input, [InputService]);
```

### 使用 view 的场景

```typescript
// ⚠️ 只有在维护旧的类组件时才使用 view
class LegacyComponent extends React.Component {
  render() {
    // 旧的类组件代码
    return <div>Legacy</div>;
  }
}

export default view(LegacyComponent);
```

## 完整对比示例

### 使用 observer（推荐）

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

export class TodoService extends Service {
  todos: any[] = [];

  addTodo(title: string) {
    this.todos.push({ id: Date.now(), title, done: false });
  }
}

// ✅ 推荐方式
const TodoListContent = observer(() => {
  const todoService = useService(TodoService);
  const [input, setInput] = React.useState('');

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button
        onClick={() => {
          todoService.addTodo(input);
          setInput('');
        }}
      >
        Add
      </button>
      <ul>
        {todoService.todos.map(todo => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(TodoListContent, [TodoService]);
```

### 使用 view（不推荐）

```typescript
import { view } from '@rabjs/react';

// ❌ 不推荐 - 使用 view 包装函数组件
const TodoList = view(() => {
  // 无法使用 Hooks
  // 无法使用 useService
  // 性能不如 observer
  return <div>Todo List</div>;
});
```

## 最佳实践

### 1. 优先使用 observer

```typescript
// ✅ 推荐
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});

// ❌ 避免
const MyComponent = view(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});
```

### 2. 函数组件 + observer + bindServices

```typescript
// ✅ 标准模式
const ComponentContent = observer(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});

export default bindServices(ComponentContent, [MyService]);
```

### 3. 避免混合使用

```typescript
// ❌ 不要混合使用 observer 和 view
const Component1 = observer(() => <div>1</div>);
const Component2 = view(() => <div>2</div>);

// ✅ 统一使用 observer
const Component1 = observer(() => <div>1</div>);
const Component2 = observer(() => <div>2</div>);
```

### 4. 类组件迁移指南

```typescript
// 旧的类组件
class OldComponent extends React.Component {
  render() {
    return <div>Old</div>;
  }
}

// 迁移步骤 1：使用 view 包装（临时方案）
export default view(OldComponent);

// 迁移步骤 2：改写为函数组件
const NewComponent = observer(() => {
  return <div>New</div>;
});

export default NewComponent;
```

## 性能对比

### observer 性能

```typescript
// observer 使用 useSyncExternalStore
// - 更少的重新渲染
// - 更好的内存管理
// - 支持并发模式
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});
```

### view 性能

```typescript
// view 使用 observe + setState
// - 可能有额外的重新渲染
// - 内存占用较多
// - 并发模式支持有限
class MyComponent extends React.Component {
  render() {
    return <div>Data</div>;
  }
}

export default view(MyComponent);
```

## 总结

| 场景       | 推荐                    | 原因                 |
| ---------- | ----------------------- | -------------------- |
| 新项目     | observer                | 性能更优，功能更完整 |
| 函数组件   | observer                | 完全支持，无限制     |
| 需要 Hooks | observer                | 必须使用             |
| 类组件     | observer（改写）或 view | 优先改写为函数组件   |
| 旧项目维护 | view                    | 兼容性考虑           |

## 下一步

- 🔧 了解 [深入 Service](./service-deep-dive.md)
- 🏗️ 了解 [Service 领域](./service-domain.md) 的架构设计
- 🌐 查看 [SSR 支持](./ssr.md)
- 📖 学习 [其他 Hooks](./hooks.md)