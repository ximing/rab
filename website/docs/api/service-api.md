---
sidebar_position: 2
---

# @rabjs/service API

服务和依赖注入容器 API 文档。

## 核心类

### `Service`

基础服务类。所有服务都应继承此类。

**核心特性：**

- 默认 observable，所有属性和状态都是响应式的
- 所有方法默认都是 action（自动批量更新，同步和异步方法都支持）
- 支持使用 `@SyncAction` 装饰器排除特定方法
- 自动为所有方法创建 loading 和 error 状态（通过 `$model` 属性访问）
- 支持异步方法的状态追踪
- 完整的 TypeScript 类型推导
- 支持事件系统（容器级别和全局级别）
- 轻量级实现，不依赖 inversify

**属性：**

- `$model: ExtractMethods<this>` - 响应式状态对象，包含所有方法的 loading 和 error 状态

**示例：**

```typescript
import { Service } from '@rabjs/service';

class UserService extends Service {
  users = [];

  // 所有方法默认都是 action，自动追踪 loading 和 error 状态
  async fetchUsers() {
    const response = await fetch('/api/users');
    this.users = await response.json();
  }

  addUser(name: string) {
    this.users.push({ id: Date.now(), name });
  }

  // 使用 @SyncAction 排除批量更新
  @SyncAction
  directUpdate() {
    this.users = [];
  }
}

// 使用
const service = new UserService();
console.log(service.$model.fetchUsers.loading); // false
console.log(service.$model.fetchUsers.error); // null

await service.fetchUsers();
```

---

### Service 实例方法

#### `on<T>(eventName: string, handler: (data: T) => void, scope?: EventScope): this`

监听事件。

**参数：**

- `eventName: string` - 事件名称
- `handler: (data: T) => void` - 事件处理函数
- `scope?: EventScope` - 事件作用域，默认为 `'container'`（容器级别），可选 `'global'`（全局）

**返回值：**

- `this` - 返回当前实例，支持链式调用

**示例：**

```typescript
class UserService extends Service {
  constructor() {
    super();

    // 监听容器级别事件（默认）
    this.on('user:login', user => {
      console.log('User logged in:', user);
    });

    // 监听全局事件
    this.on(
      'app:initialized',
      () => {
        console.log('App initialized');
      },
      'global'
    );
  }
}
```

---

#### `once<T>(eventName: string, handler: (data: T) => void, scope?: EventScope): this`

监听一次性事件（触发一次后自动移除）。

**参数：**

- `eventName: string` - 事件名称
- `handler: (data: T) => void` - 事件处理函数
- `scope?: EventScope` - 事件作用域，默认为 `'container'`（容器级别），可选 `'global'`（全局）

**返回值：**

- `this` - 返回当前实例，支持链式调用

**示例：**

```typescript
class UserService extends Service {
  constructor() {
    super();

    // 监听容器级别一次性事件
    this.once('data:loaded', data => {
      console.log('Data loaded:', data);
    });

    // 监听全局一次性事件
    this.once(
      'app:ready',
      () => {
        console.log('App ready');
      },
      'global'
    );
  }
}
```

---

#### `off(eventName: string, handler?: Function, scope?: EventScope): this`

移除事件监听器。

**参数：**

- `eventName: string` - 事件名称
- `handler?: Function` - 事件处理函数（可选，如果不提供则移除该事件的所有监听器）
- `scope?: EventScope` - 事件作用域，默认为 `'container'`（容器级别），可选 `'global'`（全局）

**返回值：**

- `this` - 返回当前实例，支持链式调用

**示例：**

```typescript
class UserService extends Service {
  private loginHandler = (user: any) => {
    console.log('User logged in:', user);
  };

  constructor() {
    super();
    this.on('user:login', this.loginHandler);
  }

  destroy() {
    // 移除特定监听器
    this.off('user:login', this.loginHandler);

    // 移除事件的所有监听器
    this.off('user:login');

    super.destroy();
  }
}
```

---

#### `emit<T>(eventName: string, data?: T, scope?: EventScope): this`

