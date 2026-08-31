# Service $model 使用指南

## 概述

`Service` 是一个基础类，提供自动的 `loading` 和 `error` 状态管理功能。它不依赖 `inversify`，使用轻量级的方法拦截机制来追踪异步操作的状态。

## 核心特性

- ✅ **自动状态管理**: 为所有方法自动创建 `loading` 和 `error` 状态
- ✅ **完整类型推导**: 支持 TypeScript 类型推导，无需 `any`
- ✅ **异步追踪**: 自动追踪 Promise 的执行状态
- ✅ **轻量级**: 不依赖 inversify，代码简洁
- ✅ **响应式**: 可与 `@rabjs/observer` 集成实现响应式更新

## 基本使用

### 1. 创建 Service 类

```typescript
import { Service } from '@rabjs/service';

class UserService extends Service {
  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  }

  async updateUser(id: string, data: any) {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  getUserList() {
    // 同步方法也支持
    return [{ id: '1', name: 'John' }];
  }
}
```

### 2. 使用 Service 实例

```typescript
const userService = new UserService();

// 访问方法的状态
console.log(userService.$model.fetchUser.loading); // false
console.log(userService.$model.fetchUser.error); // null

// 调用异步方法
const userPromise = userService.fetchUser('123');

// 在调用时，loading 状态自动变为 true
console.log(userService.$model.fetchUser.loading); // true

// 等待完成
await userPromise;

// 完成后，loading 变为 false
console.log(userService.$model.fetchUser.loading); // false
console.log(userService.$model.fetchUser.error); // null
```

## 类型推导

### 自动类型推导

`$model` 的类型会根据 Service 类的方法自动推导：

```typescript
class UserService extends Service {
  async fetchUser(id: string): Promise<User> {
    // ...
  }

  syncMethod(): string {
    // ...
  }
}

const service = new UserService();

// 类型自动推导为 { loading: boolean; error: Error | null }
const fetchUserState = service.$model.fetchUser;
const syncMethodState = service.$model.syncMethod;

// TypeScript 会正确识别这些属性
fetchUserState.loading; // ✅ 类型正确
fetchUserState.error; // ✅ 类型正确
```

### 显式类型注解

```typescript
import { Service, type MethodState } from '@rabjs/service';

class UserService extends Service {
  async fetchUser(id: string) {
    // ...
  }
}

const service = new UserService();

// 显式注解
const state: MethodState = service.$model.fetchUser;
```

## 错误处理

### 自动错误捕获

```typescript
class UserService extends Service {
  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    return response.json();
  }
}

const service = new UserService();

try {
  await service.fetchUser('invalid-id');
} catch (error) {
  // 错误会被自动捕获到 $model 中
  console.log(service.$model.fetchUser.error); // Error: Failed to fetch user
  console.log(service.$model.fetchUser.loading); // false
}
```

### 错误清除

在新的异步调用时，之前的错误会自动清除：

```typescript
// 第一次调用失败
try {
  await service.fetchUser('invalid-id');
} catch (e) {
  // ...
}
console.log(service.$model.fetchUser.error); // Error

// 第二次调用时，错误自动清除
const promise = service.fetchUser('valid-id');
console.log(service.$model.fetchUser.error); // null
```

## 已知限制：同名方法不要重叠调用

`$model.method.loading` 是布尔开关，**不是**进行中调用的计数；`$model.method.error` 是最近一次写入，**无法**对应到具体哪一次调用。

```typescript
const a = service.fetchUser('1'); // 100ms
const b = service.fetchUser('2'); // 10ms，同名方法第二次
await wait(30);
// b 已结束、a 还在飞，但 loading 已被 b 置为 false
service.$model.fetchUser.loading; // false
// 若 b 成功、a 随后失败（或反过来），error 只保留后结算的那次，分不清是谁的
```

实际 UI 里同一操作同时点两次的情况很少，而给 `loading` 加计数也解决不了 `error` 的二义性，因此框架**不会**改成 pending 计数。请保证同一方法同时只跑一次（按钮 disable、忽略进行中的重复点击）。若确实需要并发，请自行维护计数 / 请求 id，不要读 `$model` 当队列。

## React 集成示例

### 使用 React Hooks

