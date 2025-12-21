# Container - 依赖注入容器

## 简介

`Container` 是一个功能完整的依赖注入（IoC）容器，为复杂的应用提供服务管理和生命周期控制。

## 核心能力

### 1. 树形结构支持

```typescript
// 创建根容器
const root = createContainer('root');

// 创建子容器
const child = root.createChild('child');

// 子容器继承父容器的服务
root.registerInstance('config', { apiUrl: 'http://api.example.com' });
const config = child.resolve('config'); // 可以访问
```

**特点**：

- 支持多层嵌套
- 子容器可继承父容器服务
- 子容器可覆盖父容器服务
- 销毁时自动清理整个树

### 2. 对象注册

支持多种注册方式：

```typescript
// 注册类
container.register('userService', UserService);

// 注册实例
container.registerInstance('config', { apiUrl: '...' });

// 注册工厂函数
container.register('userService', c => {
  const config = c.resolve('config');
  return new UserService(config);
});

// 注册瞬时服务
container.registerTransient('userService', UserService);
```

### 3. 实例化管理

```typescript
// 单例（默认）- 所有解析返回同一实例
container.registerSingleton('userService', UserService);
const s1 = container.resolve('userService');
const s2 = container.resolve('userService');
console.log(s1 === s2); // true

// 瞬时 - 每次解析创建新实例
container.registerTransient('userService', UserService);
const s1 = container.resolve('userService');
const s2 = container.resolve('userService');
console.log(s1 === s2); // false
```

### 4. 销毁管理

```typescript
// 注册销毁回调
container.onDestroy(() => {
  console.log('Cleaning up...');
});

// 支持异步清理
container.onDestroy(async () => {
  await database.close();
});

// 销毁容器
await container.destroy();
```

**自动清理**：

- 调用所有销毁回调
- 调用实例的 `destroy()` 或 `dispose()` 方法
- 销毁所有子容器
- 清理所有引用

### 5. 分层检索

```typescript
const root = createContainer('root');
const child = root.createChild('child');

root.registerInstance('level', 'root');
child.registerInstance('level', 'child');

// 子容器优先查找自己的服务
console.log(child.resolve('level')); // 'child'

// 如果子容器没有，向上查找
child.registerInstance('other', 'value');
console.log(root.resolve('other')); // 抛出错误，root 中没有
```

## 完整 API

### 注册方法

| 方法                | 签名                                   | 说明     |
| ------------------- | -------------------------------------- | -------- |
| `register`          | `register<T>(id, factory, singleton?)` | 注册服务 |
| `registerSingleton` | `registerSingleton<T>(id, factory)`    | 注册单例 |
| `registerTransient` | `registerTransient<T>(id, factory)`    | 注册瞬时 |
| `registerInstance`  | `registerInstance<T>(id, instance)`    | 注册实例 |

### 解析方法

| 方法         | 签名                                | 说明         |
| ------------ | ----------------------------------- | ------------ |
| `resolve`    | `resolve<T>(id): T`                 | 解析服务     |
| `tryResolve` | `tryResolve<T>(id): T \| undefined` | 尝试解析     |
| `has`        | `has(id): boolean`                  | 检查是否存在 |

### 容器管理

| 方法          | 签名                                  | 说明         |
| ------------- | ------------------------------------- | ------------ |
| `createChild` | `createChild(name?): Container`       | 创建子容器   |
| `getParent`   | `getParent(): Container \| undefined` | 获取父容器   |
| `getChildren` | `getChildren(): Container[]`          | 获取子容器   |
| `getPath`     | `getPath(): string`                   | 获取容器路径 |
| `getStats`    | `getStats(): Stats`                   | 获取统计信息 |

### 生命周期方法

| 方法          | 签名                        | 说明         |
| ------------- | --------------------------- | ------------ |
| `onDestroy`   | `onDestroy(callback): this` | 注册销毁回调 |
| `destroy`     | `destroy(): Promise<void>`  | 销毁容器     |
| `isDestroyed` | `isDestroyed(): boolean`    | 检查是否销毁 |
| `unregister`  | `unregister(id): boolean`   | 注销服务     |

### 全局容器

| 方法                     | 说明             |
| ------------------------ | ---------------- |
| `getGlobalContainer()`   | 获取全局容器单例 |
| `resetGlobalContainer()` | 重置全局容器     |
| `createContainer(name?)` | 创建新容器       |

### 全局容器注册表（静态方法）

容器名称在全局范围内唯一，支持通过名称快速获取容器实例。

|| 方法 | 签名 | 说明 |
||------|------|------|
|| `Container.getByName` | `getByName(name): Container \| undefined` | 通过名称获取容器 |
|| `Container.hasName` | `hasName(name): boolean` | 检查名称是否已注册 |
|| `Container.getAllNames` | `getAllNames(): string[]` | 获取所有容器名称 |
|| `Container.getAllContainers` | `getAllContainers(): Container[]` | 获取所有容器实例 |
|| `Container.getRegistrySize` | `getRegistrySize(): number` | 获取注册表大小 |
|| `clearGlobalContainerRegistry` | `clearGlobalContainerRegistry(): Promise<void>` | 清空全局注册表 |

