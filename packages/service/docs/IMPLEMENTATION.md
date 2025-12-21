# Service 实现文档

## 概述

`@rabjs/service` 是一个轻量级的响应式 Service 基类，提供了以下核心特性：

1. **默认 Observable**：Service 实例默认是响应式的
2. **自动状态管理**：自动为所有方法创建 loading 和 error 状态
3. **批量更新支持**：与 React 批量更新机制集成
4. **TypeScript 类型推导**：完整的类型支持
5. **轻量级实现**：不依赖重量级 DI 框架

## 核心实现

### 1. Service 类

```typescript
export class Service {
  public $model: ExtractMethods<this> = {} as ExtractMethods<this>;

  constructor() {
    // 先将实例转换为 observable
    const observableInstance = observable(this);
    // 然后在 observable 实例上设置方法拦截
    this.__setupMethodInterception(observableInstance);
    // 返回 observable 实例
    return observableInstance;
  }
}
```

#### 关键设计决策

**为什么先创建 observable 再设置方法拦截？**

这是为了确保方法内部的 `this` 指向 observable 实例。如果顺序相反：

```typescript
// ❌ 错误的顺序
constructor() {
  this.__setupMethodInterception();  // this 是原始实例
  return observable(this);            // 返回 observable 实例
}
```

在这种情况下，方法被绑定到原始实例，方法内部的 `this.property++` 不会触发响应式更新。

正确的顺序：

```typescript
// ✅ 正确的顺序
constructor() {
  const observableInstance = observable(this);  // 创建 observable 实例
  this.__setupMethodInterception(observableInstance);  // 在 observable 实例上设置拦截
  return observableInstance;  // 返回 observable 实例
}
```

### 2. 方法拦截

```typescript
private __setupMethodInterception(instance: this) {
  const prototype = Object.getPrototypeOf(instance);
  const methodNames = this.__getMethodNames(prototype);

  methodNames.forEach(methodName => {
    const originalMethod = prototype[methodName];

    if (typeof originalMethod === 'function') {
      // 初始化状态
      (instance.$model as any)[methodName] = {
        loading: false,
        error: null,
      };

      // 包装方法，绑定到 observable 实例
      const boundMethod = originalMethod.bind(instance);
      (instance as any)[methodName] = this.__createMethodWrapper(boundMethod, methodName);
    }
  });
}
```

#### 关键点

1. **从原型获取方法**：`prototype[methodName]` 而不是 `instance[methodName]`
2. **绑定到 observable 实例**：`originalMethod.bind(instance)`
3. **在 observable 实例上设置包装方法**：`(instance as any)[methodName] = ...`

### 3. 方法包装器

```typescript
private __createMethodWrapper(originalMethod: Function, methodName: string): Function {
  return function (this: any, ...args: any[]) {
    const config = getServiceConfig();
    const result = originalMethod(...args);

    // 检查是否是 Promise（异步方法）
    if (result && typeof result.then === 'function') {
      const modelState = this.$model[methodName];

      // 设置 loading 状态，使用批量更新
      const setLoading = () => {
        modelState.loading = true;
        if (modelState.error) {
          modelState.error = null;
        }
      };

      if (config.reactionScheduler) {
        config.reactionScheduler(setLoading);
      } else {
        setLoading();
      }

      return result
        .then((res: any) => {
          const updateState = () => {
            modelState.loading = false;
          };

          if (config.reactionScheduler) {
            config.reactionScheduler(updateState);
          } else {
            updateState();
          }
          return res;
        })
        .catch((err: any) => {
          const updateState = () => {
            modelState.loading = false;
            modelState.error = err;
          };

          if (config.reactionScheduler) {
            config.reactionScheduler(updateState);
          } else {
            updateState();
          }
          throw err;
        });
    }

    // 同步方法直接返回结果
    return result;
  };
}
```

#### 关键点

1. **异步方法检测**：通过 `typeof result.then === 'function'` 判断
2. **批量更新**：所有状态更新都通过 `reactionScheduler` 包装
3. **错误处理**：catch 中设置 error 状态并重新抛出错误

### 4. 配置系统

```typescript
export interface ServiceConfig {
  reactionScheduler?: (callback: () => void) => void;
}

let globalConfig: ServiceConfig = {};

export function configureService(config: ServiceConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

export function getServiceConfig(): ServiceConfig {
  return globalConfig;
}
```

#### 使用方式

```typescript
import { unstable_batchedUpdates } from 'react-dom';
import { configureService } from '@rabjs/service';

configureService({
  reactionScheduler: unstable_batchedUpdates,
});
```

### 5. React 集成

```typescript
// @rabjs/react/src/configureService.ts
export function configureServiceForReact(batchedUpdates: (callback: () => void) => void): void {
  configureService({
    reactionScheduler: batchedUpdates,
  });
}
```

## 类型系统

### 1. ExtractMethods 类型

```typescript
export type ExtractMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? MethodState : never;
};
```

这个类型会：

- 遍历 Service 类的所有属性
- 对于方法类型的属性，映射为 `MethodState`
- 对于非方法属性，映射为 `never`（会被过滤掉）

### 2. 类型推导示例

```typescript
class UserService extends Service {
  users: User[] = []; // 不会出现在 $model 中

  async fetchUsers() {
    // $model.fetchUsers: MethodState
    // ...
  }

  syncMethod() {
    // $model.syncMethod: MethodState
    // ...
  }
}

const service = new UserService();

// TypeScript 会自动推导：
// service.$model.fetchUsers: { loading: boolean; error: Error | null }
// service.$model.syncMethod: { loading: boolean; error: Error | null }
```

