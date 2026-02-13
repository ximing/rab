# @domain - React 依赖注入系统

基于 React Provider 的依赖注入系统，支持服务容器、生命周期管理和作用域隔离。

## 核心特性

- ✅ **Provider 包装组件** - 为子组件提供服务容器
- ✅ **useService Hook** - 按作用域链查找服务实例
- ✅ **生命周期绑定** - 服务实例与 Provider 生命周期一致
- ✅ **作用域隔离** - 同一作用域链下每个服务只能在一个地方注册
- ✅ **嵌套 Provider** - 支持多层 Provider 嵌套
- ✅ **严格模式** - 可选的重复注册检测
- ✅ **TypeScript 支持** - 完整的类型定义

## 快速开始

### 1. 定义服务

```typescript
import { Service } from '@rabjs/service';
import { observable } from '@rabjs/observer';

class MainPageService extends Service {
  @observable
  count = 0;

  increment() {
    this.count++;
  }

  getCount(): number {
    return this.count;
  }
}
```

### 2. 创建 Domain 组件

```typescript
import { createDomain, useService } from '@rabjs/react';

const MainPageComponent = () => {
  const mainPageService = useService(MainPageService);

  return (
    <div>
      <p>Count: {mainPageService.getCount()}</p>
      <button onClick={() => mainPageService.increment()}>Increment</button>
    </div>
  );
};

const { Provider, Component } = createDomain(MainPageComponent, [
  { identifier: MainPageService, factory: MainPageService },
]);
```

### 3. 使用 Provider 包装组件

```typescript
// 方式 1: 使用 createDomain 返回的 Provider
<Provider>
  <Component />
</Provider>;

// 方式 2: 使用 Provider HOC
const MainPageWithProvider = Provider(MainPageComponent, [
  { identifier: MainPageService, factory: MainPageService },
]);

<MainPageWithProvider />;
```

## API 文档

### createDomain

创建一个 Domain，包含自己的容器实例和服务注册。

```typescript
function createDomain<P = any>(
  Component: DomainComponent<P>,
  services: ServiceDefinition[] = [],
  options: ProviderOptions = {}
): ProviderResult<P>;
```

**参数:**

- `Component` - 原始 React 组件
- `services` - 服务定义数组
- `options` - 配置选项
  - `name` - 容器名称（用于调试）
  - `strict` - 是否启用严格模式（默认 true）

**返回值:**

- `Provider` - Provider 组件
- `Component` - 包装后的组件
- `getContainer` - 获取容器实例（仅用于测试）

**示例:**

```typescript
const { Provider, Component } = createDomain(
  MainPageComponent,
  [{ identifier: MainPageService, factory: MainPageService }],
  { name: 'MainPage', strict: true }
);
```

### useService

在 React 组件中获取服务实例。

```typescript
function useService<T = any>(identifier: ServiceIdentifier<T>): T;
```

**参数:**

- `identifier` - 服务标识符（类、字符串或 Symbol）

**返回值:**

- 服务实例

**异常:**

- 如果没有找到服务或不在 Provider 内部，抛出异常

**示例:**

```typescript
const MainPageComponent = () => {
  const mainPageService = useService(MainPageService);
  return <div>{mainPageService.getCount()}</div>;
};
```

### useContainer

获取当前 Provider 的容器实例。

```typescript
function useContainer(): Container;
```

**返回值:**

- 当前容器实例

**异常:**

- 如果不在 Provider 内部，抛出异常

**示例:**

```typescript
const container = useContainer();
const stats = container.getStats();
console.log(stats.name, stats.serviceCount);
```

### useContainerEvents

获取当前容器的事件发射器，用于监听和发送容器级别的事件。

```typescript
function useContainerEvents(): EventEmitter;
```

**返回值:**

- 容器的事件发射器实例（eventemitter3）

**异常:**

- 如果不在 Provider 内部，抛出异常

**示例:**

```typescript
import { useContainerEvents } from '@rabjs/react';
import { useEffect } from 'react';

function UserList() {
  const events = useContainerEvents();

  useEffect(() => {
    // 监听事件
    const onUserAdded = (user: User) => {
      console.log('User added:', user);
      // 更新 UI 或执行其他操作
    };

    events.on('user:added', onUserAdded);

    // 清理监听器
    return () => {
      events.off('user:added', onUserAdded);
    };
  }, [events]);

  const addUser = () => {
    // 发送事件
    events.emit('user:added', { id: 1, name: 'John' });
  };

  return <button onClick={addUser}>Add User</button>;
}
```

**使用场景:**

- 组件间通信：在同一容器内的不同组件之间传递消息
- 事件驱动：基于事件的松耦合架构
- 状态同步：多个组件监听同一事件并同步更新
- 生命周期事件：监听容器或服务的生命周期事件

### Provider HOC

简化 API，直接导出 Provider 组件。

```typescript
function Provider<P = any>(
  Component: DomainComponent<P>,
  services: ServiceDefinition[] = [],
  options: ProviderOptions = {}
): ComponentType<{ children: ReactNode }>;
```

**示例:**

```typescript
export default Provider(MainPageComponent, [
  { identifier: MainPageService, factory: MainPageService },
]);
```

### createNestedDomain

创建嵌套 Domain，用于在已有 Provider 的组件中创建新的 Domain。

```typescript
function createNestedDomain<P = any>(
  Component: DomainComponent<P>,
  services: ServiceDefinition[] = [],
  options: ProviderOptions = {}
): ProviderResult<P>;
```

**示例:**

```typescript
const { Provider: SubPageProvider } = createNestedDomain(SubPageComponent, [
  { identifier: SubPageService, factory: SubPageService },
]);

const MainPageComponent = () => {
  return (
    <SubPageProvider>
      <SubPageComponent />
    </SubPageProvider>
  );
};
```