发送事件。

**参数：**

- `eventName: string` - 事件名称
- `data?: T` - 事件数据（可选）
- `scope?: EventScope` - 事件作用域，默认为 `'container'`（容器级别），可选 `'global'`（全局）

**返回值：**

- `this` - 返回当前实例，支持链式调用

**示例：**

```typescript
class UserService extends Service {
  login(username: string, password: string) {
    // 登录逻辑...
    const user = { id: 1, name: username };

    // 发送容器级别事件
    this.emit('user:login', user);

    // 发送全局事件
    this.emit('app:user-logged-in', user, 'global');
  }

  logout() {
    // 登出逻辑...
    this.emit('user:logout');
  }
}
```

---

#### `destroy(): void`

销毁 Service 实例，清理所有装饰器绑定的事件和资源。

**清理内容包括：**

- `@On` 和 `@Once` 装饰器绑定的事件监听器
- `@Debounce` 装饰器的定时器
- `@Throttle` 装饰器的定时器
- `@Memo` 装饰器的缓存和响应式追踪

**示例：**

```typescript
class UserService extends Service {
  @On('user:login')
  onUserLogin(user: any) {
    this.currentUser = user;
  }

  @Debounce(300)
  search(keyword: string) {
    return fetch(`/api/search?q=${keyword}`);
  }

  @Memo()
  get totalAge() {
    return this.users.reduce((sum, user) => sum + user.age, 0);
  }
}

const service = new UserService();
// ... 使用 service ...
service.destroy(); // 清理所有资源
```

---

## 装饰器

### `@Action`

标记一个方法为 action（可选装饰器）。

**注意：** 在 Service 中，所有方法默认都是 action，除非使用 `@SyncAction` 装饰器。此装饰器主要用于显式标记。

**示例：**

```typescript
import { Service, Action } from '@rabjs/service';

class DataService extends Service {
  data = null;

  @Action
  async fetchData(url: string) {
    const response = await fetch(url);
    this.data = await response.json();
  }
}
```

---

### `@SyncAction`

标记一个方法排除 action 批量更新。

**特性：**

- 排除批量更新机制
- 直接同步执行

**示例：**

```typescript
import { Service, SyncAction } from '@rabjs/service';

class CounterService extends Service {
  count = 0;

  @SyncAction
  increment() {
    this.count++;
  }

  @SyncAction
  decrement() {
    this.count--;
  }
}
```

---

### `@Inject`

依赖注入装饰器，用于在 Service 类中自动注入依赖。

**核心特性：**

- 支持从当前 Service 所属的容器自动解析依赖
- 支持类型安全的依赖注入
- 支持链式依赖解析
- 只能注入 Service 类型的依赖
- 使用 getter/setter 实现懒加载，首次访问时才解析

**参数：**

- `identifier: ServiceIdentifier<T>` - 服务标识符（类、字符串或 Symbol）

**示例：**

```typescript
import { Service, Inject } from '@rabjs/service';

// 基础用法：从当前 Service 的容器解析
class UserService extends Service {
  @Inject(LoggerService)
  private logger!: LoggerService;

  getUser(id: string) {
    this.logger.log(`Getting user ${id}`);
    return { id, name: 'Alice' };
  }
}

// 使用字符串标识符
class UserService extends Service {
  @Inject('userRepository')
  private userRepository!: UserRepository;
}

// 使用 Symbol 标识符
const USER_REPO = Symbol('UserRepository');
class UserService extends Service {
  @Inject(USER_REPO)
  private userRepository!: UserRepository;
}
```

---

### `@Debounce`

防抖装饰器，用于延迟执行方法。在连续触发时，只在最后一次触发后的指定时间执行。

**参数：**

- `wait: number` - 延迟时间（毫秒）
- `options?: DebounceOptions` - 配置选项
  - `leading?: boolean` - 是否在延迟开始前调用函数，默认 `false`
  - `trailing?: boolean` - 是否在延迟结束后调用函数，默认 `true`
  - `maxWait?: number` - 最大等待时间（毫秒），超过此时间必须执行一次

