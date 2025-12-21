# Container API 重构说明

## 概述

Container 已重构为专门为 Service 定制的 IoC 容器,提供更简洁和类型安全的 API。

## 核心变更

### 1. 新增类型定义

```typescript
// 服务作用域枚举
export enum ServiceScope {
  Singleton = 'singleton', // 单例模式
  Transient = 'transient', // 瞬时模式
}

// 注册选项
export interface RegisterOptions {
  scope?: ServiceScope;
}

// 服务标识符类型
export type ServiceIdentifier<T = any> = string | symbol | (new (...args: any[]) => T);

// 服务类类型
export type ServiceClass<T = any> = new (...args: any[]) => T;

// 服务工厂函数类型(用于解决循环引用)
export type ServiceFactory<T = any> = (container: Container) => T;
```

### 2. register 方法 - 支持四种用法

#### 用法 1: 使用类作为标识符

```typescript
// 最简洁的用法,类既是标识符也是工厂
container.register(UserService);
container.register(UserService, { scope: ServiceScope.Singleton });
container.register(TodoService, { scope: ServiceScope.Transient });
```

#### 用法 2: 使用自定义标识符

```typescript
// 使用字符串或 Symbol 作为标识符
container.register('userService', UserService);
container.register(Symbol('todoService'), TodoService);
container.register('config', ConfigService, { scope: ServiceScope.Transient });
```

#### 用法 3: 使用懒加载函数(解决循环引用)

```typescript
// 使用工厂函数延迟实例化,解决循环依赖
container.register('userService', container => {
  const todoService = container.resolve(TodoService);
  return new UserService(todoService);
});

container.register(
  'complexService',
  container => {
    const dep1 = container.resolve('dep1');
    const dep2 = container.resolve('dep2');
    return new ComplexService(dep1, dep2);
  },
  { scope: ServiceScope.Singleton }
);
```

#### 用法 4: 注册实例(向后兼容)

```typescript
// 直接注册实例对象(主要用于配置对象等)
container.register('config', { apiUrl: 'http://api.example.com' });
container.register('settings', { theme: 'dark', locale: 'zh-CN' });
```

### 3. 便捷方法

```typescript
// 注册单例服务
container.registerSingleton(UserService);
container.registerSingleton('userService', UserService);

// 注册瞬时服务(每次 resolve 都创建新实例)
container.registerTransient(TodoService);
container.registerTransient('todoService', TodoService);

// 注册实例(向后兼容)
container.registerInstance('config', { apiUrl: 'http://api.example.com' });
```

### 4. resolve 方法 - 智能类型推导

Container 的 `resolve` 和 `tryResolve` 方法支持智能类型推导：

```typescript
// ✅ 使用类作为标识符 - 自动推导类型
const userService = container.resolve(UserService);
// userService 的类型自动推导为 UserService，无需显式泛型！

// ✅ 使用字符串标识符 - 需要显式泛型
const todoService = container.resolve<TodoService>('todoService');
// 必须显式指定泛型，否则类型为 Service（基类）

// ✅ 使用 Symbol 标识符 - 需要显式泛型
const configService = container.resolve<ConfigService>(Symbol.for('config'));

// ✅ tryResolve 也支持类型推导
const maybeUser = container.tryResolve(UserService);
// maybeUser 的类型自动推导为 UserService | undefined

const maybeTodo = container.tryResolve<TodoService>('todoService');
// maybeTodo 的类型为 TodoService | undefined
```

**类型推导规则**：

- 传入**类构造函数**：自动推导返回类型 ✨
- 传入**字符串或 Symbol**：需要显式指定泛型 `<T>`

## 完整示例

```typescript
import { Container, ServiceScope } from '@rabjs/service';

// 定义服务类
class DatabaseService extends Service {
  async connect() {
    console.log('Connected to database');
  }
}

class UserRepository extends Service {
  constructor(private db: DatabaseService) {
    super();
  }

  async findUser(id: string) {
    return { id, name: 'User' };
  }
}

class UserService extends Service {
  constructor(private repo: UserRepository) {
    super();
  }

  async getUser(id: string) {
    return this.repo.findUser(id);
  }
}

// 创建容器
const container = new Container({ name: 'app' });

// 注册服务 - 方式 1: 使用类作为标识符
container.register(DatabaseService);

// 注册服务 - 方式 2: 使用自定义标识符
container.register('userRepo', UserRepository);

// 注册服务 - 方式 3: 使用懒加载函数(解决循环引用)
container.register('userService', c => {
  const repo = c.resolve('userRepo');
  return new UserService(repo);
});

// 注册服务 - 方式 4: 注册配置实例
container.register('config', {
  apiUrl: 'http://api.example.com',
  timeout: 5000,
});

// 解析服务
const db = container.resolve(DatabaseService);
const userService = container.resolve('userService');
const config = container.resolve('config');

// 使用服务
await db.connect();
const user = await userService.getUser('123');
console.log(config.apiUrl);
```

