# @rabjs/react

React 响应式状态库集成，基于 @rabjs/observer 实现。参考 mobx-react-lite 的设计，支持 React 并发模式和严格模式。

## 特性

- ✅ **响应式组件** - 使用 `observer` HOC 自动追踪 observable 变化
- ✅ **Hooks 支持** - `useObserver`、`useLocalObservable`、`useAsObservableSource`
- ✅ **并发模式** - 完全支持 React 18+ 的并发特性
- ✅ **严格模式** - 正确处理 StrictMode 的双重渲染
- ✅ **SSR 支持** - 通过 `enableStaticRendering` 支持服务端渲染
- ✅ **内存管理** - 使用 FinalizationRegistry 自动清理资源
- ✅ **TypeScript** - 完整的类型支持

## 安装

```bash
npm install @rabjs/react @rabjs/observer
# 或
pnpm add @rabjs/react @rabjs/observer
```

## 快速开始

### 使用 observer HOC

```tsx
import { observer } from '@rabjs/react';
import { useLocalObservable } from '@rabjs/react';

const Counter = observer(() => {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
  }));

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.increment()}>+1</button>
    </div>
  );
});
```

### 使用 useObserver Hook

```tsx
import { useObserver, observable } from '@rabjs/react';

const state = observable({ count: 0 });

function Counter() {
  const count = useObserver(() => state.count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => state.count++}>+1</button>
    </div>
  );
}
```

### 使用 Observer 组件

```tsx
import { Observer, useLocalObservable } from '@rabjs/react';

function App() {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
  }));

  return (
    <div>
      <Observer>{() => <p>Count: {state.count}</p>}</Observer>
      <button onClick={() => state.increment()}>+1</button>
    </div>
  );
}
```

## API 文档

### observer(Component)

将**函数组件**转换为响应式组件。

```tsx
const ObservedComponent = observer(MyComponent);
```

**特性：**

- 自动追踪 observable 变化
- 使用 React.memo 优化性能
- 支持 forwardRef
- 支持 displayName 继承
- ⚠️ **只支持函数组件**

### view(Component)

将**函数组件或类组件**转换为响应式组件。

```tsx
// 函数组件
const FuncComponent = view(() => <div>{store.count}</div>);

// 类组件
class ClassComponent extends React.Component {
  render() {
    return <div>{store.count}</div>;
  }
}
const ReactiveClassComponent = view(ClassComponent);
```

**特性：**

- ✅ 支持函数组件和类组件
- 自动追踪 observable 变化
- 完整支持类组件生命周期
- 组件卸载时自动清理 reaction
- 函数组件内部使用 observer 实现

**何时使用：**

- 需要支持类组件时使用 `view`
- 纯函数组件项目使用 `observer`
- 详细文档：[VIEW.md](./docs/VIEW.md)

### useObserver(render, componentName?)

在函数组件中追踪 observable 变化。

```tsx
const result = useObserver(() => {
  return <div>{state.count}</div>;
}, 'MyComponent');
```

**参数：**

- `render` - 返回 React 元素的函数
- `componentName` - 用于调试的组件名称（可选）

### useLocalObservable(initializer)

创建本地 observable 状态。

```tsx
const state = useLocalObservable(() => ({
  count: 0,
  increment() {
    this.count++;
  },
}));
```

### useAsObservableSource(props)

将 props 转换为 observable 对象。

```tsx
const observableProps = useAsObservableSource({ userId, userName });
```

### Observer

用于局部响应式渲染的组件。

```tsx
<Observer>{() => <div>{state.count}</div>}</Observer>
```

或使用 render prop：

```tsx
<Observer render={() => <div>{state.count}</div>} />
```

### enableStaticRendering(enable)

启用/禁用静态渲染模式（用于 SSR）。

```tsx
import { enableStaticRendering } from '@rabjs/react';

// 在服务端
enableStaticRendering(true);
```

## 并发模式支持

完全支持 React 18+ 的并发特性：

```tsx
import { Suspense } from 'react';
import { observer } from '@rabjs/react';

const App = observer(() => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MyComponent />
    </Suspense>
  );
});
```

## 严格模式支持

正确处理 React.StrictMode 的双重渲染：

```tsx
<React.StrictMode>
  <App />
</React.StrictMode>
```

## 最佳实践

1. **使用 observer 包装组件** - 确保组件能够追踪 observable 变化
2. **使用 useLocalObservable 创建状态** - 在组件内创建本地状态
3. **避免在 render 中创建 observable** - 在 useLocalObservable 中创建
4. **使用计算属性** - 使用 getter 创建派生状态
5. **避免过度细粒度** - 不要为每个属性创建单独的 observable

## 性能优化

- 使用 React.memo 自动应用（通过 observer）
- 使用 useSyncExternalStore 处理并发更新
- 自动清理未使用的 reactions
- 支持批量更新

## 与 mobx-react-lite 的区别

- 基于 @rabjs/observer 而不是 mobx
- 更轻量级的实现
- 完整的 TypeScript 支持
- 针对现代 React 优化

## 许可证

MIT