**示例：**

```typescript
import { Service, Debounce } from '@rabjs/service';

class SearchService extends Service {
  @Debounce(300)
  search(keyword: string) {
    // 300ms 内多次调用只执行最后一次
    return fetch(`/api/search?q=${keyword}`);
  }

  @Debounce(500, { leading: true, trailing: false })
  handleInput(value: string) {
    // 首次立即执行，后续调用被防抖
  }

  destroy() {
    // 清理所有 Debounce 定时器
    cleanupAllDebounces(this);
  }
}
```

**相关函数：**

- `cancelDebounce(instance, propertyKey)` - 手动清理指定方法的 Debounce 定时器
- `cleanupAllDebounces(instance)` - 清理实例上所有 Debounce 装饰器的定时器

---

### `@Throttle`

节流装饰器，用于限制方法执行频率。在指定时间窗口内，最多执行一次函数。

**参数：**

- `wait: number` - 时间窗口（毫秒）
- `options?: ThrottleOptions` - 配置选项
  - `leading?: boolean` - 是否在时间窗口开始时立即执行，默认 `true`
  - `trailing?: boolean` - 是否在时间窗口结束时执行最后一次调用，默认 `true`

**示例：**

```typescript
import { Service, Throttle } from '@rabjs/service';

class ScrollService extends Service {
  @Throttle(200)
  handleScroll(event: Event) {
    // 每 200ms 最多执行一次
    console.log('Scroll position:', window.scrollY);
  }

  @Throttle(1000, { leading: false, trailing: true })
  saveData(data: any) {
    // 时间窗口结束时执行最后一次调用
    return fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
  }

  destroy() {
    // 清理所有 Throttle 定时器
    cleanupAllThrottles(this);
  }
}
```

**相关函数：**

- `cancelThrottle(instance, propertyKey)` - 手动清理指定方法的 Throttle 定时器
- `cleanupAllThrottles(instance)` - 清理实例上所有 Throttle 装饰器的定时器

---

### `@Memo`

缓存装饰器，用于对 getter 方法进行缓存优化。只有当依赖的响应式数据发生变化时，才会重新计算。

**核心特性：**

- 自动追踪 getter 中访问的响应式依赖
- 依赖变化时自动失效缓存
- 每个实例独立缓存
- 完整的 TypeScript 类型支持

**注意事项：**

- 只能用于 getter 方法
- getter 中访问的数据必须是响应式的（Service 的属性自动是响应式的）

**参数：**

- `options?: MemoOptions` - 配置选项
  - `key?: string` - 自定义缓存键生成函数，默认使用 getter 名称作为缓存键

**示例：**

```typescript
import { Service, Memo } from '@rabjs/service';

class UserService extends Service {
  users = [
    { id: 1, name: 'Alice', age: 25 },
    { id: 2, name: 'Bob', age: 30 },
  ];

  // 基础用法：缓存计算结果
  @Memo()
  get totalAge() {
    console.log('计算 totalAge');
    return this.users.reduce((sum, user) => sum + user.age, 0);
  }

  // 自定义缓存键
  @Memo({ key: 'custom-key' })
  get expensiveComputation() {
    return this.users.map(u => u.name).join(', ');
  }
}

const service = new UserService();
console.log(service.totalAge); // 输出: "计算 totalAge" 和 55
console.log(service.totalAge); // 直接返回缓存的 55，不会重新计算

// 修改依赖数据
service.users.push({ id: 3, name: 'Charlie', age: 35 });
console.log(service.totalAge); // 输出: "计算 totalAge" 和 90，重新计算
```

**相关函数：**

- `invalidateMemo(instance, propertyKey)` - 手动失效指定 getter 的缓存
- `cleanupAllMemos(instance)` - 清理实例上所有 Memo 装饰器的缓存和 reaction

---

### `@On`

事件监听装饰器，用于在 Service 中绑定事件监听器。

**核心特性：**

