# Container 容器使用指南

## 概述

`Container` 是一个功能完整的依赖注入容器，支持树形结构、对象注册、实例化、销毁等管理能力。它设计用于在复杂的应用中管理服务的生命周期和依赖关系。

## 核心特性

- **树形结构**：支持父子容器，子容器可继承父容器的服务
- **对象注册**：支持类、工厂函数、实例的注册
- **生命周期管理**：支持单例和瞬时作用域
- **依赖注入**：自动解析依赖关系
- **销毁管理**：支持容器销毁时的清理回调
- **分层检索**：支持从子容器向上查找服务

## 基础用法

### 创建容器

```typescript
import { Container, createContainer } from '@rabjs/service';

// 方式 1：直接创建
const container = new Container({ name: 'app-container' });

// 方式 2：使用工厂函数
const container = createContainer('app-container');
```

### 注册服务

#### 注册类

```typescript
class UserService {
  getUser(id: string) {
    return { id, name: 'John' };
  }
}

// 注册为单例（默认）
container.register('userService', UserService);

// 或使用显式方法
container.registerSingleton('userService', UserService);
```

#### 注册实例

```typescript
const config = {
  apiUrl: 'http://api.example.com',
  timeout: 5000,
};

container.registerInstance('config', config);
```

#### 注册工厂函数

```typescript
container.register('userService', container => {
  const config = container.resolve('config');
  return new UserService(config);
});
```

#### 注册瞬时服务

```typescript
// 每次解析都创建新实例
container.registerTransient('userService', UserService);
```

### 解析服务

```typescript
// 解析服务
const userService = container.resolve<UserService>('userService');

// 尝试解析（不存在时返回 undefined）
const service = container.tryResolve<UserService>('userService');
```

### 链式调用

```typescript
container
  .register('userService', UserService)
  .register('configService', ConfigService)
  .registerInstance('config', { apiUrl: 'http://api.example.com' });
```

## 树形结构

### 创建子容器

```typescript
// 创建根容器
const rootContainer = createContainer('root');

// 创建子容器
const childContainer = rootContainer.createChild('child');

// 创建孙容器
const grandchildContainer = childContainer.createChild('grandchild');
```

### 服务继承

子容器可以访问父容器中注册的所有服务：

```typescript
// 在根容器中注册
rootContainer.registerInstance('appName', 'MyApp');
rootContainer.register('configService', ConfigService);

// 在子容器中可以访问
const appName = childContainer.resolve('appName');
const config = childContainer.resolve<ConfigService>('configService');
```

### 服务覆盖

子容器可以覆盖父容器的服务：

```typescript
// 根容器
rootContainer.registerInstance('config', { env: 'production' });

// 子容器覆盖
childContainer.registerInstance('config', { env: 'development' });

// 解析时获取各自的配置
const rootConfig = rootContainer.resolve('config'); // { env: 'production' }
const childConfig = childContainer.resolve('config'); // { env: 'development' }
```

### 获取容器信息

```typescript
// 获取父容器
const parent = childContainer.getParent();

// 获取所有子容器
const children = rootContainer.getChildren();

// 获取容器路径（用于调试）
const path = childContainer.getPath(); // "root > child"

// 获取容器统计信息
const stats = rootContainer.getStats();
// {
//   name: 'root',
//   path: 'root',
//   serviceCount: 2,
//   childrenCount: 1,
//   destroyed: false
// }
```

## 依赖注入

### 自动依赖解析

```typescript
class DatabaseService {
  constructor(private config: any) {}

  connect() {
    return `Connecting to ${this.config.dbUrl}`;
  }
}

class UserService {
  constructor(private db: DatabaseService) {}

  async getUser(id: string) {
    return this.db.connect();
  }
}

// 注册服务
container.registerInstance('config', { dbUrl: 'localhost:5432' });
container.register('database', DatabaseService);
container.register('userService', UserService);

// 解析时自动注入依赖
const userService = container.resolve<UserService>('userService');
```

### 工厂函数中的依赖注入

```typescript
container.register('userService', c => {
  const config = c.resolve('config');
  const database = c.resolve<DatabaseService>('database');
  return new UserService(database);
});
```

## 生命周期管理

### 单例作用域

```typescript
// 单例：所有解析都返回同一实例
container.registerSingleton('userService', UserService);

const service1 = container.resolve('userService');
const service2 = container.resolve('userService');

console.log(service1 === service2); // true
```

### 瞬时作用域

```typescript
// 瞬时：每次解析都创建新实例
container.registerTransient('userService', UserService);

const service1 = container.resolve('userService');
const service2 = container.resolve('userService');

console.log(service1 === service2); // false
```

### 销毁回调

```typescript
// 注册销毁回调
container.onDestroy(() => {
  console.log('Container is being destroyed');
});

// 支持异步回调
container.onDestroy(async () => {
  await cleanupResources();
});

// 销毁容器时会调用所有回调
await container.destroy();
```

### 自动销毁

如果服务实例有 `destroy` 或 `dispose` 方法，容器销毁时会自动调用：

```typescript
class DatabaseService {
  async connect() {
    // 连接数据库
  }

  destroy() {
    // 关闭连接
    console.log('Database connection closed');
  }
}

container.register('database', DatabaseService);
const db = container.resolve<DatabaseService>('database');

// 销毁容器时会自动调用 db.destroy()
await container.destroy();
```

## 实际应用场景

### 场景 1：多模块应用

