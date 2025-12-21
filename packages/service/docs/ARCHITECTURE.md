# Container 架构设计

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Container 容器系统                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              全局容器 (Global Container)              │   │
│  │  - 应用级别的全局服务                                 │   │
│  │  - 配置、日志、工具等                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ▲                                   │
│                           │ parent                            │
│                           │                                   │
│  ┌────────────────────────┴────────────────────────────┐    │
│  │                                                      │    │
│  ▼                                                      ▼    │
│ ┌──────────────────┐                    ┌──────────────────┐│
│ │  用户模块容器     │                    │  订单模块容器     ││
│ │  (User Module)   │                    │ (Order Module)   ││
│ │                  │                    │                  ││
│ │ - userService    │                    │ - orderService   ││
│ │ - userRepository │                    │ - orderRepository││
│ └──────────────────┘                    └──────────────────┘│
│         ▲                                        ▲           │
│         │ parent                                 │ parent    │
│         │                                        │           │
│  ┌──────┴──────┐                         ┌──────┴──────┐   │
│  │             │                         │             │   │
│  ▼             ▼                         ▼             ▼   │
│ ┌──────┐   ┌──────┐                   ┌──────┐   ┌──────┐ │
│ │User  │   │User  │                   │Order │   │Order │ │
│ │List  │   │Detail│                   │List  │   │Detail│ │
│ │Comp  │   │Comp  │                   │Comp  │   │Comp  │ │
│ └──────┘   └──────┘                   └──────┘   └──────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 类结构

```typescript
┌─────────────────────────────────────────────────────────┐
│                    Container 类                          │
├─────────────────────────────────────────────────────────┤
│ 属性:                                                    │
│  - services: Map<ServiceIdentifier, ServiceDefinition>  │
│  - parent?: Container                                   │
│  - children: Set<Container>                             │
│  - name: string                                         │
│  - destroyCallbacks: DestroyCallback[]                  │
│  - destroyed: boolean                                   │
├─────────────────────────────────────────────────────────┤
│ 公共方法:                                                │
│  + register(id, factory, singleton?)                    │
│  + registerSingleton(id, factory)                       │
│  + registerTransient(id, factory)                       │
│  + registerInstance(id, instance)                       │
│  + resolve<T>(id): T                                    │
│  + tryResolve<T>(id): T | undefined                     │
│  + has(id): boolean                                     │
│  + unregister(id): boolean                              │
│  + createChild(name?): Container                        │
│  + getParent(): Container | undefined                   │
│  + getChildren(): Container[]                           │
│  + getPath(): string                                    │
│  + getStats(): Stats                                    │
│  + onDestroy(callback): this                            │
│  + destroy(): Promise<void>                             │
│  + isDestroyed(): boolean                               │
├─────────────────────────────────────────────────────────┤
│ 私有方法:                                                │
│  - getServiceDefinition(id): ServiceDefinition          │
│  - instantiate<T>(definition): T                        │
│  - isClass(func): boolean                               │
│  - callDestroyCallbacks(instances): void                │
└─────────────────────────────────────────────────────────┘
```

## 服务定义结构

```typescript
┌──────────────────────────────────────────────────────┐
│           ServiceDefinition<T> 接口                   │
├──────────────────────────────────────────────────────┤
│ identifier: ServiceIdentifier<T>                     │
│   ↓ 服务的唯一标识符（字符串、符号或函数）           │
│                                                      │
│ factory: ServiceFactory<T> | T                       │
│   ↓ 工厂函数或实例                                   │
│   ├─ ServiceFactory<T> = (container: Container) => T│
│   └─ T = 直接的实例对象                              │
│                                                      │
│ singleton: boolean                                   │
│   ↓ 是否为单例                                       │
│   ├─ true: 缓存实例，所有解析返回同一实例            │
│   └─ false: 每次解析创建新实例                       │
│                                                      │
│ instance?: T                                         │
│   ↓ 缓存的实例（仅单例）                             │
│                                                      │
│ dependencies?: ServiceIdentifier[]                   │
│   ↓ 依赖的服务标识符（预留字段）                     │
└──────────────────────────────────────────────────────┘
```

## 服务解析流程