- 支持全局事件（使用全局容器的事件系统）和容器级别事件（使用当前容器的事件系统）
- 自动在 Service 初始化时绑定监听器
- 自动在 Service 销毁时移除监听器
- 支持多个事件监听
- 完整的 TypeScript 类型推导

**参数：**

- `eventName: string` - 事件名称
- `options?: OnOptions` - 配置选项
  - `scope?: EventScope` - 事件作用域，默认为 `'container'`（容器级别），可选 `'global'`（全局）

**示例：**

```typescript
import { Service, On } from '@rabjs/service';

class UserService extends Service {
  // 监听全局事件（使用全局容器的事件系统）
  @On('user:login', { scope: 'global' })
  onUserLogin(user: { id: number; name: string }) {
    console.log('User logged in:', user);
    this.currentUser = user;
  }

  // 监听容器级别事件（使用当前容器的事件系统，默认）
  @On('data:update')
  onDataUpdate(data: any) {
    console.log('Data updated:', data);
    this.data = data;
  }

  // 销毁时自动移除监听器
  destroy() {
    super.destroy();
  }
}
```

**相关函数：**

- `getEventListenerMetadata(target)` - 获取类的事件监听元数据
- `isEventListener(target, propertyKey)` - 检查方法是否被 @On 装饰
- `setupEventListeners(service, container?)` - 为 Service 实例绑定所有事件监听器
- `cleanupEventListeners(service)` - 移除 Service 实例的所有事件监听器
- `cleanupAllEventListeners(...services)` - 移除所有 Service 实例的事件监听器

---

### `@Once`

一次性事件监听装饰器，用于在 Service 中绑定一次性事件监听器。

**核心特性：**

- 支持全局事件和容器级别事件的一次性监听
- 事件触发一次后自动移除监听器
- 自动在 Service 初始化时绑定监听器
- 自动在 Service 销毁时移除未触发的监听器
- 支持多个一次性事件监听
- 完整的 TypeScript 类型推导

**参数：**

- `eventName: string` - 事件名称
- `options?: OnceOptions` - 配置选项
  - `scope?: EventScope` - 事件作用域，默认为 `'container'`（容器级别），可选 `'global'`（全局）

**示例：**

```typescript
import { Service, Once } from '@rabjs/service';

class UserService extends Service {
  // 监听全局一次性事件（使用全局容器的事件系统）
  @Once('app:initialized', { scope: 'global' })
  onAppInitialized() {
    console.log('App initialized');
    this.isInitialized = true;
  }

  // 监听容器级别一次性事件（使用当前容器的事件系统，默认）
  @Once('data:loaded')
  onDataLoaded(data: any) {
    console.log('Data loaded:', data);
    this.data = data;
  }

  // 销毁时自动移除未触发的监听器
  destroy() {
    super.destroy();
  }
}
```

---

### `getInjectMetadata(target)`

获取类的注入元数据。

**参数：**

- `target: any` - 目标类

**返回值：**

- `Map<string | symbol, any>` - 注入元数据

**示例：**

```typescript
import { Service, Inject, getInjectMetadata } from '@rabjs/service';

class MyService extends Service {
  @Inject(SomeDependency)
  private dep!: SomeDependency;
}

const metadata = getInjectMetadata(MyService.prototype);
console.log(metadata); // Map { 'dep' => { identifier: SomeDependency } }
```

---

### `isInjected(target, propertyKey)`

检查一个属性是否被标记为注入。

**参数：**

- `target: any` - 目标类
- `propertyKey: string | symbol` - 属性名

**返回值：**

- `boolean` - 如果被标记为注入返回 true

**示例：**

```typescript
import { Service, Inject, isInjected } from '@rabjs/service';

class MyService extends Service {
  @Inject(SomeDependency)
  private dep!: SomeDependency;

  normalProp = 'value';
}

console.log(isInjected(MyService.prototype, 'dep')); // true
console.log(isInjected(MyService.prototype, 'normalProp')); // false
```

---

## IOC 容器

### `Container`