## 树形容器结构

```typescript
// 创建根容器
const rootContainer = new Container({ name: 'root' });
rootContainer.register(DatabaseService);

// 创建子容器(继承父容器的服务)
const childContainer = new Container({
  parent: rootContainer,
  name: 'child',
});

// 子容器可以访问父容器的服务
const db = childContainer.resolve(DatabaseService);

// 子容器可以覆盖父容器的服务
childContainer.register(DatabaseService, { scope: ServiceScope.Transient });

// 动态添加子容器
const dynamicChild = new Container({ name: 'dynamic' });
rootContainer.addChild(dynamicChild);

// 更换父容器
childContainer.setParent(anotherParent);

// 销毁容器
childContainer.destroy();
```

## 作用域说明

### Singleton(单例)

- 默认作用域
- 在容器中只创建一次实例
- 后续 resolve 返回同一个实例
- 适用于无状态服务、配置对象等

```typescript
container.register(UserService); // 默认单例
container.register(UserService, { scope: ServiceScope.Singleton });
```

### Transient(瞬时)

- 每次 resolve 都创建新实例
- 适用于有状态的服务、临时对象等

```typescript
container.register(TodoService, { scope: ServiceScope.Transient });
container.registerTransient(TodoService);
```

## 循环引用解决方案

使用懒加载函数可以优雅地解决循环依赖问题:

```typescript
// ServiceA 依赖 ServiceB
class ServiceA extends Service {
  constructor(private serviceB: ServiceB) {
    super();
  }
}

// ServiceB 依赖 ServiceA (循环依赖)
class ServiceB extends Service {
  constructor(private serviceA: ServiceA) {
    super();
  }
}

// 使用懒加载函数解决循环依赖
container.register('serviceA', c => {
  const serviceB = c.resolve('serviceB');
  return new ServiceA(serviceB);
});

container.register('serviceB', c => {
  const serviceA = c.resolve('serviceA');
  return new ServiceB(serviceA);
});
```

## 迁移指南

### 从旧 API 迁移

```typescript
// 旧 API
container.register('userService', UserService, true); // 单例
container.register('todoService', TodoService, false); // 瞬时

// 新 API
container.register('userService', UserService); // 默认单例
container.register('todoService', TodoService, { scope: ServiceScope.Transient });

// 或使用便捷方法
container.registerSingleton('userService', UserService);
container.registerTransient('todoService', TodoService);
```

### 向后兼容性

新 API 完全向后兼容,旧代码无需修改即可正常工作:

```typescript
// 这些旧用法仍然有效
container.register('config', { apiUrl: 'http://api.example.com' });
container.registerInstance('settings', { theme: 'dark' });
```

## 最佳实践

1. **优先使用类作为标识符**: 更好的类型推导和重构支持

   ```typescript
   container.register(UserService);
   const service = container.resolve(UserService); // 自动类型推导
   ```

2. **使用 Symbol 避免命名冲突**: 对于字符串标识符,考虑使用 Symbol

   ```typescript
   const USER_SERVICE = Symbol('userService');
   container.register(USER_SERVICE, UserService);
   ```

3. **合理使用作用域**:

   - 无状态服务使用 Singleton
   - 有状态服务使用 Transient
   - 配置对象使用 Singleton

4. **使用懒加载解决循环依赖**: 避免在构造函数中直接依赖

   ```typescript
   container.register('service', c => new Service(c.resolve('dep')));
   ```

5. **利用树形结构**: 为不同模块创建子容器,实现服务隔离
   ```typescript
   const moduleContainer = rootContainer.createChild('module');
   ```

## 类型安全

新 API 提供完整的 TypeScript 类型支持:

```typescript
// 类型自动推导
const userService = container.resolve(UserService); // UserService 类型

// 显式类型注解
const todoService = container.resolve<TodoService>('todoService');

// 泛型约束
container.register<UserService>(UserService);
```

## 总结

重构后的 Container API 具有以下优势:

1. ✅ **更简洁**: 支持多种注册方式,代码更简洁
2. ✅ **类型安全**: 完整的 TypeScript 类型支持
3. ✅ **专门定制**: 专为 Service 设计,不支持过于通用的场景
4. ✅ **解决循环引用**: 通过懒加载函数优雅解决
5. ✅ **向后兼容**: 旧代码无需修改
6. ✅ **树形结构**: 支持父子容器,实现服务隔离
7. ✅ **作用域管理**: 清晰的 Singleton 和 Transient 作用域