```
┌─────────────────────────────────────────────────────────────┐
│                    resolve<T>(id)                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  检查容器是否销毁     │
                └──────────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                   是             否
                    │             │
                    ▼             ▼
              ┌─────────┐   ┌──────────────────┐
              │ 抛出错误 │   │ getServiceDef()  │
              └─────────┘   └──────────────────┘
                                   │
                            ┌──────┴──────┐
                            │             │
                          找到           未找到
                            │             │
                            ▼             ▼
                    ┌──────────────┐  ┌─────────┐
                    │ instantiate()│  │ 抛出错误 │
                    └──────────────┘  └─────────┘
                            │
                    ┌───────┴────────┐
                    │                │
                  单例              瞬时
                    │                │
            ┌───────┴────────┐       │
            │                │       │
          有缓存            无缓存     │
            │                │       │
            ▼                ▼       ▼
        ┌────────┐    ┌──────────┐ ┌──────────┐
        │返回缓存 │    │创建实例  │ │创建实例  │
        │实例    │    │并缓存    │ │不缓存    │
        └────────┘    └──────────┘ └──────────┘
            │                │       │
            └────────┬───────┴───────┘
                     │
                     ▼
            ┌──────────────────┐
            │  返回实例 <T>     │
            └──────────────────┘
```

## 分层查找流程

```
┌─────────────────────────────────────────────────────────────┐
│         getServiceDefinition(id) - 分层查找                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ 在当前容器查找服务    │
                └──────────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                  找到           未找到
                    │             │
                    ▼             ▼
            ┌──────────────┐  ┌──────────────┐
            │返回定义      │  │检查父容器    │
            └──────────────┘  └──────────────┘
                                     │
                              ┌──────┴──────┐
                              │             │
                            有父           无父
                              │             │
                              ▼             ▼
                    ┌──────────────────┐ ┌─────────┐
                    │递归查找父容器    │ │返回 null│
                    └──────────────────┘ └─────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                  找到                 未找到
                    │                   │
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │返回定义      │    │返回 null     │
            └──────────────┘    └──────────────┘
```

## 销毁流程

```
┌─────────────────────────────────────────────────────────────┐
│                    destroy()                                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  检查是否已销毁       │
                └──────────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                   是             否
                    │             │
                    ▼             ▼
              ┌─────────┐   ┌──────────────────┐
              │ 直接返回 │   │销毁所有子容器    │
              └─────────┘   └──────────────────┘
                                   │
                                   ▼
                            ┌──────────────────┐
                            │调用销毁回调      │
                            │(destroyCallbacks)│
                            └──────────────────┘
                                   │
                                   ▼
                            ┌──────────────────┐
                            │调用实例的destroy │
                            │或 dispose 方法   │
                            └──────────────────┘
                                   │
                                   ▼
                            ┌──────────────────┐
                            │清理所有引用      │
                            │- services.clear()│
                            │- children.clear()│
                            │- 从父容器移除    │
                            └──────────────────┘
                                   │
                                   ▼
                            ┌──────────────────┐
                            │标记为已销毁      │
                            │destroyed = true  │
                            └──────────────────┘
```

## 单例 vs 瞬时

```
┌─────────────────────────────────────────────────────────────┐
│                    单例 (Singleton)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  container.registerSingleton('service', Service)             │
│                                                               │
│  第一次解析:                                                 │
│    resolve('service') ──→ 创建实例 ──→ 缓存 ──→ 返回        │
│                                                               │
│  第二次解析:                                                 │
│    resolve('service') ──→ 返回缓存实例                       │
│                                                               │
│  第三次解析:                                                 │
│    resolve('service') ──→ 返回缓存实例                       │
│                                                               │
│  结果: s1 === s2 === s3 (同一实例)                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    瞬时 (Transient)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  container.registerTransient('service', Service)             │
│                                                               │
│  第一次解析:                                                 │
│    resolve('service') ──→ 创建实例 ──→ 返回                 │
│                                                               │
│  第二次解析:                                                 │
│    resolve('service') ──→ 创建新实例 ──→ 返回                │
│                                                               │
│  第三次解析:                                                 │
│    resolve('service') ──→ 创建新实例 ──→ 返回                │
│                                                               │
│  结果: s1 !== s2 !== s3 (不同实例)                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 树形结构示例

```
                    ┌─────────────────┐
                    │  Root Container │
                    │  (appName)      │
                    │  (logger)       │
                    │  (config)       │
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ User Module  │ │Order Module  │ │Admin Module  │
        │              │ │              │ │              │
        │ userService  │ │orderService  │ │adminService  │
        │ userRepo     │ │orderRepo     │ │adminRepo     │
        └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
               │                │                │
        ┌──────┴──────┐         │                │
        │             │         │                │
        ▼             ▼         ▼                ▼
    ┌────────┐   ┌────────┐ ┌────────┐    ┌────────┐
    │ User   │   │ User   │ │ Order  │    │ Admin  │
    │ List   │   │ Detail │ │ List   │    │ Panel  │
    │ Comp   │   │ Comp   │ │ Comp   │    │ Comp   │
    └────────┘   └────────┘ └────────┘    └────────┘