专门为 Service 定制的 IoC 容器。

**核心特性：**

- 三种注册方式：使用类作为标识符、使用自定义标识符、使用懒加载函数（解决循环引用）
- 生命周期管理：支持单例（Singleton）和瞬时（Transient）作用域
- 树形结构：支持父子容器，子容器可继承父容器的服务
- 动态调整：支持动态添加/移除子容器，支持容器重新挂载
- 依赖注入：自动解析依赖关系
- 销毁管理：支持容器销毁时的清理回调
- 分层检索：支持从子容器向上查找服务
- 实例追踪：通过 WeakMap 建立实例和容器的关系
- 事件系统：每个容器拥有独立的事件发射器

**构造函数：**

```typescript
constructor(options?: ContainerOptions)
```

**ContainerOptions 配置：**

```typescript
interface ContainerOptions {
  // 父容器（用于分层容器）
  parent?: Container;

  // 容器名称（用于调试和全局注册）
  name?: string | Symbol;
}
```

**主要方法：**

#### `register(identifierOrClass, classOrFactory?, options?)`

注册一个服务。支持三种用法。

**参数：**

- `identifierOrClass: ServiceIdentifier | ServiceClass` - 服务标识符或 Service 类
- `classOrFactory?: ServiceClass | ServiceFactory | RegisterOptions` - Service 类或工厂函数（可选）
- `options?: RegisterOptions` - 注册选项（可选）
  - `scope?: ServiceScope` - 服务作用域，默认为 `ServiceScope.Singleton`

**示例：**

```typescript
import { Container, ServiceScope } from '@rabjs/service';

const container = new Container({ name: 'root' });

// 用法 1: 使用类作为标识符
container.register(UserService);
container.register(UserService, { scope: ServiceScope.Singleton });

// 用法 2: 使用自定义标识符
container.register('userService', UserService);
container.register(Symbol('userService'), UserService, { scope: ServiceScope.Transient });

// 用法 3: 使用懒加载函数（解决循环引用）
container.register('userService', container => new UserService());
container.register('userService', container => container.resolve(AnotherService));
```

---

#### `registerSingleton(identifierOrClass, classOrFactory?)`

注册单例服务（快捷方法）。

**示例：**

```typescript
container.registerSingleton(UserService);
container.registerSingleton('userService', UserService);
```

---

#### `registerTransient(identifierOrClass, classOrFactory?)`

注册瞬时服务（每次解析都创建新实例）。

**示例：**

```typescript
container.registerTransient(UserService);
container.registerTransient('userService', UserService);
```

---

#### `resolve<T>(identifier)`

解析一个服务实例。支持分层检索：先查找当前容器，再查找父容器。

**参数：**

- `identifier: ServiceIdentifier<T>` - 服务标识符

**返回值：**

- `T` - 服务实例

**示例：**

```typescript
// 使用类作为标识符（自动推导类型）
const userService = container.resolve(UserService); // 自动推导为 UserService 类型

// 使用字符串或 Symbol（需要显式指定泛型）
const userService = container.resolve<UserService>('userService');
```

---

#### `tryResolve<T>(identifier)`

尝试解析服务，如果不存在返回 undefined。

**参数：**

- `identifier: ServiceIdentifier<T>` - 服务标识符

**返回值：**

- `T | undefined` - 服务实例或 undefined

**示例：**

```typescript
const userService = container.tryResolve(UserService); // UserService | undefined
const userService2 = container.tryResolve<UserService>('userService');
```

---

#### `has(identifier)`

检查服务是否已注册。支持递归查找：先查找当前容器，再查找父容器。

**参数：**

- `identifier: ServiceIdentifier` - 服务标识符

**返回值：**

- `boolean` - 如果已注册返回 true

**示例：**

```typescript
if (container.has(UserService)) {
  const service = container.resolve(UserService);
}
```

---

#### `unregister(identifier)`

注销服务。

**参数：**

- `identifier: ServiceIdentifier` - 服务标识符

**返回值：**

- `boolean` - 如果注销成功返回 true