## 服务定义

### 使用类

```typescript
class MyService extends Service {
  getValue(): string {
    return 'value';
  }
}

const { Provider } = createDomain(Component, [{ identifier: MyService, factory: MyService }]);
```

### 使用工厂函数

```typescript
const { Provider } = createDomain(Component, [
  {
    identifier: 'myService',
    factory: container => ({
      getValue: () => 'value',
    }),
  },
]);
```

### 使用实例

```typescript
const instance = { getValue: () => 'value' };

const { Provider } = createDomain(Component, [
  {
    identifier: 'myService',
    factory: instance,
  },
]);
```

## 作用域链

服务按照 Provider 作用域链向上查找。

```typescript
// 父 Domain
const { Provider: ParentProvider } = createDomain(ParentComponent, [
  { identifier: Service1, factory: Service1 },
]);

// 子 Domain
const { Provider: ChildProvider } = createDomain(ChildComponent, [
  { identifier: Service2, factory: Service2 },
]);

// 在子组件中可以访问 Service1 和 Service2
const ChildComponent = () => {
  const service1 = useService(Service1); // 从父 Domain 查找
  const service2 = useService(Service2); // 从子 Domain 查找
  return <div />;
};

// 使用
<ParentProvider>
  <ChildProvider>
    <ChildComponent />
  </ChildProvider>
</ParentProvider>;
```

## 生命周期管理

服务实例与 Provider 的生命周期一致。

```typescript
const { Provider } = createDomain(Component, [{ identifier: MyService, factory: MyService }]);

// 当 Provider 挂载时，创建容器和服务实例
// 当 Provider 卸载时，销毁容器和服务实例
```

## 严格模式

严格模式会检测同一作用域链中的重复注册。

```typescript
// 启用严格模式（默认）
const { Provider } = createDomain(
  Component,
  [
    { identifier: Service1, factory: Service1 },
    { identifier: Service1, factory: Service1 }, // 抛出异常
  ],
  { strict: true }
);

// 禁用严格模式
const { Provider } = createDomain(
  Component,
  [
    { identifier: Service1, factory: Service1 },
    { identifier: Service1, factory: Service1 }, // 允许
  ],
  { strict: false }
);
```

## 完整示例

```typescript
import React from 'react';
import { Service } from '@rabjs/service';
import { observable } from '@rabjs/observer';
import { createDomain, useService } from '@rabjs/react';

// 1. 定义服务
class CounterService extends Service {
  @observable
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}

// 2. 创建组件
const Counter = () => {
  const counterService = useService(CounterService);

  return (
    <div>
      <p>Count: {counterService.count}</p>
      <button onClick={() => counterService.increment()}>+</button>
      <button onClick={() => counterService.decrement()}>-</button>
    </div>
  );
};

// 3. 创建 Domain
const { Provider, Component } = createDomain(Counter, [
  { identifier: CounterService, factory: CounterService },
]);

// 4. 使用
export const App = () => (
  <Provider>
    <Component />
  </Provider>
);
```

## 常见问题

### Q: 如何在多个组件中共享服务？

A: 将服务注册在共同的父 Provider 中，子组件通过 `useService` 访问。

```typescript
const { Provider: ParentProvider } = createDomain(ParentComponent, [
  { identifier: SharedService, factory: SharedService },
]);

const Child1 = () => {
  const service = useService(SharedService);
  return <div />;
};

const Child2 = () => {
  const service = useService(SharedService);
  return <div />;
};
```

### Q: 如何处理服务之间的依赖？

A: 使用工厂函数，通过容器参数解析依赖。

```typescript
const { Provider } = createDomain(Component, [
  { identifier: Service1, factory: Service1 },
  {
    identifier: Service2,
    factory: container => {
      const service1 = container.resolve(Service1);
      return new Service2(service1);
    },
  },
]);
```

### Q: 如何测试使用 Domain 的组件？

A: 使用 `createDomain` 返回的 `Provider` 包装组件。

```typescript
import { render } from '@testing-library/react';

const { Provider, Component } = createDomain(MyComponent, [
  { identifier: MyService, factory: MyService },
]);

test('should render', () => {
  const { getByText } = render(
    <Provider>
      <Component />
    </Provider>
  );
  expect(getByText('...')).toBeInTheDocument();
});
```

### Q: 如何在 Provider 外部访问服务？

A: 使用全局容器或通过 props 传递服务实例。

```typescript
import { getGlobalContainer } from '@rabjs/service';

const globalContainer = getGlobalContainer();
const service = globalContainer.resolve(MyService);
```

## 最佳实践

1. **服务应该是无状态的或只包含业务逻辑** - 避免在服务中存储 UI 状态
2. **使用 @observable 和 @SyncAction 装饰器** - 确保状态变化被正确追踪
3. **为每个 Domain 定义清晰的服务边界** - 避免过度耦合
4. **使用 TypeScript** - 获得更好的类型检查和开发体验
5. **启用严格模式** - 在开发环境中检测配置错误
6. **为服务提供清晰的接口** - 使用类或接口定义服务的公共 API

## 与 @rabjs/service 的关系

`@domain` 系统基于 `@rabjs/service` 的 `Container` 类，提供了 React 集成层。

- `Container` - 底层容器实现，支持树形结构和分层查找
- `@domain` - React 集成层，提供 Provider 和 Hooks

## 与 @rabjs/observer 的关系

`@domain` 系统与 `@rabjs/observer` 配合使用，实现响应式状态管理。

- `@observable` - 标记可观察的属性
- `@SyncAction` - 标记修改状态的方法
- `useService` - 获取服务实例，自动追踪依赖

## 许可证

MIT
