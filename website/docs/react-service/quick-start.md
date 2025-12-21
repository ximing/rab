# 快速上手

5 分钟快速了解如何在 React 中使用 RSJS。

## 安装

```bash
npm install @rabjs/react
```

> 💡 `@rabjs/observer` 和 `@rabjs/service` 已经包含在 `@rabjs/react` 中，可以直接从 react 包导入。

## 最简单的例子

### 1. 创建一个计数器 Service

```typescript
// counterService.ts
import { Service } from '@rabjs/react';

export class CounterService extends Service {
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}
```

### 2. 在 React 组件中使用

```typescript
// Counter.tsx
import { observer, useService, bindServices } from '@rabjs/react';
import { CounterService } from './counterService';

// 使用 observer 包装组件
const CounterContent = observer(() => {
  // 使用 useService 获取服务实例
  const service = useService(CounterService);

  return (
    <div>
      <p>Count: {service.count}</p>
      <button onClick={() => service.increment()}>+1</button>
      <button onClick={() => service.decrement()}>-1</button>
    </div>
  );
});

// 使用 bindServices 导出组件，注册所需的 Service
export default bindServices(CounterContent, [CounterService]);
```

## 异步操作

Service 支持异步方法，并自动管理 loading 和 error 状态：

```typescript
import { Service } from '@rabjs/react';

export class UserService extends Service {
  user: any = null;

  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    this.user = await response.json();
  }
}

// 在组件中使用
import { observer, useService, bindServices } from '@rabjs/react';

const UserProfileContent = observer(({ userId }: { userId: string }) => {
  const service = useService(UserService);

  return (
    <div>
      {service.$model.fetchUser.loading && <p>加载中...</p>}
      {service.$model.fetchUser.error && <p>错误: {service.$model.fetchUser.error.message}</p>}
      {service.user && <p>用户: {service.user.name}</p>}
      <button onClick={() => service.fetchUser(userId)}>加载用户</button>
    </div>
  );
});

export default bindServices(UserProfileContent, [UserService]);
```

## 严格模式

在严格模式下，`useService` 必须在 `bindServices` 或 `RSStrict` 内调用，否则会抛出错误。这有助于及早发现配置错误。

### 使用 RSStrict 包裹应用

```typescript
// App.tsx
import { RSStrict } from '@rabjs/react';
import Counter from './Counter';

export default function App() {
  return (
    <RSStrict>
      <div className="app">
        <h1>我的应用</h1>
        <Counter />
      </div>
    </RSStrict>
  );
}
```

### 在严格模式下使用 Service

在 `RSStrict` 内部，你必须使用 `bindServices` 包裹组件来注册 Service：

```typescript
// Counter.tsx
import { observer, useService, bindServices } from '@rabjs/react';
import { CounterService } from './counterService';

const CounterContent = observer(() => {
  // 在 RSStrict 内使用 useService 获取服务
  const service = useService(CounterService);

  return (
    <div>
      <p>Count: {service.count}</p>
      <button onClick={() => service.increment()}>+1</button>
      <button onClick={() => service.decrement()}>-1</button>
    </div>
  );
});

// 必须使用 bindServices 包裹组件，注册所需的 Service
export default bindServices(CounterContent, [CounterService]);
```

> 💡 **提示**: 严格模式会强制要求 `useService` 必须在 `bindServices` 或 `RSStrict` 内调用，这有助于及早发现配置错误。在严格模式下，如果在没有正确注册 Service 的地方使用 `useService`，会抛出错误。

## 下一步

- 📖 阅读 [基础用法](./basic-usage.md) 了解更多概念
- 🔧 查看 [深入 Service](./service-deep-dive.md) 学习高级特性
- 🏗️ 了解 [Service 领域](./service-domain.md) 的架构设计
- 🔍 了解 [observer vs view](./observer-vs-view.md) 的区别
- 🪝 了解 [其他 Hooks](./hooks.md)

## 常见问题

### Q: 为什么需要 `observer` HOC？

A: `observer` 用于包装组件，使其能够追踪组件中访问的 observable 属性，当这些属性变化时自动重新渲染组件。注意 observer 只支持函数组件，如果支持类组件可以使用`view`，详见 [observer vs view](./observer-vs-view.md)。

### Q: 为什么需要 `bindServices`？

A: `bindServices` 用于注册组件所需的 Service，它会创建一个依赖注入容器，并通过 Context 提供给组件及其子组件。详见 [深入 Service](./service-deep-dive.md) 。

### Q: `useService` 和 `useLocalObservable` 有什么区别？

A: `useService` 用于获取通过 `bindServices` 注册的 Service 实例，这些实例在整个组件树中是共享的。而 `useLocalObservable` 创建的是本地 observable 对象，仅在当前组件中使用。

### Q: 需要手动订阅和取消订阅吗？

A: 不需要！RSJS 会自动管理订阅和清理，`observer` 会自动追踪组件中访问的 observable 属性。
