# @domain - React 依赖注入系统

基于 React Context 的依赖注入系统，支持服务容器、生命周期管理和作用域隔离。

## 核心特性

- ✅ **bindServices 包装组件** - 为组件创建服务容器并注册服务
- ✅ **useService Hook** - 按作用域链查找服务实例
- ✅ **生命周期绑定** - 服务实例与组件生命周期一致（挂载创建、卸载销毁）
- ✅ **作用域隔离** - 同一作用域链下每个服务只能在一个地方注册
- ✅ **嵌套领域** - 支持多层 bindServices 嵌套，父容器自动透传
- ✅ **严格模式** - RSStrict 提供可选的严格注册检测
- ✅ **TypeScript 支持** - 完整的类型定义

## 快速开始

### 1. 定义服务

```typescript
import { Service } from '@rabjs/react';

class MainPageService extends Service {
  // 属性自动是 observable
  count = 0;

  // 方法自动是 action（批量更新）
  increment() {
    this.count++;
  }

  getCount(): number {
    return this.count;
  }
}
```

### 2. 创建组件并通过 bindServices 注册服务

```typescript
import { bindServices, useService } from '@rabjs/react';

const MainPageComponent = () => {
  const mainPageService = useService(MainPageService);

  return (
    <div>
      <p>Count: {mainPageService.getCount()}</p>
      <button onClick={() => mainPageService.increment()}>Increment</button>
    </div>
  );
};

// bindServices 返回包装后的组件：内部创建容器、注册服务，并自动用 view 包裹组件
const MainPage = bindServices(MainPageComponent, [MainPageService]);
```

### 3. 在应用中使用

```typescript
import { RSRoot } from '@rabjs/react';

// RSRoot 提供根容器，页面级服务会挂载在它之下
export const App = () => (
  <RSRoot>
    <MainPage />
  </RSRoot>
);

// 如需启用严格模式，在 RSRoot 内使用 RSStrict
export const StrictApp = () => (
  <RSRoot>
    <RSStrict>
      <MainPage />
    </RSStrict>
  </RSRoot>
);
```

## API 文档

### bindServices

为组件绑定服务容器，创建一个「领域（Domain）」。返回包装后的组件。

```typescript
function bindServices<P extends Record<string, any> = any, TRef = any>(
  Comp: ComponentType<P>,
  servicesList: (
    | [
        ServiceIdentifier | ServiceClass,
        ServiceClass | ServiceFactory | RegisterOptions,
        RegisterOptions,
      ]
    | ServiceClass
  )[],
  options?: { name?: string }
): ComponentType<P>;
```

**参数:**

- `Comp` - 原始 React 组件（若未被 `observer`/`view` 包裹，会自动用 `view` 包裹）
- `servicesList` - 服务列表，每个元素是以下两种形式之一：
  - `ServiceClass` - 直接传服务类，类本身即标识符和工厂
  - `[identifier, ServiceClass | ServiceFactory, RegisterOptions]` - 元组形式，支持自定义标识符、工厂函数和注册选项（如 `scope`）
- `options` - 配置选项
  - `name` - 容器名称（用于调试，默认取组件名）

**返回值:**

- 包装后的组件（自动 view 包裹、支持 ref 转发）

**行为:**

- 父容器来自 DomainContext（即外层 `bindServices`/`RSRoot` 的容器），没有上下文时默认挂到全局容器
- 组件挂载时创建容器并注册服务，卸载时销毁容器（内部通过 FinalizationRegistry 兜底，防止 concurrent 模式下内存泄漏）
- 严格模式（`RSStrict`）下，若组件不在任何领域上下文内，抛出 `[RSJS] Strict mode must in Root Provider`

**示例:**

```typescript
// 类形式
const MainPage = bindServices(MainPageComponent, [MainPageService]);

// 元组形式：自定义标识符 + 工厂 + 选项
const UserPage = bindServices(UserPageComponent, [
  ['userService', UserService, { scope: 'singleton' }],
]);

// 多个服务 + 容器名
const Page = bindServices(PageComponent, [AuthService, UserService], { name: 'Page' });
```

### useService

在 React 组件中获取服务实例。

```typescript
function useService<T extends Service>(identifier: new (...args: any[]) => T): T;
function useService<T extends Service = Service>(identifier: string | symbol): T;
```

**参数:**

- `identifier` - 服务标识符（类、字符串或 Symbol）

**返回值:**

- 服务实例

**异常:**

- 如果没有找到服务，抛出异常（包含容器名与原始错误信息）

**行为:**

- 按作用域链向上查找（当前容器 → 父容器 → 全局容器）
- 非严格模式下，未注册的服务会自动注册到全局容器（兼容旧版逻辑）
- 严格模式（`RSStrict`）下不自动注册，必须已通过 `bindServices` 或 `register` 注册

**示例:**