```typescript
import { useEffect, useState } from "react";
import { Service } from "@rabjs/service";

class UserService extends Service {
  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  }
}

function UserComponent({ userId }: { userId: string }) {
  const [service] = useState(() => new UserService());
  const [user, setUser] = useState(null);

  useEffect(() => {
    service.fetchUser(userId).then(setUser);
  }, [userId, service]);

  if (service.$model.fetchUser.loading) {
    return <div>Loading...</div>;
  }

  if (service.$model.fetchUser.error) {
    return <div>Error: {service.$model.fetchUser.error.message}</div>;
  }

  return <div>{user?.name}</div>;
}
```

### 与 @rabjs/observer 集成

```typescript
import { Service } from '@rabjs/service';
import { observe } from '@rabjs/observer';

class UserService extends Service {
  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  }
}

const service = new UserService();

// 使用 observe 监听状态变化
observe(() => {
  if (service.$model.fetchUser.loading) {
    console.log('正在加载...');
  } else if (service.$model.fetchUser.error) {
    console.log('加载失败:', service.$model.fetchUser.error.message);
  } else {
    console.log('加载完成');
  }
});

// 调用方法
service.fetchUser('123');
```

## 高级用法

### 多个异步方法

```typescript
class DataService extends Service {
  async fetchUsers() {
    // ...
  }

  async fetchPosts() {
    // ...
  }

  async fetchComments() {
    // ...
  }
}

const service = new DataService();

// 并行调用
Promise.all([service.fetchUsers(), service.fetchPosts(), service.fetchComments()]);

// 分别监听各个方法的状态
console.log(service.$model.fetchUsers.loading);
console.log(service.$model.fetchPosts.loading);
console.log(service.$model.fetchComments.loading);
```

### 继承和扩展

```typescript
class BaseService extends Service {
  protected baseUrl = 'https://api.example.com';

  protected async request(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`);
    return response.json();
  }
}

class UserService extends BaseService {
  async fetchUser(id: string) {
    return this.request(`/users/${id}`);
  }
}

const service = new UserService();
// 继承的方法也支持状态管理
await service.fetchUser('123');
console.log(service.$model.fetchUser.loading);
```

### 私有方法排除

私有方法（以 `_` 开头）会自动排除：

```typescript
class UserService extends Service {
  async fetchUser(id: string) {
    return this._request(`/users/${id}`);
  }

  private async _request(path: string) {
    // 这个方法不会在 $model 中
    const response = await fetch(path);
    return response.json();
  }
}

const service = new UserService();
console.log((service.$model as any)._request); // undefined
```

## 类型定义

### MethodState 接口

```typescript
export interface MethodState {
  loading: boolean;
  error: Error | null;
}
```

### ExtractMethods 类型

```typescript
export type ExtractMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? MethodState : never;
};
```

## 性能考虑

1. **方法拦截**: 每个方法调用都会经过拦截器，但开销很小
2. **内存**: 每个方法创建一个状态对象，内存占用极小
3. **响应式**: 如果使用 `@rabjs/observer`，状态变化会自动触发响应式更新

## 常见问题

### Q: 为什么同步方法也有 loading 和 error 状态？

A: 为了提供统一的接口。即使是同步方法，`loading` 也会在调用时保持 `false`，`error` 保持 `null`。这样可以统一处理所有方法的状态。

### Q: 如何禁用某个方法的状态管理？

A: 目前没有内置的禁用机制。如果需要，可以创建一个不继承 `Service` 的普通类。

### Q: 状态对象是响应式的吗？

A: 如果安装了 `@rabjs/observer`，状态对象会自动变成响应式的。否则是普通对象。

### Q: 如何在 Vue 中使用？

A: 可以直接在 Vue 组件中使用，或者配合 `@rabjs/observer` 使用响应式特性。

## 最佳实践

1. **为每个 Service 创建单独的类**: 不要在一个 Service 中混合多个业务逻辑
2. **使用类型注解**: 为方法的返回值添加类型注解，便于类型推导
3. **错误处理**: 在调用异步方法时使用 try-catch，同时监听 `$model` 中的错误状态
4. **避免过度使用**: 不是所有方法都需要状态管理，只为关键的异步操作创建 Service

## 示例项目

完整的测试用例见 `src/__tests__/service.test.ts`