---

#### `createChild(name?)`

创建一个子容器。

**参数：**

- `name?: string | Symbol` - 子容器名称（可选）

**返回值：**

- `Container` - 新的子容器

**示例：**

```typescript
const parentContainer = new Container({ name: 'parent' });
const childContainer = parentContainer.createChild('child');

// 子容器可以访问父容器的服务
// 但父容器无法访问子容器的服务
```

---

#### `addChild(child)`

动态添加一个现有的容器成为当前容器的子节点。

**参数：**

- `child: Container` - 要添加的子容器

**返回值：**

- `this` - 返回当前容器实例，支持链式调用

**示例：**

```typescript
const parentContainer = new Container({ name: 'parent' });
const childContainer = new Container({ name: 'child' });

// 动态添加子容器
parentContainer.addChild(childContainer);
```

---

#### `removeChild(child)`

从当前容器中移除一个子容器。

**参数：**

- `child: Container` - 要移除的子容器

**返回值：**

- `boolean` - 如果移除成功返回 true

---

#### `removeParent()`

移除当前容器的 parent 绑定关系，将容器变为根容器。

**返回值：**

- `this` - 返回当前容器实例，支持链式调用

---

#### `setParent(newParent?)`

更换容器的父容器。

**参数：**

- `newParent?: Container` - 新的父容器，如果为 undefined 则将容器变为根容器

**返回值：**

- `this` - 返回当前容器实例，支持链式调用

---

#### `destroy()`

销毁容器及其所有服务。

**清理内容包括：**

- 销毁所有子容器
- 调用所有 Service 实例的 destroy 方法
- 清理所有服务实例
- 清理容器级别的事件监听器
- 从父容器中移除自己

**示例：**

```typescript
const container = new Container();
// ... 使用容器 ...
container.destroy(); // 清理资源
```

---

#### `isDestroyed()`

检查容器是否已销毁。

**返回值：**

- `boolean` - 如果已销毁返回 true

---

#### `getName()`

获取容器名称。

**返回值：**

- `string | Symbol` - 容器名称

---

#### `getParent()`

获取父容器。

**返回值：**

- `Container | undefined` - 父容器实例

---

#### `getChildren()`

获取所有子容器。

**返回值：**

- `Container[]` - 子容器数组

---

#### `getPath()`

获取容器的完整路径（用于调试）。

**返回值：**

- `string | Symbol` - 容器路径

---

#### `getServiceIdentifiers()`

获取所有已注册的服务标识符。

**返回值：**

- `ServiceIdentifier[]` - 服务标识符数组

---

#### `Container.getContainerOf(instance)` (静态方法)

通过 Service 实例获取对应的容器。

**参数：**

- `instance: object` - Service 实例

**返回值：**

- `Container | undefined` - 容器实例

**示例：**

```typescript
const userService = container.resolve(UserService);
const containerOfService = Container.getContainerOf(userService);
```

---

### 全局函数

#### `register(identifierOrClass, classOrFactoryOrOptions?, optionsOrContainer?, container?)`

全局注册服务。如果不传入容器，默认使用全局容器。

**示例：**

```typescript
import { register } from '@rabjs/service';

// 用法 1: 使用类作为标识符
register(UserService);
register(UserService, { scope: ServiceScope.Singleton });

// 用法 2: 使用自定义标识符
register('userService', UserService);

// 用法 3: 使用懒加载函数
register('userService', container => new UserService());

// 指定容器
const container = new Container({ name: 'custom' });
register(UserService, undefined, container);
```

---

#### `resolve<T>(identifier, container?)`

全局解析服务。如果不传入容器，默认使用全局容器。

**示例：**

```typescript
import { resolve } from '@rabjs/service';

// 使用类作为标识符
const userService = resolve(UserService); // 自动推导为 UserService 类型

// 使用自定义标识符
const userService = resolve<UserService>('userService');

// 指定容器
const container = new Container({ name: 'custom' });
const userService = resolve(UserService, container);
```

---

#### `has(identifier, container?)`