```typescript
const MainPageComponent = () => {
  const mainPageService = useService(MainPageService);
  return <div>{mainPageService.getCount()}</div>;
};
```

### useContainer

获取当前领域的容器实例。

```typescript
function useContainer(): Container;
```

**返回值:**

- 当前容器实例

**异常:**

- 如果不在领域内部，抛出异常

**示例:**

```typescript
const container = useContainer();
console.log(container.getName());
```

### useContainerEvents

获取当前容器的事件发射器，用于监听和发送容器级别的事件。

```typescript
function useContainerEvents(): EventEmitter;
```

**返回值:**

- 容器的事件发射器实例（eventemitter3）

**异常:**

- 如果不在领域内部，抛出异常

**示例:**

```typescript
import { useContainerEvents } from "@rabjs/react";
import { useEffect } from "react";

function UserList() {
  const events = useContainerEvents();

  useEffect(() => {
    // 监听事件
    const onUserAdded = (user: User) => {
      console.log("User added:", user);
      // 更新 UI 或执行其他操作
    };

    events.on("user:added", onUserAdded);

    // 清理监听器
    return () => {
      events.off("user:added", onUserAdded);
    };
  }, [events]);

  const addUser = () => {
    // 发送事件
    events.emit("user:added", { id: 1, name: "John" });
  };

  return <button onClick={addUser}>Add User</button>;
}
```

**使用场景:**

- 组件间通信：在同一容器内的不同组件之间传递消息
- 事件驱动：基于事件的松耦合架构
- 状态同步：多个组件监听同一事件并同步更新
- 生命周期事件：监听容器或服务的生命周期事件

### useObserverService

获取服务实例并自动追踪响应式更新，让组件在不使用 `observer`/`view` HOC 的情况下也能响应服务状态变化。

```typescript
function useObserverService<T, S>(
  identifier: new (...args: any[]) => T,
  selector: (service: T) => S
): [S, T];
```

**返回值:**

- `[选中状态, 服务实例]` 元组

**示例:**

```typescript
const MyComponent = () => {
  const [state, demoService] = useObserverService(DemoService, (demo) => demo.state);

  return (
    <div>
      <p>{state.count}</p>
      <button onClick={() => demoService.increment()}>Increment</button>
    </div>
  );
};
```

### RSRoot

根领域组件，为整棵组件树提供根容器。

```typescript
const RSRoot: ComponentType<{ children: ReactNode }>;
```

**示例:**

```typescript
import { RSRoot } from '@rabjs/react';

export const App = () => (
  <RSRoot>
    <MainPage />
  </RSRoot>
);
```

### RSStrict

严格模式 Provider。启用后：

- `useService` 不再自动把未注册的服务注册到全局容器
- `bindServices` 包装的组件必须处于某个领域上下文内（`RSRoot` 或外层 `bindServices`），否则抛出 `[RSJS] Strict mode must in Root Provider`

```typescript
function RSStrict({ children }: { children: ReactNode }): JSX.Element;
```

**示例:**

```typescript
import { RSRoot, RSStrict } from '@rabjs/react';

// RSStrict 必须放在 RSRoot（或某个领域）内部使用
export const App = () => (
  <RSRoot>
    <RSStrict>
      <MainPage />
    </RSStrict>
  </RSRoot>
);
```

## 服务定义

### 使用类（推荐）

```typescript
import { Service } from '@rabjs/react';

class MyService extends Service {
  getValue(): string {
    return 'value';
  }
}

const MyComponentBound = bindServices(Component, [MyService]);
```

### 使用工厂函数（元组形式）

```typescript
const MyComponentBound = bindServices(Component, [
  [
    'myService',
    container => ({
      getValue: () => 'value',
    }),
  ],
]);
```

### 使用自定义标识符 + 注册选项

```typescript
const MyComponentBound = bindServices(Component, [
  ['myService', MyService, { scope: 'singleton' }],
]);
```

## 作用域链

服务按照领域作用域链向上查找：当前容器 → 父容器 → 全局容器。

```typescript
// 父领域：注册 Service1
const Parent = bindServices(ParentComponent, [Service1]);

// 子领域：注册 Service2，父容器自动来自 DomainContext
const Child = bindServices(ChildComponent, [Service2]);

// 在子组件中可以访问 Service1 和 Service2
const ChildComponent = () => {
  const service1 = useService(Service1); // 从父领域查找
  const service2 = useService(Service2); // 从当前领域查找
  return <div />;
};

// 使用：嵌套渲染即可，无需手动传 Provider
const ParentComponent = () => (
  <Child />
);

<RSRoot>
  <Parent />
</RSRoot>;
```

注意：`resolve` 只能沿作用域链向上查找，不能访问兄弟领域或子领域注册的服务。

## 生命周期管理

服务实例与 `bindServices` 包装组件的生命周期一致。