```typescript
// 创建根容器
const appContainer = createContainer('app');

// 注册全局服务
appContainer.registerInstance('config', {
  apiUrl: 'http://api.example.com',
  timeout: 5000,
});

// 创建用户模块
const userModule = appContainer.createChild('user-module');
userModule.register('userService', UserService);
userModule.register('userRepository', UserRepository);

// 创建订单模块
const orderModule = appContainer.createChild('order-module');
orderModule.register('orderService', OrderService);
orderModule.register('orderRepository', OrderRepository);

// 各模块可以访问全局配置
const userService = userModule.resolve<UserService>('userService');
const orderService = orderModule.resolve<OrderService>('orderService');
```

### 场景 2：React 组件中的依赖注入

```typescript
import { Container, createContainer } from '@rabjs/service';
import React, { createContext, useContext } from 'react';

// 创建容器上下文
const ContainerContext = createContext<Container | null>(null);

// 提供者组件
export function ContainerProvider({ children }: { children: React.ReactNode }) {
  const container = createContainer('app');

  // 注册服务
  container.register('userService', UserService);
  container.register('configService', ConfigService);

  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

// 使用 Hook
export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error('useContainer must be used within ContainerProvider');
  }
  return container;
}

// 在组件中使用
function UserComponent() {
  const container = useContainer();
  const userService = container.resolve<UserService>('userService');

  return <div>{userService.getUser('123').name}</div>;
}
```

### 场景 3：测试中的容器隔离

```typescript
describe('UserService', () => {
  let container: Container;
  let userService: UserService;

  beforeEach(() => {
    // 为每个测试创建独立的容器
    container = createContainer('test');

    // 注册 mock 服务
    container.registerInstance('config', {
      apiUrl: 'http://test-api.example.com',
    });

    container.register('userService', UserService);
    userService = container.resolve<UserService>('userService');
  });

  afterEach(async () => {
    // 清理容器
    await container.destroy();
  });

  test('should fetch user', async () => {
    const user = await userService.getUser('123');
    expect(user.id).toBe('123');
  });
});
```

### 场景 4：分层容器管理

```typescript
// 应用级容器
const appContainer = createContainer('app');
appContainer.registerInstance('appName', 'MyApp');
appContainer.register('logger', LoggerService);

// 页面级容器
const pageContainer = appContainer.createChild('page-home');
pageContainer.register('homeService', HomeService);

// 组件级容器
const componentContainer = pageContainer.createChild('component-header');
componentContainer.register('headerService', HeaderService);

// 销毁时自动清理整个树
await appContainer.destroy(); // 会销毁 pageContainer 和 componentContainer
```

## API 参考

### 注册方法

| 方法                                | 描述         |
| ----------------------------------- | ------------ |
| `register(id, factory, singleton?)` | 注册服务     |
| `registerSingleton(id, factory)`    | 注册单例服务 |
| `registerTransient(id, factory)`    | 注册瞬时服务 |
| `registerInstance(id, instance)`    | 注册实例     |

### 解析方法

| 方法                | 描述                                 |
| ------------------- | ------------------------------------ |
| `resolve<T>(id)`    | 解析服务，不存在时抛出错误           |
| `tryResolve<T>(id)` | 尝试解析服务，不存在时返回 undefined |
| `has(id)`           | 检查服务是否已注册                   |

### 容器管理

| 方法                 | 描述             |
| -------------------- | ---------------- |
| `createChild(name?)` | 创建子容器       |
| `getParent()`        | 获取父容器       |
| `getChildren()`      | 获取所有子容器   |
| `getPath()`          | 获取容器路径     |
| `getStats()`         | 获取容器统计信息 |

### 生命周期方法

| 方法                  | 描述               |
| --------------------- | ------------------ |
| `onDestroy(callback)` | 注册销毁回调       |
| `destroy()`           | 销毁容器           |
| `isDestroyed()`       | 检查容器是否已销毁 |
| `unregister(id)`      | 注销服务           |

### 全局容器

| 方法                     | 描述         |
| ------------------------ | ------------ |
| `getGlobalContainer()`   | 获取全局容器 |
| `resetGlobalContainer()` | 重置全局容器 |

## 最佳实践

1. **使用类型参数**：在解析时使用泛型参数以获得类型提示

   ```typescript
   const service = container.resolve<UserService>('userService');
   ```

2. **合理使用单例和瞬时**：

   - 单例：无状态的服务、配置、日志等
   - 瞬时：有状态的服务、请求处理器等

3. **清理资源**：在销毁容器前确保所有资源都被正确清理

   ```typescript
   await container.destroy();
   ```

4. **避免循环依赖**：设计服务时避免循环依赖关系

5. **使用容器路径调试**：在开发时使用 `getPath()` 了解容器层级

   ```typescript
   console.log(container.getPath()); // "app > user-module > component"
   ```

6. **为容器命名**：给容器起有意义的名字便于调试
   ```typescript
   const container = createContainer('user-service-container');
   ```

## 常见问题

### Q: 如何在工厂函数中访问容器？

A: 工厂函数接收容器作为参数：

```typescript
container.register('service', c => {
  const config = c.resolve('config');
  return new Service(config);
});
```

### Q: 子容器销毁时会影响父容器吗？

A: 不会。子容器销毁只会清理自己的资源，不会影响父容器。

### Q: 如何在 React 中使用容器？

A: 使用 Context API 提供容器，然后在组件中通过 Hook 访问。

### Q: 容器支持循环依赖吗？

A: 不支持。应该避免设计出有循环依赖的服务结构。

### Q: 如何测试使用容器的代码？

A: 为每个测试创建独立的容器，注册 mock 服务，测试后销毁容器。