## 使用示例

### 基础使用

```typescript
import { createContainer } from '@rabjs/service';

// 创建容器
const container = createContainer('app');

// 注册服务
class UserService {
  getUser(id: string) {
    return { id, name: 'John' };
  }
}

container.register('userService', UserService);

// 解析服务
const userService = container.resolve<UserService>('userService');
console.log(userService.getUser('123'));

// 销毁
await container.destroy();
```

### 依赖注入

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
    await this.db.connect();
    return { id, name: 'John' };
  }
}

// 注册依赖
container.registerInstance('config', { dbUrl: 'localhost:5432' });
container.register('database', DatabaseService);
container.register('userService', UserService);

// 自动注入
const userService = container.resolve<UserService>('userService');
```

### 模块化应用

```typescript
// 应用级容器
const appContainer = createContainer('app');
appContainer.registerInstance('appName', 'MyApp');

// 用户模块
const userModule = appContainer.createChild('user-module');
userModule.register('userService', UserService);

// 订单模块
const orderModule = appContainer.createChild('order-module');
orderModule.register('orderService', OrderService);

// 各模块可访问全局配置
const appName = userModule.resolve('appName');
```

### React 集成

```typescript
import { createContext, useContext } from 'react';
import { Container, createContainer } from '@rabjs/service';

// 创建容器上下文
const ContainerContext = createContext<Container | null>(null);

// 提供者
export function ContainerProvider({ children }) {
  const container = createContainer('app');
  container.register('userService', UserService);

  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

// Hook
export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) throw new Error('useContainer must be used within ContainerProvider');
  return container;
}

// 使用
function UserComponent() {
  const container = useContainer();
  const userService = container.resolve<UserService>('userService');
  return <div>{userService.getUser('123').name}</div>;
}
```

### 测试

```typescript
describe('UserService', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer('test');
    container.registerInstance('config', { apiUrl: 'http://test-api' });
    container.register('userService', UserService);
  });

  afterEach(async () => {
    await container.destroy();
  });

  test('should fetch user', async () => {
    const userService = container.resolve<UserService>('userService');
    const user = await userService.getUser('123');
    expect(user.id).toBe('123');
  });
});
```

### 全局容器注册表

```typescript
import { Container, createContainer, clearGlobalContainerRegistry } from '@rabjs/service';

// 创建容器时自动注册到全局注册表
const appContainer = createContainer('app');
const userModule = createContainer('user-module');

// 通过名称快速获取容器
const retrieved = Container.getByName('app');
console.log(retrieved === appContainer); // true

// 检查容器名称是否已注册
if (Container.hasName('app')) {
  console.log('App container exists');
}

// 获取所有容器名称
const allNames = Container.getAllNames();
console.log(allNames); // ['app', 'user-module']

// 获取所有容器实例
const allContainers = Container.getAllContainers();
console.log(allContainers.length); // 2

// 获取注册表大小
console.log(Container.getRegistrySize()); // 2

// 销毁容器时自动从注册表中移除
await appContainer.destroy();
console.log(Container.hasName('app')); // false

// 清空所有容器（通常用于测试）
await clearGlobalContainerRegistry();
console.log(Container.getRegistrySize()); // 0
```

**注意**：容器名称必须全局唯一，创建同名容器会抛出错误：

```typescript
createContainer('app');
createContainer('app'); // 抛出错误：Container name "app" is already registered
```

## 最佳实践

1. **使用类型参数**

   ```typescript
   const service = container.resolve<UserService>('userService');
   ```

2. **合理选择作用域**

   - 单例：无状态服务、配置、日志
   - 瞬时：有状态服务、请求处理器

3. **正确清理资源**

   ```typescript
   await container.destroy();
   ```

4. **避免循环依赖**

   - 设计清晰的依赖关系

5. **使用有意义的名称**

   ```typescript
   const container = createContainer('user-service-container');
   ```

6. **利用容器路径调试**
   ```typescript
   console.log(container.getPath());
   ```

## 性能特性

- **单例缓存**：单例服务只实例化一次
- **分层查找**：从子容器向上查找，避免重复注册
- **延迟初始化**：服务在解析时才创建
- **内存管理**：销毁时自动清理所有引用

## 常见问题

**Q: 如何在工厂函数中访问容器？**
A: 工厂函数接收容器作为参数：

```typescript
container.register('service', c => new Service(c.resolve('config')));
```

**Q: 子容器销毁会影响父容器吗？**
A: 不会。子容器销毁只清理自己的资源。

**Q: 如何处理循环依赖？**
A: 应该避免设计循环依赖。如必要，可使用工厂函数延迟解析。

**Q: 容器支持异步初始化吗？**
A: 支持。在工厂函数中返回 Promise：

```typescript
container.register('service', async c => {
  await initialize();
  return new Service();
});
```

## 相关文档

- [详细使用指南](./container-guide.md)
- [API 参考](./container-guide.md#api-参考)
- [测试用例](../src/__tests__/container.test.ts)