检查服务是否已注册。如果不传入容器，默认使用全局容器。

**示例：**

```typescript
import { has } from '@rabjs/service';

if (has(UserService)) {
  const userService = resolve(UserService);
}
```

---

#### `getGlobalContainer()`

获取全局容器实例。

**返回值：**

- `Container` - 全局容器实例

---

#### `resetGlobalContainer()`

重置全局容器（用于测试）。

---

### `EventSystem`

事件系统类，基于 eventemitter3 实现，支持全局和容器级别的事件管理。

**核心特性：**

- 支持全局事件（使用全局容器的事件系统）
- 支持容器级别事件（使用容器自己的事件系统）
- 自动管理事件监听器的生命周期

**静态方法：**

#### `EventSystem.getGlobalEvents()`

获取全局事件发射器（使用全局容器的事件系统）。

**返回值：**

- `EventEmitter` - 全局事件发射器实例

---

#### `EventSystem.getContainerEvents(container)`

获取容器级别的事件发射器。

**参数：**

- `container: Container` - 容器实例

**返回值：**

- `EventEmitter` - 容器级别的事件发射器实例

---

#### `EventSystem.getEmitter(scope, container?)`

根据作用域获取对应的事件发射器。

**参数：**

- `scope: EventScope` - 事件作用域
- `container?: Container` - 容器实例（当 scope 为 'container' 时必需）

**返回值：**

- `EventEmitter` - 对应的事件发射器实例

---

#### `EventSystem.clearAllGlobalEvents()`

清理所有全局事件。通常在应用关闭时调用。

---

## 类型定义

### `MethodState`

方法执行状态。

```typescript
interface MethodState {
  // 是否正在加载
  loading: boolean;

  // 错误信息
  error: Error | null;
}
```

### `ExtractMethods`

提取服务中所有方法的类型，将方法转换为对应的状态对象类型。

```typescript
type ExtractMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? MethodState : never;
};
```

### `ServiceIdentifier`

服务标识符类型。

```typescript
type ServiceIdentifier<T = any> = string | symbol | (new (...args: any[]) => T);
```

### `ServiceClass`

服务类类型。

```typescript
type ServiceClass<T = any> = new (...args: any[]) => T;
```

### `ServiceFactory`

服务工厂函数类型（用于解决循环引用）。

```typescript
type ServiceFactory<T = any> = (container: IContainer) => T;
```

### `ServiceScope`

服务作用域枚举。

```typescript
enum ServiceScope {
  Singleton = 'singleton',
  Transient = 'transient',
}
```

### `RegisterOptions`

注册选项类型。

```typescript
interface RegisterOptions {
  scope?: ServiceScope;
}
```

### `ContainerOptions`

容器选项类型。

```typescript
interface ContainerOptions {
  parent?: Container;
  name?: string | Symbol;
}
```

### `EventScope`

事件作用域类型。

```typescript
type EventScope = 'global' | 'container';
```

### `EventSystemOptions`

事件系统配置选项。

```typescript
interface EventSystemOptions {
  scope?: EventScope;
}
```

### `DebounceOptions`

Debounce 装饰器配置选项。

```typescript
interface DebounceOptions {
  wait: number;
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}
```

### `ThrottleOptions`

Throttle 装饰器配置选项。

```typescript
interface ThrottleOptions {
  wait: number;
  leading?: boolean;
  trailing?: boolean;
}
```

### `MemoOptions`

Memo 装饰器配置选项。

```typescript
interface MemoOptions {
  key?: string;
}
```

### `OnOptions`

On 装饰器配置选项。

```typescript
interface OnOptions {
  scope?: EventScope;
}
```

### `OnceOptions`

Once 装饰器配置选项。

```typescript
interface OnceOptions {
  scope?: EventScope;
}
```

### `DestroyCallback`

销毁回调函数类型。

```typescript
type DestroyCallback = () => void;
```

---

## 使用示例

### 基础服务定义