## 性能优化

### 1. 批量更新

通过 `reactionScheduler` 配置，所有状态更新都会被批量处理：

```typescript
// 没有批量更新
service.count++; // 触发渲染
service.count++; // 触发渲染
service.count++; // 触发渲染
// 总共 3 次渲染

// 有批量更新
configureService({ reactionScheduler: unstable_batchedUpdates });
service.count++; // 收集更新
service.count++; // 收集更新
service.count++; // 收集更新
// 批量执行，只触发 1 次渲染
```

### 2. 细粒度响应

只有访问了响应式属性的组件才会重新渲染：

```typescript
const ComponentA = observer(() => {
  return <div>{service.count}</div>; // 只响应 count 变化
});

const ComponentB = observer(() => {
  return <div>{service.name}</div>; // 只响应 name 变化
});

service.count++; // 只有 ComponentA 重新渲染
service.name = 'new'; // 只有 ComponentB 重新渲染
```

## 测试

### 1. Observable 特性测试

```typescript
it('Service 实例应该是 observable 的', () => {
  class TestService extends Service {
    count = 0;
  }

  const service = new TestService();
  expect(isObservable(service)).toBe(true);
});

it('Service 属性变化应该触发 reaction', () => {
  class TestService extends Service {
    count = 0;
    increment() {
      this.count++;
    }
  }

  const service = new TestService();
  let reactionCount = 0;

  observe(() => {
    const _ = service.count;
    reactionCount++;
  });

  expect(reactionCount).toBe(1); // 初始执行
  service.increment();
  expect(reactionCount).toBe(2); // count 变化触发
});
```

### 2. 批量更新测试

```typescript
it('批量更新应该包装状态更新', async () => {
  let batchCount = 0;
  const batchedUpdates = jest.fn((callback: () => void) => {
    batchCount++;
    callback();
  });

  configureService({
    reactionScheduler: batchedUpdates,
  });

  class TestService extends Service {
    async fetchData() {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'data';
    }
  }

  const service = new TestService();
  await service.fetchData();

  // 应该至少调用了两次批量更新（loading true 和 loading false）
  expect(batchCount).toBeGreaterThanOrEqual(2);
});
```

### 3. 方法拦截测试

```typescript
it('异步方法应该自动管理 loading 状态', async () => {
  class TestService extends Service {
    async fetchData() {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'data';
    }
  }

  const service = new TestService();

  expect(service.$model.fetchData.loading).toBe(false);
  expect(service.$model.fetchData.error).toBe(null);

  const promise = service.fetchData();
  expect(service.$model.fetchData.loading).toBe(true);

  const result = await promise;
  expect(result).toBe('data');
  expect(service.$model.fetchData.loading).toBe(false);
  expect(service.$model.fetchData.error).toBe(null);
});
```

## 与其他方案对比

### vs MobX

**相似点：**

- 都使用 observable 实现响应式
- 都支持自动追踪依赖
- 都与 React 集成良好

**不同点：**

- Service 不需要调用 `makeAutoObservable`
- Service 自动提供 loading 和 error 状态
- Service 更轻量级

### vs Redux

**优势：**

- 代码量大幅减少（不需要 actions、reducers）
- 不需要手动管理 loading 和 error
- 更直观的面向对象风格
- 更好的 TypeScript 支持

**劣势：**

- 没有时间旅行调试
- 没有中间件系统
- 状态不可序列化（不适合 SSR 状态同步）

### vs 参考实现 (rsjs)

**改进点：**

1. **简化了 observable 转换**：不需要手动调用 `getObserverService`
2. **移除了 inversify 依赖**：更轻量级
3. **更好的类型推导**：`$model` 类型自动推导
4. **统一的配置方式**：通过 `configureService` 全局配置

## 最佳实践

### 1. 在应用入口配置

```typescript
// src/index.tsx
import { unstable_batchedUpdates } from 'react-dom';
import { configureServiceForReact } from '@rabjs/react';

configureServiceForReact(unstable_batchedUpdates);
```

### 2. 使用 useMemo 创建实例

```typescript
const MyComponent = observer(() => {
  const service = useMemo(() => new MyService(), []);
  // ...
});
```

### 3. 使用 Context 共享 Service

```typescript
const ServiceContext = createContext<MyService | null>(null);

const App = () => {
  const service = useMemo(() => new MyService(), []);
  return <ServiceContext.Provider value={service}>{children}</ServiceContext.Provider>;
};
```

### 4. 合理组织 Service

```typescript
// ✅ 按功能领域划分
class UserService extends Service {}
class TodoService extends Service {}

// ❌ 一个 Service 包含所有功能
class AppService extends Service {}
```

## 未来改进

### 1. 支持装饰器配置

```typescript
class UserService extends Service {
  @computed
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  @action
  async fetchUser() {
    // ...
  }
}
```

### 2. 支持中间件

```typescript
configureService({
  reactionScheduler: unstable_batchedUpdates,
  middleware: [loggingMiddleware, errorReportingMiddleware],
});
```

### 3. 支持持久化

```typescript
class UserService extends Service {
  @persist('localStorage')
  preferences = {};
}
```

### 4. 开发工具集成

```typescript
// 支持 Redux DevTools
configureService({
  devTools: true,
});
```

## 总结

`@rabjs/service` 提供了一个简单、类型安全、高性能的响应式 Service 解决方案。通过合理的设计和实现，它在保持轻量级的同时，提供了强大的功能和良好的开发体验。
