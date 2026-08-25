# Container 智能类型推导特性

## 概述

Container 的 `resolve` 和 `tryResolve` 方法现在支持智能类型推导，使用 TypeScript 函数重载实现：

- **传入类构造函数**：自动推导返回类型 ✨
- **传入字符串或 Symbol**：需要显式指定泛型

## 使用示例

### resolve 方法

```typescript
import { Container, createContainer } from '@rabjs/service';

const container = createContainer('app');

// ✅ 方式 1: 使用类作为标识符 - 自动类型推导
container.register(UserService);
const userService = container.resolve(UserService);
// ↑ userService 的类型自动推导为 UserService
// 无需写成: container.resolve<UserService>(UserService)

// ✅ 方式 2: 使用字符串标识符 - 需要显式泛型
container.register('todoService', TodoService);
const todoService = container.resolve<TodoService>('todoService');
// ↑ 必须显式指定泛型，否则类型为 Service（基类）

// ✅ 方式 3: 使用 Symbol 标识符 - 需要显式泛型
const CONFIG_SERVICE = Symbol('config');
container.register(CONFIG_SERVICE, ConfigService);
const configService = container.resolve<ConfigService>(CONFIG_SERVICE);
```

### tryResolve 方法

```typescript
// ✅ 使用类 - 自动推导为 UserService | undefined
const maybeUser = container.tryResolve(UserService);
if (maybeUser) {
  // TypeScript 知道这里 maybeUser 是 UserService 类型
  console.log(maybeUser.getName());
}

// ✅ 使用字符串 - 需要显式泛型
const maybeTodo = container.tryResolve<TodoService>('todoService');
if (maybeTodo) {
  console.log(maybeTodo.getTodos());
}
```

## 技术实现

使用 TypeScript 函数重载实现：

```typescript
class Container {
  // 重载 1: 传入类构造函数，自动推导类型
  resolve<T extends Service>(identifier: new (...args: any[]) => T): T;

  // 重载 2: 传入字符串或 Symbol，需要显式泛型
  resolve<T extends Service = Service>(identifier: string | symbol): T;

  // 实现签名
  resolve<T extends Service = Service>(identifier: ServiceIdentifier<T>): T {
    // 实现代码
  }
}
```

## 优势

### 1. 更好的开发体验

```typescript
// ❌ 旧方式：需要重复写类型
const userService = container.resolve<UserService>(UserService);

// ✅ 新方式：自动推导，更简洁
const userService = container.resolve(UserService);
```

### 2. 类型安全

```typescript
container.register(UserService);
container.register(TodoService);

const userService = container.resolve(UserService);
const todoService = container.resolve(TodoService);

// ✅ TypeScript 能正确识别类型
userService.getName(); // OK
todoService.getTodos(); // OK

// ❌ TypeScript 会在编译时报错
userService.getTodos(); // Error: Property 'getTodos' does not exist
todoService.getName(); // Error: Property 'getName' does not exist
```

### 3. 智能提示

IDE 能够提供更准确的代码补全和类型提示：

```typescript
const userService = container.resolve(UserService);
userService. // IDE 会自动提示 UserService 的所有方法
```

## 最佳实践

### 推荐：使用类作为标识符

```typescript
// ✅ 推荐：使用类作为标识符，享受自动类型推导
container.register(UserService);
container.register(TodoService);

const userService = container.resolve(UserService);
const todoService = container.resolve(TodoService);
```

### 使用字符串标识符的场景

当需要使用字符串标识符时（如避免循环依赖），记得显式指定泛型：

```typescript
// 使用字符串标识符注册
container.register('userService', UserService);

// ✅ 显式指定泛型
const userService = container.resolve<UserService>('userService');

// ⚠️ 不指定泛型，类型为 Service（基类）
const service = container.resolve('userService'); // 类型: Service
```

### 在 Inject 装饰器中使用

```typescript
class TodoService extends Service {
  // ✅ 使用类 - 自动推导
  @Inject(UserService)
  private userService!: UserService;

  // ✅ 使用字符串 - 需要显式类型注解
  @Inject('configService')
  private configService!: ConfigService;
}
```

## 向后兼容

这个特性完全向后兼容，现有代码无需修改：

```typescript
// 旧代码仍然可以正常工作
const userService = container.resolve<UserService>(UserService);
const todoService = container.resolve<TodoService>('todoService');

// 新代码可以省略不必要的泛型
const userService = container.resolve(UserService); // 更简洁
```

## 类型推导规则总结

| 标识符类型 | 是否需要泛型 | 示例                                            |
| ---------- | ------------ | ----------------------------------------------- |
| 类构造函数 | ❌ 不需要    | `container.resolve(UserService)`                |
| 字符串     | ✅ 需要      | `container.resolve<UserService>('userService')` |
| Symbol     | ✅ 需要      | `container.resolve<UserService>(USER_SERVICE)`  |

## 测试覆盖

新增了专门的类型推导测试文件 `type-inference.test.ts`，包含：

- ✅ resolve 方法类型推导测试
- ✅ tryResolve 方法类型推导测试
- ✅ 混合使用场景测试
- ✅ 类型安全性验证测试

所有测试均通过，确保类型推导功能正常工作。