```typescript
import { Service } from '@rabjs/service';

class TodoService extends Service {
  todos = [];

  // 所有方法默认都是 action，自动追踪 loading 和 error 状态
  addTodo(title: string) {
    this.todos.push({
      id: Date.now(),
      title,
      completed: false,
    });
  }

  toggleTodo(id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }

  async saveTodos() {
    await fetch('/api/todos', {
      method: 'POST',
      body: JSON.stringify(this.todos),
    });
  }
}

// 使用
const todoService = new TodoService();
console.log(todoService.$model.saveTodos.loading); // false
console.log(todoService.$model.saveTodos.error); // null

await todoService.saveTodos();
```

### 依赖注入

```typescript
import { Service, Inject, Container } from '@rabjs/service';

class LoggerService extends Service {
  log(message: string) {
    console.log(`[LOG] ${message}`);
  }
}

class UserService extends Service {
  @Inject(LoggerService)
  private logger!: LoggerService;

  getUser(id: string) {
    this.logger.log(`Getting user ${id}`);
    return { id, name: 'Alice' };
  }
}

// 使用
const container = new Container({ name: 'app' });
container.register(LoggerService);
container.register(UserService);

const userService = container.resolve(UserService);
userService.getUser('1');
```

### 容器管理

```typescript
import { Container, ServiceScope } from '@rabjs/service';

const container = new Container({ name: 'root' });

// 注册服务
container.register(LoggerService);
container.register(UserService, { scope: ServiceScope.Singleton });

// 解析服务
const userService = container.resolve(UserService);
userService.getUser('1');

// 创建子容器
const requestContainer = container.createChild('request');
const requestUserService = requestContainer.resolve(UserService);

// 清理
container.destroy();
```

### 事件系统

```typescript
import { Service, On, Once } from '@rabjs/service';

class UserService extends Service {
  currentUser = null;

  // 使用装饰器监听事件
  @On('user:login')
  onUserLogin(user: any) {
    this.currentUser = user;
  }

  @Once('app:initialized', { scope: 'global' })
  onAppInitialized() {
    console.log('App initialized');
  }

  login(username: string, password: string) {
    const user = { id: 1, name: username };

    // 发送事件
    this.emit('user:login', user);
    this.emit('app:user-logged-in', user, 'global');
  }
}
```

### 装饰器使用

```typescript
import { Service, Debounce, Throttle, Memo } from '@rabjs/service';

class SearchService extends Service {
  users = [
    { id: 1, name: 'Alice', age: 25 },
    { id: 2, name: 'Bob', age: 30 },
  ];

  // 防抖：300ms 内多次调用只执行最后一次
  @Debounce(300)
  search(keyword: string) {
    return fetch(`/api/search?q=${keyword}`);
  }

  // 节流：每 200ms 最多执行一次
  @Throttle(200)
  handleScroll(event: Event) {
    console.log('Scroll position:', window.scrollY);
  }

  // 缓存：只有当依赖的响应式数据发生变化时，才会重新计算
  @Memo()
  get totalAge() {
    return this.users.reduce((sum, user) => sum + user.age, 0);
  }

  destroy() {
    super.destroy(); // 清理所有装饰器绑定的资源
  }
}
```

---

## 最佳实践

1. **使用接口定义服务契约**：便于测试和维护

2. **合理使用单例模式**：避免创建过多实例

3. **及时清理容器**：调用 `destroy()` 释放资源

4. **使用分层容器**：在 Web 应用中为每个请求创建子容器

5. **避免循环依赖**：设计清晰的依赖关系

6. **使用可选注入**：处理可能不存在的依赖

---

## 常见问题

**Q: 如何处理循环依赖？**

A: 避免循环依赖。如果必须，可以使用工厂函数延迟解析。

**Q: 单例模式如何工作？**

A: 启用单例模式后，容器会缓存服务实例，多次解析返回同一实例。

**Q: 如何测试使用依赖注入的服务？**

A: 创建测试容器，注册 mock 服务替代真实服务。

**Q: 支持异步初始化吗？**

A: 支持，在工厂函数中返回 Promise。
