# 装饰器与 Service 默认语义

RSJS 的 Service 有两个重要的**默认语义**，理解它们之后，大多数场景根本不需要装饰器：

1. **方法默认就是 Action**——所有方法自动批量更新（action），不需要 `@Action` 标记。
2. **Service 间依赖推荐 getter + `this.resolve`**——不需要 `@Inject` 属性装饰器。

装饰器只用于改变默认行为（`@SyncAction`）或提供额外能力（`@Debounce`、`@Throttle`、`@Memo`、`@On`）。

## 方法默认就是 Action

Service 中的所有方法默认都是 action：方法内对 observable 属性的多次修改会被批量合并，只触发一次 UI 更新。

```typescript
import { Service } from '@rabjs/react';

export class CounterService extends Service {
  count = 0;
  step = 1;

  // ✅ 默认就是 action，不需要任何装饰器
  increment() {
    this.step = 2;
    this.count += this.step; // 两次修改批量合并，只触发一次更新
  }

  // ❌ 不要这样写：@Action 是多余标记
  // @Action
  // increment() { ... }
}
```

## Service 间依赖：getter + this.resolve（推荐）

Service 内部依赖另一个 Service 时，推荐用 getter + `this.resolve` 模式：

```typescript
import { Service } from '@rabjs/react';

export class LoggerService extends Service {
  log(message: string) {
    console.log(`[Log] ${message}`);
  }
}

export class UserService extends Service {
  // ✅ 推荐写法：getter + this.resolve
  get loggerService() {
    return this.resolve(LoggerService);
  }

  async fetchUsers() {
    this.loggerService.log('Fetching users');
    // ...
  }
}
```

**`this.resolve` 的语义**：从**当前实例所属的容器**开始解析，沿容器树向上查找。因此被依赖的 Service 必须注册在**同一棵容器树**里：

- ✅ 当前容器（同一个 `bindServices`）注册的 Service
- ✅ 任一父级容器注册的 Service
- ✅ 全局容器注册的 Service（通过 `register`）
- ❌ 兄弟/子组件容器的 Service、未注册的 Service

```typescript
// 例如：LoggerService 全局注册，UserService 页面级注册
register(LoggerService); // 应用启动时
export default bindServices(UserPage, [UserService]); // UserService 可 resolve 到全局的 LoggerService

// 或者：两个 Service 注册进同一个容器
export default bindServices(UserPage, [LoggerService, UserService]);
```

## @SyncAction - 关闭批量更新

所有方法默认都是 action（批量更新）。如果某个方法需要每次修改立即生效（不使用批量更新），用 `@SyncAction` 标记：

```typescript
import { Service, SyncAction } from '@rabjs/react';

export class UserService extends Service {
  @SyncAction
  syncData() {
    // 这个方法不会使用 Action 批量更新
  }
}
```

## @Debounce - 防抖

```typescript
import { Service, Debounce } from '@rabjs/react';

export class SearchService extends Service {
  query = '';
  results: any[] = [];

  setQuery(q: string) {
    this.query = q;
    this.search();
  }

  // 防抖 300ms
  @Debounce(300)
  async search() {
    if (!this.query) {
      this.results = [];
      return;
    }
    const response = await fetch(`/api/search?q=${this.query}`);
    this.results = await response.json();
  }
}
```

## @Throttle - 节流

```typescript
import { Service, Throttle } from '@rabjs/react';

export class ScrollService extends Service {
  scrollPosition = 0;

  // 节流 100ms
  @Throttle(100)
  handleScroll(event: Event) {
    this.scrollPosition = window.scrollY;
  }
}
```

## @Memo - 缓存计算属性

```typescript
import { Service, Memo } from "@rabjs/react";

export class DataService extends Service {
  data: any[] = [];

  // 缓存昂贵的计算结果
  @Memo()
  get expensiveComputation() {
    console.log("Computing...");
    return this.data
      .map(item => /* 复杂计算 */)
      .filter(/* 复杂过滤 */)
      .sort(/* 复杂排序 */);
  }
}
```

## @On - 自动监听事件

```typescript
import { Service, On } from '@rabjs/react';

export class NotificationService extends Service {
  notifications: string[] = [];

  // 自动监听容器事件
  @On('chat:message')
  handleMessage(data: { text: string }) {
    this.notifications.push(data.text);
  }

  // 自动监听全局事件
  @On('app:notification', { scope: 'global' })
  handleGlobalNotification(data: { text: string }) {
    this.notifications.push(data.text);
  }
}
```

## 完整示例

```typescript
import { Service, Debounce, Throttle, Memo, On } from '@rabjs/react';

export class CompleteService extends Service {
  // ✅ 依赖其他 Service：getter + this.resolve
  get loggerService() {
    return this.resolve(LoggerService);
  }

  data: any[] = [];
  query = '';

  // 防抖搜索（方法默认就是 action，无需 @Action）
  @Debounce(300)
  async search(q: string) {
    this.loggerService.log(`Searching for: ${q}`);
    const response = await fetch(`/api/search?q=${q}`);
    this.data = await response.json();
  }

  // 节流滚动
  @Throttle(100)
  handleScroll() {
    this.loggerService.log('Scrolling...');
  }

  // 缓存计算
  @Memo()
  get filteredData() {
    return this.data.filter(item => item.name.includes(this.query));
  }

  // 监听事件
  @On('data:refresh')
  handleRefresh() {
    this.search(this.query);
  }
}
```

## 遗留装饰器（仍可用，但不推荐）

以下两个装饰器在源码中仍然保留、功能正常，但已不再是推荐用法。维护旧代码时会遇到它们，新代码请使用上面的默认语义和 getter + `this.resolve` 模式。

### @Action - 多余的 Action 标记（遗留）

`@Action` 只是给方法打上 `__isAction` 标记，而 Service 的方法**默认就是 action**，所以写它是多余的：

```typescript
import { Service, Action } from '@rabjs/react';

export class UserService extends Service {
  // ⚠️ 遗留写法：功能正常但多余，方法默认就是 action，直接删掉即可
  @Action
  async fetchUser(id: string) {
    return fetch(`/api/users/${id}`).then(r => r.json());
  }
}
```

### @Inject - 属性注入（遗留）

`@Inject` 属性装饰器仍可从容器自动解析依赖，但推荐改用 getter + `this.resolve`：

```typescript
import { Service, Inject } from '@rabjs/react';

export class UserService extends Service {
  // ⚠️ 遗留写法：仍可用，但不推荐
  @Inject(LoggerService)
  private logger!: LoggerService;

  async fetchUsers() {
    this.logger.log('Fetching users');
  }
}

// ✅ 推荐改写为：
export class UserServiceV2 extends Service {
  get logger() {
    return this.resolve(LoggerService);
  }
}
```

`@Inject` 支持类、字符串、Symbol 三种标识符，解析规则与 `this.resolve` 完全一致：被注入的 Service 必须注册在当前实例所属的容器树中（当前容器、父级容器或全局容器），否则解析失败。