服务继承关系:
- User List Comp 可以访问: userService, userRepo, logger, config, appName
- User Detail Comp 可以访问: userService, userRepo, logger, config, appName
- Order List Comp 可以访问: orderService, orderRepo, logger, config, appName
- Admin Panel Comp 可以访问: adminService, adminRepo, logger, config, appName

服务隔离:
- User Module 无法访问 orderService, adminService
- Order Module 无法访问 userService, adminService
- Admin Module 无法访问 userService, orderService
```

## 依赖注入示例

```
┌─────────────────────────────────────────────────────────────┐
│                    依赖注入流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. 注册依赖:                                                │
│     container.registerInstance('config', { dbUrl: '...' })   │
│     container.register('database', DatabaseService)          │
│     container.register('userService', UserService)           │
│                                                               │
│  2. 解析 UserService:                                        │
│     resolve('userService')                                   │
│                                                               │
│  3. 创建 UserService 实例:                                   │
│     new UserService(container)                               │
│                                                               │
│  4. UserService 构造函数:                                    │
│     constructor(container: Container) {                      │
│       this.db = container.resolve('database')                │
│     }                                                         │
│                                                               │
│  5. 创建 DatabaseService 实例:                               │
│     new DatabaseService(container)                           │
│                                                               │
│  6. DatabaseService 构造函数:                                │
│     constructor(container: Container) {                      │
│       this.config = container.resolve('config')              │
│     }                                                         │
│                                                               │
│  7. 返回完整的依赖树:                                        │
│     UserService                                              │
│       └─ DatabaseService                                     │
│           └─ Config                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 内存管理

```
┌─────────────────────────────────────────────────────────────┐
│                    内存生命周期                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  创建容器:                                                   │
│    const container = createContainer('app')                  │
│    ↓                                                         │
│    内存占用: 容器对象 + 空的 services Map                    │
│                                                               │
│  注册服务:                                                   │
│    container.register('service', Service)                    │
│    ↓                                                         │
│    内存占用: + ServiceDefinition 对象                        │
│                                                               │
│  解析单例:                                                   │
│    const s = container.resolve('service')                    │
│    ↓                                                         │
│    内存占用: + Service 实例 (缓存)                           │
│                                                               │
│  解析瞬时:                                                   │
│    const s = container.resolve('service')                    │
│    ↓                                                         │
│    内存占用: + Service 实例 (不缓存)                         │
│    (下次 GC 时释放)                                          │
│                                                               │
│  销毁容器:                                                   │
│    await container.destroy()                                 │
│    ↓                                                         │
│    内存占用: 0 (所有引用清理)                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 类型系统

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    类型定义                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ServiceIdentifier<T = any>                                  │
│    = string | symbol | Function                             │
│    ↓ 服务的唯一标识符                                        │
│                                                               │
│  ServiceFactory<T = any>                                     │
│    = (container: Container) => T                             │
│    ↓ 服务工厂函数                                            │
│                                                               │
│  DestroyCallback                                             │
│    = () => void | Promise<void>                             │
│    ↓ 销毁回调函数                                            │
│                                                               │
│  ContainerOptions                                            │
│    = {                                                       │
│        parent?: Container                                    │
│        name?: string                                         │
│      }                                                       │
│    ↓ 容器配置选项                                            │
│                                                               │
│  使用示例:                                                   │
│    const service = container.resolve<UserService>('user')   │
│    ↓ 获得完整的类型提示                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 性能特性

```
┌─────────────────────────────────────────────────────────────┐
│                    性能优化                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. 单例缓存                                                 │
│     - 单例服务只实例化一次                                   │
│     - 后续解析直接返回缓存                                   │
│     - 时间复杂度: O(1)                                       │
│                                                               │
│  2. 分层查找                                                 │
│     - 从子容器向上查找                                       │
│     - 避免重复注册                                           │
│     - 时间复杂度: O(h) h=树高度                              │
│                                                               │
│  3. 延迟初始化                                               │
│     - 服务在解析时才创建                                     │
│     - 避免不必要的初始化                                     │
│     - 减少启动时间                                           │
│                                                               │
│  4. 内存管理                                                 │
│     - 销毁时自动清理所有引用                                 │
│     - 支持异步清理                                           │
│     - 防止内存泄漏                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```
