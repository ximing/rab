# Container 快速开始

## 5 分钟快速上手

### 安装

```bash
npm install @rabjs/service
```

### 基础示例

```typescript
import { createContainer } from '@rabjs/service';

// 1. 创建容器
const container = createContainer('app');

// 2. 注册服务
class UserService {
  getUser(id: string) {
    return { id, name: 'John' };
  }
}

container.register('userService', UserService);

// 3. 解析服务
const userService = container.resolve<UserService>('userService');

// 4. 使用服务
console.log(userService.getUser('123')); // { id: '123', name: 'John' }

// 5. 销毁容器
await container.destroy();
```

## 常见操作

### 注册不同类型的服务

```typescript
// 注册类（单例）
container.register('userService', UserService);

// 注册实例
container.registerInstance('config', { apiUrl: 'http://api.example.com' });

// 注册工厂函数
container.register('userService', c => {
  const config = c.resolve('config');
  return new UserService(config);
});

// 注册瞬时服务（每次创建新实例）
container.registerTransient('userService', UserService);
```

### 依赖注入

```typescript
class DatabaseService {
  constructor(private config: any) {}
}

class UserService {
  constructor(private db: DatabaseService) {}
}

// 注册依赖
container.registerInstance('config', { dbUrl: 'localhost' });
container.register('database', DatabaseService);
container.register('userService', UserService);

// 自动注入
const userService = container.resolve<UserService>('userService');
```

### 树形结构

```typescript
// 创建根容器
const root = createContainer('root');
root.registerInstance('appName', 'MyApp');

// 创建子容器
const child = root.createChild('child');

// 子容器继承父容器的服务
const appName = child.resolve('appName'); // 'MyApp'

// 子容器可以覆盖
child.registerInstance('appName', 'ChildApp');
console.log(child.resolve('appName')); // 'ChildApp'
console.log(root.resolve('appName')); // 'MyApp'
```

### 生命周期管理

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

### 检查和查询

```typescript
// 检查服务是否存在
if (container.has('userService')) {
  const service = container.resolve('userService');
}

// 尝试解析（不存在返回 undefined）
const service = container.tryResolve('userService');

// 获取所有服务
const services = container.getServiceIdentifiers();

// 获取容器信息
const stats = container.getStats();
console.log(stats);
// {
//   name: 'app',
//   path: 'app',
//   serviceCount: 3,
//   childrenCount: 1,
//   destroyed: false
// }
```

## 实际应用

### React 应用

```typescript
import { createContext, useContext } from 'react';
import { Container, createContainer } from '@rabjs/service';

// 创建容器上下文
const ContainerContext = createContext<Container | null>(null);

// 提供者组件
export function AppProvider({ children }) {
  const container = createContainer('app');

  // 注册全局服务
  container.registerInstance('config', {
    apiUrl: 'http://api.example.com',
  });
  container.register('userService', UserService);

  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

// 使用 Hook
export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error('useContainer must be used within AppProvider');
  }
  return container;
}

// 在组件中使用
function UserList() {
  const container = useContainer();
  const userService = container.resolve<UserService>('userService');

  return <div>{/* 使用 userService */}</div>;
}
```

### 测试

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

### 模块化应用

```typescript
// 应用级容器
const appContainer = createContainer('app');
appContainer.registerInstance('appName', 'MyApp');
appContainer.register('logger', LoggerService);

// 用户模块
const userModule = appContainer.createChild('user-module');
userModule.register('userService', UserService);
userModule.register('userRepository', UserRepository);

// 订单模块
const orderModule = appContainer.createChild('order-module');
orderModule.register('orderService', OrderService);
orderModule.register('orderRepository', OrderRepository);

// 使用
const userService = userModule.resolve<UserService>('userService');
const orderService = orderModule.resolve<OrderService>('orderService');

// 销毁时自动清理所有子容器
await appContainer.destroy();
```

## 常见错误

### ❌ 错误：服务未找到

```typescript
// 错误
const service = container.resolve('notExist'); // 抛出错误

// 正确
const service = container.tryResolve('notExist'); // 返回 undefined
if (service) {
  // 使用 service
}
```

### ❌ 错误：在销毁后使用容器

```typescript
// 错误
await container.destroy();
container.register('service', Service); // 抛出错误

// 正确
container.register('service', Service);
await container.destroy();
```

### ❌ 错误：忘记销毁容器

```typescript
// 错误
const container = createContainer('app');
// ... 使用容器
// 忘记销毁，资源泄漏

// 正确
const container = createContainer('app');
try {
  // ... 使用容器
} finally {
  await container.destroy();
}
```

## 类型安全

```typescript
// ✅ 好：使用泛型获得类型提示
const userService = container.resolve<UserService>('userService');
userService.getUser('123'); // 类型检查

// ❌ 不好：没有类型信息
const userService = container.resolve('userService');
userService.getUser('123'); // any 类型，无类型检查
```

## 性能提示

1. **使用单例**：无状态服务应该是单例

   ```typescript
   container.registerSingleton('logger', LoggerService);
   ```

2. **避免重复注册**：在应用启动时注册所有服务

   ```typescript
   // 好
   const container = createContainer('app');
   registerAllServices(container);

   // 不好
   function getService() {
     const container = createContainer('app');
     container.register('service', Service);
     return container.resolve('service');
   }
   ```

3. **使用工厂函数处理复杂初始化**
   ```typescript
   container.register('database', c => {
     const config = c.resolve('config');
     const db = new Database(config);
     db.connect();
     return db;
   });
   ```

## 更多资源

- [详细使用指南](./container-guide.md)
- [完整 API 文档](./CONTAINER.md)
- [测试用例](../src/__tests__/container.test.ts)