```typescript
const MyComponentBound = bindServices(Component, [MyService]);

// 当组件挂载时，创建容器并实例化服务
// 当组件卸载时，销毁容器和服务实例
```

容器销毁由两套机制保障：

- 组件卸载时通过 effect 清理销毁
- concurrent 模式下若渲染未提交导致 effect 未执行，由 FinalizationRegistry 兜底销毁，避免内存泄漏

另外：

- **应用级单例服务**应使用 `register` 注册到全局容器，不要用 `bindServices`
- **组件/页面级服务**才使用 `bindServices` 绑定到组件生命周期

## 严格模式

严格模式通过 `RSStrict` 启用（默认关闭）。注意 `RSStrict` 必须放在 `RSRoot`（或某个领域）内部。

```typescript
import { RSRoot, RSStrict, bindServices, useService } from '@rabjs/react';

// 启用严格模式：
// - useService 不会自动把未注册的服务注册到全局容器
// - bindServices 组件必须在领域上下文内，否则抛出
//   '[RSJS] Strict mode must in Root Provider'
const App = () => (
  <RSRoot>
    <RSStrict>
      <MainPage />
    </RSStrict>
  </RSRoot>
);
```

非严格模式（默认）下，`useService` 遇到未注册的服务会自动注册到全局容器，兼容旧版 RSJS 逻辑。

## 完整示例

```typescript
import React from "react";
import { Service, bindServices, useService, RSRoot, RSStrict } from "@rabjs/react";

// 1. 定义服务（属性自动 observable，方法自动 action）
class CounterService extends Service {
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

// 3. 绑定服务（自动 view 包裹，创建领域容器）
const CounterPage = bindServices(Counter, [CounterService]);

// 4. 使用
export const App = () => (
  <RSRoot>
    <RSStrict>
      <CounterPage />
    </RSStrict>
  </RSRoot>
);
```

## 常见问题

### Q: 如何在多个组件中共享服务？

A: 将服务注册在共同的父领域中，子组件通过 `useService` 访问。

```typescript
const Parent = bindServices(ParentComponent, [SharedService]);

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

A: 在 Service 内使用 getter + `this.resolve` 沿作用域链解析依赖，或将依赖一起注册到同一领域。

```typescript
const Page = bindServices(PageComponent, [
  Service1,
  [
    'service2',
    container => {
      const service1 = container.resolve(Service1);
      return new Service2(service1);
    },
  ],
]);
```

也可以在 Service 类中使用 getter + `this.resolve`（推荐）：

```typescript
class Service2 extends Service {
  get service1() {
    return this.resolve(Service1);
  }
}
```

### Q: 如何测试使用领域的组件？

A: 直接渲染 `bindServices` 返回的组件（必要时外面套一层 `RSRoot`）。

```typescript
import { render } from "@testing-library/react";
import { RSRoot } from "@rabjs/react";

test("should render", () => {
  const { getByText } = render(
    <RSRoot>
      <MyComponentBound />
    </RSRoot>
  );
  expect(getByText("...")).toBeInTheDocument();
});
```

### Q: 如何在组件外部访问服务？

A: 使用全局容器，或通过 props 传递服务实例。

```typescript
import { getGlobalContainer, register, resolve } from '@rabjs/react';

// 全局单例服务用 register 注册
register(MyService);

// 在任何地方解析全局服务
const service = resolve(MyService);
const globalContainer = getGlobalContainer();
```

## 最佳实践

1. **服务应该是无状态的或只包含业务逻辑** - 避免在服务中存储 UI 状态
2. **全局单例服务用 `register`，组件级服务用 `bindServices`** - 生命周期要与使用场景匹配
3. **为每个领域定义清晰的服务边界** - 避免过度耦合
4. **使用 TypeScript** - 获得更好的类型检查和开发体验
5. **在开发环境启用 `RSStrict` 严格模式** - 检测未注册服务和错误的嵌套用法
6. **为服务提供清晰的接口** - 使用类定义服务的公共 API

## 与 @rabjs/service 的关系

`@domain` 系统基于 `@rabjs/service` 的 `Container` 类，提供了 React 集成层。

- `Container` - 底层容器实现，支持树形结构和分层查找
- `register` / `resolve` / `getGlobalContainer` - 全局容器操作
- `@domain` - React 集成层，提供 `bindServices`、`RSRoot` 和 Hooks

## 与 @rabjs/observer 的关系

`@domain` 系统与 `@rabjs/observer` 配合使用，实现响应式状态管理。

- Service 属性自动 observable - 状态变化被自动追踪
- Service 方法自动 action - 批量更新状态
- `useService` - 获取服务实例，配合 `observer`/`view`（bindServices 自动包裹）实现自动重渲染
- `@SyncAction` - 需要关闭批量更新时标记方法

## 许可证

MIT
