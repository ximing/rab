# RSJS 文档

欢迎来到 RSJS（Reactive State JavaScript）文档！

RSJS 是一个轻量级的响应式状态管理库，提供了三个核心包：

## 📦 核心包

> 💡 `@rabjs/observer` 和 `@rabjs/service` 已经包含在 `@rabjs/react` 中，可以直接从 react 包导入。

### [@rabjs/react](https://github.com/ximing/rab)

内置`@rabjs/observer` 和 `@rabjs/observer` 包，并提供 React 集成层，提供了 `observer`、`useService`、`bindServices` 等 API，让你在 React 组件中轻松使用响应式状态。

**主要特性：**

- ⚛️ React 16.3+ 支持
- 🪝 多个实用 Hooks（useObserver、useLocalObservable、useAsObservableSource）
- 🔄 自动批量更新
- 🌐 SSR 支持
- ⚡ 完全支持并发模式
- 🎯 细粒度更新，避免不必要的重新渲染

### [@rabjs/observer](https://github.com/ximing/rab)

响应式状态库的核心，提供了 `observable` 和 `observe` 两个基础 API，用于创建响应式对象和追踪其变化。

**主要特性：**

- 🎯 自动追踪对象属性访问
- 🔄 支持嵌套对象和数组
- ⚡ 高性能的 Proxy 实现
- 🧹 自动内存管理
- 📦 支持 Set、Map、WeakSet、WeakMap 等集合类型
- 🔍 细粒度追踪，只追踪实际访问的属性

### [@rabjs/service](https://github.com/ximing/rab)

基于 `@rabjs/observer` 的服务层框架，提供了 `Service` 基类和依赖注入容器。

**主要特性：**

- 📋 自动的 loading 和 error 状态管理
- 🔗 内置依赖注入容器
- 🎨 装饰器支持（@Inject、@Debounce 等）
- 📦 完整的 TypeScript 类型推导
- 🔄 自动批量更新
- 🏗️ 支持 Service 之间的依赖注入

## 🚀 快速开始

### 安装

```bash
# 安装 React 集成包
yarn install @rabjs/react

# 或使用 pnpm
pnpm add @rabjs/react
```

### 推荐方式：Service + observer

```typescript
// 1. 定义 Service
import { Service } from '@rabjs/react';

export class CounterService extends Service {
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}

// 2. 在组件中使用
import { observer, useService, bindServices } from '@rabjs/react';

const CounterContent = observer(() => {
  const service = useService(CounterService);

  return (
    <div>
      <p>Count: {service.count}</p>
      <button onClick={() => service.increment()}>+1</button>
      <button onClick={() => service.decrement()}>-1</button>
    </div>
  );
});

// 3. 使用 bindServices 导出组件
export default bindServices(CounterContent, [CounterService]);
```

### 基础示例：Observable + Observe

```typescript
import { observable, observe } from '@rabjs/react';

// 创建响应式对象
const state = observable({ count: 0 });

// 追踪状态变化
observe(() => {
  console.log('Count:', state.count);
});

// 修改状态
state.count++; // 输出: Count: 1
```

## 📚 文档结构

本文档分为两个主要部分：

### 1. **React + Service 集成**（推荐）

如果你想在 React 应用中使用 RSJS，从这里开始：

- [快速上手](./react-service/quick-start.md) - 5 分钟快速入门
- [基础用法](./react-service/basic-usage.md) - 学习基本概念
- [深入 Service](./react-service/service-deep-dive.md) - 理解 Service 架构和依赖注入
- [Service 领域](./react-service/service-domain.md) - 领域驱动设计和架构模式
- [observer vs view](./react-service/observer-vs-view.md) - 了解两种 HOC 的区别
- [其他 Hooks](./react-service/hooks.md) - useObserver、useLocalObservable 等
- [SSR 支持](./react-service/ssr.md) - 服务端渲染配置

### 2. **响应式状态**（底层原理）

深入了解响应式系统的核心：

- [介绍](./observer/introduction.md) - 响应式系统概览和工作原理
- [Observable](./observer/observable.md) - 创建响应式对象
- [Observe](./observer/observe.md) - 追踪状态变化
- [高级用法](./observer/advanced.md) - 性能优化和最佳实践

## 💡 核心概念

### Observable（响应式对象）

通过 `observable()` 函数创建的对象，其属性访问和修改都会被自动追踪。支持嵌套对象、数组、Set、Map 等各种数据类型。

```typescript
const state = observable({
  count: 0,
  user: { name: 'John' },
  items: [1, 2, 3],
});
```

### Observe（观察者）

通过 `observe()` 函数创建的反应函数，当其依赖的 observable 属性变化时会自动重新执行。

```typescript
observe(() => {
  console.log('Count:', state.count);
});
```

### Service（服务）

继承自 `Service` 基类的类，提供了自动的状态管理、依赖注入、loading/error 状态等功能。

```typescript
export class UserService extends Service {
  user: any = null;

  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    this.user = await response.json();
  }
}
```

### observer（HOC）

用于包装 React 函数组件，使其能够自动追踪 observable 属性的变化并重新渲染。

```typescript
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});
```

### bindServices（容器注册）

用于注册组件所需的 Service，创建依赖注入容器并通过 Context 提供给组件树。

```typescript
export default bindServices(MyComponent, [UserService, TodoService]);
```

## 🎯 使用场景

RSJS 适合以下场景：

- ✅ 中小型 React 应用的状态管理
- ✅ 复杂的业务逻辑和数据流
- ✅ 需要细粒度响应式更新的应用
- ✅ 服务端渲染（SSR）应用
- ✅ 微前端架构中的独立应用
- ✅ 需要依赖注入的应用架构
- ✅ 需要自动 loading/error 状态管理的应用

## 🌟 核心优势

### 1. 简单易用

- 无需手动订阅和取消订阅
- 自动追踪依赖关系
- 直观的 API 设计

### 2. 高性能

- 细粒度追踪，只追踪实际访问的属性
- 自动批量更新，避免不必要的重新渲染
- 支持 React 18+ 并发模式

### 3. 类型安全

- 完整的 TypeScript 类型推导
- 编译时类型检查
- 智能代码提示

### 4. 功能完整

- 自动的 loading 和 error 状态管理
- 内置依赖注入容器
- 支持装饰器（@Inject、@Debounce 等）
- 支持 SSR

## 🔗 相关资源

- [GitHub 仓库](https://github.com/ximing/rab)
- [示例代码](./example/index.md)

## 📝 许可证

MIT
