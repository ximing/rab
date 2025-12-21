# Service 装饰器

RSJS 提供了一系列强大的装饰器来增强 Service 的功能，包括依赖注入、性能优化、防抖节流等。

## 装饰器概览

| 装饰器        | 用途           | 适用场景               |
| ------------- | -------------- | ---------------------- |
| `@Inject`     | 依赖注入       | 注入其他 Service 依赖  |
| `@On`         | 事件监听       | 监听全局或容器级别事件 |
| `@Once`       | 一次性事件监听 | 监听只触发一次的事件   |
| `@Memo`       | 缓存计算结果   | 优化昂贵的 getter 计算 |
| `@Debounce`   | 防抖           | 搜索输入、表单验证     |
| `@Throttle`   | 节流           | 滚动事件、窗口 resize  |
| `@Action`     | 标记 action    | 批量更新（默认已启用） |
| `@SyncAction` | 排除批量更新   | 需要立即同步更新的场景 |

## @Inject - 依赖注入

用于在 Service 中注入其他 Service 依赖。

### 基础用法

```typescript
import { Service, Inject } from '@rabjs/react';

class AuthService extends Service {
  user: any = null;

  login(username: string, password: string) {
    // 登录逻辑
    this.user = { username };
  }

  logout() {
    this.user = null;
  }
}

class UserService extends Service {
  // 注入 AuthService
  @Inject(AuthService)
  private authService!: AuthService;

  get currentUser() {
    return this.authService.user;
  }

  get isLoggedIn() {
    return this.authService.user !== null;
  }
}
```

### 可选依赖

```typescript
class AnalyticsService extends Service {
  // 可选依赖，如果未注册则为 undefined
  @Inject(LoggerService, { optional: true })
  private logger?: LoggerService;

  trackEvent(event: string) {
    // 安全地使用可选依赖
    this.logger?.log(`Event: ${event}`);
  }
}
```

### 在组件中使用

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

const UserProfile = observer(() => {
  const userService = useService(UserService);

  return (
    <div>
      {userService.isLoggedIn ? <p>欢迎, {userService.currentUser.username}</p> : <p>请登录</p>}
    </div>
  );
});

// 注册所有依赖的 Service
export default bindServices(UserProfile, [AuthService, UserService]);
```

## @On - 事件监听

用于在 Service 中绑定事件监听器，支持全局和容器级别的事件监听。

### 核心特性

- 支持全局和容器级别的事件监听
- 自动在 Service 初始化时绑定监听器
- 自动在 Service 销毁时移除监听器
- 支持多个事件监听
- 完整的 TypeScript 类型推导

### 基础用法

```typescript
import { Service, On } from '@rabjs/react';

class NotificationService extends Service {
  notifications: string[] = [];

  // 监听容器级别事件（默认）
  @On('notification:add')
  onNotificationAdd(message: string) {
    console.log('收到通知:', message);
    this.notifications.push(message);
  }

  // 监听全局事件
  @On('app:error', { scope: 'global' })
  onAppError(error: Error) {
    console.error('应用错误:', error);
    this.notifications.push(`错误: ${error.message}`);
  }
}
```

### 事件作用域

`@On` 装饰器支持两种事件作用域：

- **`container`**（默认）：容器级别事件，仅在当前容器内有效
- **`global`**：全局事件，所有容器共享

```typescript
class UserService extends Service {
  currentUser: any = null;
  loginCount = 0;

  // 容器级别事件 - 仅在当前容器内触发
  @On('user:update')
  onUserUpdate(user: any) {
    console.log('用户更新（容器级别）:', user);
    this.currentUser = user;
  }

  // 全局事件 - 跨容器触发
  @On('user:login', { scope: 'global' })
  onUserLogin(user: { id: number; name: string }) {
    console.log('用户登录（全局）:', user);
    this.currentUser = user;
    this.loginCount++;
  }

  // 全局事件 - 监听登出
  @On('user:logout', { scope: 'global' })
  onUserLogout() {
    console.log('用户登出');
    this.currentUser = null;
  }
}
```

### 在组件中使用

```typescript
import { observer, useService, bindServices, useContainerEvents } from '@rabjs/react';

const NotificationPanel = observer(() => {
  const service = useService(NotificationService);
  const events = useContainerEvents();

  const addNotification = () => {
    // 触发容器级别事件
    events.emit('notification:add', '新消息');
  };

  const triggerError = () => {
    // 触发全局事件（需要通过全局事件系统）
    // 注意：全局事件需要使用 EventSystem.getEmitter('global')
    const globalEvents = EventSystem.getEmitter('global');
    globalEvents.emit('app:error', new Error('测试错误'));
  };

  return (
    <div>
      <button onClick={addNotification}>添加通知</button>
      <button onClick={triggerError}>触发错误</button>

      <ul>
        {service.notifications.map((msg, index) => (
          <li key={index}>{msg}</li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(NotificationPanel, [NotificationService]);
```

### 多个事件监听

一个 Service 可以监听多个事件：

```typescript
class DataService extends Service {
  data: any[] = [];
  status = 'idle';

  @On('data:fetch')
  onDataFetch() {
    console.log('开始获取数据');
    this.status = 'loading';
  }

  @On('data:success')
  onDataSuccess(data: any[]) {
    console.log('数据获取成功');
    this.data = data;
    this.status = 'success';
  }

  @On('data:error')
  onDataError(error: Error) {
    console.error('数据获取失败:', error);
    this.status = 'error';
  }

  @On('data:reset')
  onDataReset() {
    console.log('重置数据');
    this.data = [];
    this.status = 'idle';
  }
}
```

### 如何触发事件

在组件中触发事件时，需要根据事件作用域选择合适的方式：

**容器级别事件**：使用 `useContainerEvents` Hook

```typescript
import { useContainerEvents } from '@rabjs/react';

const MyComponent = observer(() => {
  const events = useContainerEvents();

  const handleClick = () => {
    // 触发容器级别事件
    events.emit('button:clicked', { id: 1 });
  };

  return <button onClick={handleClick}>Click</button>;
});
```

**全局事件**：使用 `EventSystem.getEmitter('global')`

```typescript
import { EventSystem } from '@rabjs/react';

const MyComponent = observer(() => {
  const handleGlobalEvent = () => {
    // 获取全局事件发射器
    const globalEvents = EventSystem.getEmitter('global');
    // 触发全局事件
    globalEvents.emit('app:notification', { message: 'Hello' });
  };

  return <button onClick={handleGlobalEvent}>Notify</button>;
});
```

### 清理事件监听器

事件监听器会在 Service 销毁时自动清理，但你也可以手动清理：

```typescript
import { Service, On, cleanupEventListeners } from '@rabjs/react';

class MyService extends Service {
  @On('some:event')
  onSomeEvent(data: any) {
    console.log('事件触发:', data);
  }

  // 手动清理事件监听器
  cleanup() {
    cleanupEventListeners(this);
  }

  // Service 销毁时自动清理
  destroy() {
    cleanupEventListeners(this);
  }
}
```

## @Once - 一次性事件监听

用于在 Service 中绑定一次性事件监听器，事件触发一次后自动移除监听器。

### 核心特性

- 支持全局和容器级别的一次性事件监听
- 事件触发一次后自动移除监听器
- 自动在 Service 初始化时绑定监听器
- 自动在 Service 销毁时移除未触发的监听器
- 支持多个一次性事件监听
- 完整的 TypeScript 类型推导

### 基础用法

```typescript
import { Service, Once } from '@rabjs/react';

class AppService extends Service {
  isInitialized = false;
  initialData: any = null;

  // 监听容器级别一次性事件（默认）
  @Once('data:loaded')
  onDataLoaded(data: any) {
    console.log('数据加载完成（仅触发一次）:', data);
    this.initialData = data;
  }

  // 监听全局一次性事件
  @Once('app:initialized', { scope: 'global' })
  onAppInitialized() {
    console.log('应用初始化完成（全局，仅触发一次）');
    this.isInitialized = true;
  }
}
```

### 事件作用域

与 `@On` 装饰器相同，`@Once` 也支持两种事件作用域：

```typescript
class InitService extends Service {
  configLoaded = false;
  userDataLoaded = false;

  // 容器级别一次性事件
  @Once('config:loaded')
  onConfigLoaded(config: any) {
    console.log('配置加载完成（容器级别，仅一次）');
    this.configLoaded = true;
  }

  // 全局一次性事件
  @Once('user:first-login', { scope: 'global' })
  onUserFirstLogin(user: any) {
    console.log('用户首次登录（全局，仅一次）');
    this.userDataLoaded = true;
  }
}
```

### 在组件中使用

```typescript
import { observer, useService, bindServices, useContainerEvents } from '@rabjs/react';
import { EventSystem } from '@rabjs/react';

const InitializationPanel = observer(() => {
  const service = useService(AppService);
  const events = useContainerEvents();

  const loadData = () => {
    // 触发容器级别一次性事件（只会被处理一次）
    events.emit('data:loaded', { items: [1, 2, 3] });
  };

  const initializeApp = () => {
    // 触发全局一次性事件
    const globalEvents = EventSystem.getEmitter('global');
    globalEvents.emit('app:initialized');
  };

  return (
    <div>
      <button onClick={loadData}>加载数据</button>
      <button onClick={initializeApp}>初始化应用</button>

      <div>
        <p>初始化状态: {service.isInitialized ? '已完成' : '未完成'}</p>
        <p>数据: {JSON.stringify(service.initialData)}</p>
      </div>
    </div>
  );
});

export default bindServices(InitializationPanel, [AppService]);
```

### @On 和 @Once 的区别

```typescript
class ComparisonService extends Service {
  clickCount = 0;
  firstClickTime: number | null = null;

  // @On - 每次点击都会触发
  @On('button:click')
  onButtonClick() {
    this.clickCount++;
    console.log('点击次数:', this.clickCount);
  }

  // @Once - 只在第一次点击时触发
  @Once('button:click')
  onFirstClick() {
    this.firstClickTime = Date.now();
    console.log('首次点击时间:', this.firstClickTime);
  }
}
```

### 实战示例：应用初始化流程

```typescript
import { Service, Once, On } from '@rabjs/react';

class BootstrapService extends Service {
  // 初始化状态
  configLoaded = false;
  authChecked = false;
  dataPreloaded = false;
  isReady = false;

  // 一次性事件：配置加载
  @Once('bootstrap:config-loaded', { scope: 'global' })
  onConfigLoaded(config: any) {
    console.log('配置加载完成');
    this.configLoaded = true;
    this.checkBootstrapComplete();
  }

  // 一次性事件：认证检查
  @Once('bootstrap:auth-checked', { scope: 'global' })
  onAuthChecked(isAuthenticated: boolean) {
    console.log('认证检查完成:', isAuthenticated);
    this.authChecked = true;
    this.checkBootstrapComplete();
  }

  // 一次性事件：数据预加载
  @Once('bootstrap:data-preloaded', { scope: 'global' })
  onDataPreloaded() {
    console.log('数据预加载完成');
    this.dataPreloaded = true;
    this.checkBootstrapComplete();
  }

  // 持续监听：错误处理
  @On('bootstrap:error', { scope: 'global' })
  onBootstrapError(error: Error) {
    console.error('启动错误:', error);
    // 错误处理逻辑
  }

  private checkBootstrapComplete() {
    if (this.configLoaded && this.authChecked && this.dataPreloaded) {
      this.isReady = true;
      console.log('应用启动完成');

      // 触发启动完成事件
      const globalEvents = EventSystem.getEmitter('global');
      globalEvents.emit('bootstrap:complete');
    }
  }
}

// 使用示例
const App = observer(() => {
  const bootstrap = useService(BootstrapService);

  useEffect(() => {
    // 获取全局事件发射器
    const globalEvents = EventSystem.getEmitter('global');

    // 模拟启动流程
    setTimeout(() => {
      globalEvents.emit('bootstrap:config-loaded', { apiUrl: '/api' });
    }, 100);

    setTimeout(() => {
      globalEvents.emit('bootstrap:auth-checked', true);
    }, 200);

    setTimeout(() => {
      globalEvents.emit('bootstrap:data-preloaded');
    }, 300);
  }, []);

  if (!bootstrap.isReady) {
    return <div>应用启动中...</div>;
  }

  return <div>应用已就绪</div>;
});

export default bindServices(App, [BootstrapService]);
```

### 清理事件监听器

一次性事件监听器在触发后会自动移除，但如果 Service 在事件触发前销毁，也会自动清理：

```typescript
import { Service, Once, cleanupEventListeners } from '@rabjs/react';

class MyService extends Service {
  @Once('some:event')
  onSomeEvent(data: any) {
    console.log('事件触发（仅一次）:', data);
  }

  // Service 销毁时自动清理未触发的监听器
  destroy() {
    cleanupEventListeners(this);
  }
}
```

## @Memo - 缓存计算结果

用于缓存 getter 的计算结果，只有当依赖的响应式数据变化时才重新计算。

### 基础用法

```typescript
import { Service, Memo } from '@rabjs/react';

class TodoService extends Service {
  todos = [
    { id: 1, title: 'Learn RSJS', completed: false },
    { id: 2, title: 'Build App', completed: true },
    { id: 3, title: 'Deploy', completed: false },
  ];

  // 缓存计算结果
  @Memo()
  get completedTodos() {
    console.log('计算 completedTodos'); // 只在依赖变化时执行
    return this.todos.filter(todo => todo.completed);
  }

  @Memo()
  get activeTodos() {
    console.log('计算 activeTodos');
    return this.todos.filter(todo => !todo.completed);
  }

  @Memo()
  get statistics() {
    console.log('计算 statistics');
    return {
      total: this.todos.length,
      completed: this.completedTodos.length,
      active: this.activeTodos.length,
      completionRate: this.completedTodos.length / this.todos.length,
    };
  }
}
```

### 在组件中使用

```typescript
const TodoStats = observer(() => {
  const service = useService(TodoService);
  const stats = service.statistics; // 首次访问会计算

  return (
    <div>
      <p>总计: {stats.total}</p>
      <p>已完成: {stats.completed}</p>
      <p>进行中: {stats.active}</p>
      <p>完成率: {(stats.completionRate * 100).toFixed(1)}%</p>
    </div>
  );
});

// 多次访问不会重新计算
const AnotherComponent = observer(() => {
  const service = useService(TodoService);
  const stats1 = service.statistics; // 使用缓存
  const stats2 = service.statistics; // 使用缓存
  // ...
});
```

### 手动失效缓存

```typescript
import { Service, Memo, invalidateMemo } from '@rabjs/react';

class DataService extends Service {
  data: any[] = [];

  @Memo()
  get processedData() {
    return this.data.map(item => this.expensiveProcess(item));
  }

  forceRefresh() {
    // 手动失效缓存
    invalidateMemo(this, 'processedData');
  }

  private expensiveProcess(item: any) {
    // 昂贵的计算
    return item;
  }
}
```

### 清理缓存

```typescript
import { Service, Memo, cleanupAllMemos } from '@rabjs/react';

class ExpensiveService extends Service {
  @Memo()
  get data1() {
    return this.compute1();
  }

  @Memo()
  get data2() {
    return this.compute2();
  }

  // 在 Service 销毁时清理所有缓存
  destroy() {
    cleanupAllMemos(this);
  }
}
```

## @Debounce - 防抖

用于延迟执行方法，在连续触发时只执行最后一次。适用于搜索输入、表单验证等场景。

### 基础用法

```typescript
import { Service, Debounce } from '@rabjs/react';

class SearchService extends Service {
  keyword = '';
  results: any[] = [];

  // 300ms 防抖
  @Debounce(300)
  async search(keyword: string) {
    console.log('执行搜索:', keyword);
    const response = await fetch(`/api/search?q=${keyword}`);
    this.results = await response.json();
  }

  // 用户输入时调用
  handleInput(value: string) {
    this.keyword = value;
    this.search(value); // 300ms 内多次调用只执行最后一次
  }
}
```

### 在组件中使用

```typescript
const SearchBox = observer(() => {
  const service = useService(SearchService);

  return (
    <div>
      <input
        value={service.keyword}
        onChange={e => service.handleInput(e.target.value)}
        placeholder="搜索..."
      />
      {service.$model.search.loading && <span>搜索中...</span>}
      <ul>
        {service.results.map(item => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </div>
  );
});
```

### 配置选项

```typescript
class FormService extends Service {
  // leading: true - 首次立即执行
  @Debounce(500, { leading: true, trailing: false })
  validateOnFocus(value: string) {
    console.log('首次立即验证');
  }

  // trailing: true - 延迟结束后执行（默认）
  @Debounce(500, { leading: false, trailing: true })
  validateOnBlur(value: string) {
    console.log('延迟后验证');
  }

  // maxWait: 最大等待时间，超过后强制执行
  @Debounce(300, { maxWait: 1000 })
  autoSave(data: any) {
    console.log('自动保存');
  }
}
```

### 手动取消

```typescript
import { Service, Debounce, cancelDebounce } from '@rabjs/react';

class AutoSaveService extends Service {
  @Debounce(1000)
  save(data: any) {
    console.log('保存数据');
  }

  // 手动取消防抖
  cancelSave() {
    cancelDebounce(this, 'save');
  }

  // 清理所有防抖定时器
  destroy() {
    cleanupAllDebounces(this);
  }
}
```

## @Throttle - 节流

用于限制方法执行频率，在指定时间窗口内最多执行一次。适用于滚动事件、窗口 resize 等高频事件。

### 基础用法

```typescript
import { Service, Throttle } from '@rabjs/react';

class ScrollService extends Service {
  scrollPosition = 0;

  // 每 200ms 最多执行一次
  @Throttle(200)
  handleScroll(event: Event) {
    this.scrollPosition = window.scrollY;
    console.log('滚动位置:', this.scrollPosition);
  }
}
```

### 在组件中使用

```typescript
const ScrollTracker = observer(() => {
  const service = useService(ScrollService);

  useEffect(() => {
    const handleScroll = (e: Event) => service.handleScroll(e);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [service]);

  return (
    <div style={{ position: 'fixed', top: 0, right: 0 }}>滚动位置: {service.scrollPosition}px</div>
  );
});
```

### 配置选项

```typescript
class EventService extends Service {
  // leading: true - 时间窗口开始时立即执行（默认）
  @Throttle(1000, { leading: true, trailing: false })
  handleClick() {
    console.log('立即执行，后续点击被忽略');
  }

  // trailing: true - 时间窗口结束时执行最后一次（默认）
  @Throttle(1000, { leading: false, trailing: true })
  handleResize() {
    console.log('窗口调整结束后执行');
  }

  // 两者都启用
  @Throttle(500, { leading: true, trailing: true })
  handleMouseMove() {
    console.log('开始时立即执行，结束时再执行一次');
  }
}
```

### 手动取消

```typescript
import { Service, Throttle, cancelThrottle } from '@rabjs/react';

class ResizeService extends Service {
  @Throttle(300)
  handleResize() {
    console.log('窗口大小改变');
  }

  // 手动取消节流
  stopTracking() {
    cancelThrottle(this, 'handleResize');
  }

  // 清理所有节流定时器
  destroy() {
    cleanupAllThrottles(this);
  }
}
```

## @Action 和 @SyncAction

### @Action - 批量更新

默认情况下，Service 的所有方法都是 action，会自动批量更新。通常不需要显式使用此装饰器。

```typescript
import { Service, Action } from '@rabjs/react';

class CounterService extends Service {
  count = 0;
  message = '';

  // 默认就是 action，不需要显式标记
  increment() {
    this.count++;
    this.message = `Count: ${this.count}`;
    // 两个状态变化会被批量更新，只触发一次渲染
  }

  // 显式标记（可选）
  @Action
  reset() {
    this.count = 0;
    this.message = 'Reset';
  }
}
```

### @SyncAction - 排除批量更新

用于需要立即同步更新的场景，排除批量更新机制。

```typescript
import { Service, SyncAction } from '@rabjs/react';

class FormService extends Service {
  inputValue = '';

  // 使用 @SyncAction 排除批量更新
  @SyncAction
  handleInput(value: string) {
    this.inputValue = value;
    // 立即触发组件更新，不等待批量
  }

  // 普通方法会批量更新
  submit() {
    console.log('提交:', this.inputValue);
  }
}
```

## 装饰器组合使用

多个装饰器可以组合使用：

```typescript
import { Service, Inject, Debounce, Memo } from '@rabjs/react';

class ProductService extends Service {
  @Inject(ApiService)
  private api!: ApiService;

  products: any[] = [];
  keyword = '';

  // 组合使用 @Debounce
  @Debounce(300)
  async searchProducts(keyword: string) {
    this.keyword = keyword;
    this.products = await this.api.search(keyword);
  }

  // 组合使用 @Memo
  @Memo()
  get filteredProducts() {
    return this.products.filter(p => p.name.toLowerCase().includes(this.keyword.toLowerCase()));
  }

  @Memo()
  get productCount() {
    return this.filteredProducts.length;
  }
}
```

## 实战示例：完整的搜索功能

```typescript
import { Service, Inject, Debounce, Memo, Throttle } from '@rabjs/react';

class SearchService extends Service {
  @Inject(ApiService)
  private api!: ApiService;

  // 状态
  keyword = '';
  results: any[] = [];
  history: string[] = [];
  scrollPosition = 0;

  // 防抖搜索
  @Debounce(300)
  async search(keyword: string) {
    if (!keyword.trim()) {
      this.results = [];
      return;
    }

    this.keyword = keyword;
    this.results = await this.api.search(keyword);

    // 添加到历史记录
    if (!this.history.includes(keyword)) {
      this.history.unshift(keyword);
      if (this.history.length > 10) {
        this.history.pop();
      }
    }
  }

  // 缓存过滤结果
  @Memo()
  get filteredResults() {
    return this.results.filter(item => item.score > 0.5);
  }

  @Memo()
  get resultCount() {
    return this.filteredResults.length;
  }

  // 节流滚动处理
  @Throttle(200)
  handleScroll(position: number) {
    this.scrollPosition = position;

    // 滚动到底部时加载更多
    if (position > 0.8) {
      this.loadMore();
    }
  }

  @Debounce(500)
  async loadMore() {
    const moreResults = await this.api.searchMore(this.keyword);
    this.results.push(...moreResults);
  }

  // 清理
  destroy() {
    cleanupAllDebounces(this);
    cleanupAllThrottles(this);
    cleanupAllMemos(this);
  }
}

// 组件使用
const SearchPage = observer(() => {
  const service = useService(SearchService);

  return (
    <div>
      <input
        value={service.keyword}
        onChange={e => service.search(e.target.value)}
        placeholder="搜索..."
      />

      {service.$model.search.loading && <div>搜索中...</div>}

      <div>找到 {service.resultCount} 个结果</div>

      <div onScroll={e => service.handleScroll(e.currentTarget.scrollTop)}>
        {service.filteredResults.map(item => (
          <div key={item.id}>{item.title}</div>
        ))}
      </div>

      {service.$model.loadMore.loading && <div>加载更多...</div>}
    </div>
  );
});

export default bindServices(SearchPage, [ApiService, SearchService]);
```

## 最佳实践

### 1. 合理使用 @Memo

✅ **适合使用的场景：**

- 计算开销大的 getter
- 依赖多个响应式数据的计算
- 被频繁访问的 getter

❌ **不适合使用的场景：**

- 简单的属性访问
- 计算开销很小的操作
- 很少被访问的 getter

```typescript
class DataService extends Service {
  data: any[] = [];

  // ✅ 适合：计算开销大
  @Memo()
  get processedData() {
    return this.data.map(item => this.expensiveProcess(item));
  }

  // ❌ 不适合：简单属性访问
  // @Memo()  // 不需要
  get dataLength() {
    return this.data.length;
  }
}
```

### 2. 防抖和节流的选择

- **@Debounce**：用于"等待用户停止操作"的场景

  - 搜索输入
  - 表单验证
  - 自动保存

- **@Throttle**：用于"限制执行频率"的场景
  - 滚动事件
  - 窗口 resize
  - 鼠标移动

```typescript
class InputService extends Service {
  // ✅ 搜索使用防抖
  @Debounce(300)
  search(keyword: string) {}

  // ✅ 滚动使用节流
  @Throttle(200)
  handleScroll(position: number) {}
}
```

### 3. 事件监听器的使用

- **@On**：用于需要持续监听的事件

  - 数据更新通知
  - 用户操作事件
  - 状态变化通知

- **@Once**：用于只需要触发一次的事件
  - 应用初始化
  - 首次加载
  - 一次性配置

```typescript
class EventService extends Service {
  // ✅ 持续监听使用 @On
  @On('data:update')
  onDataUpdate(data: any) {
    // 每次数据更新都会触发
  }

  // ✅ 一次性事件使用 @Once
  @Once('app:initialized', { scope: 'global' })
  onAppInitialized() {
    // 只在应用初始化时触发一次
  }
}
```

### 4. 记得清理资源

在 Service 销毁时清理定时器、缓存和事件监听器：

```typescript
class MyService extends Service {
  @Debounce(300)
  debouncedMethod() {}

  @Throttle(200)
  throttledMethod() {}

  @Memo()
  get cachedValue() {
    return this.compute();
  }

  @On('some:event')
  onSomeEvent() {}

  // 清理所有资源
  destroy() {
    cleanupAllDebounces(this);
    cleanupAllThrottles(this);
    cleanupAllMemos(this);
    cleanupEventListeners(this);
  }
}
```

### 5. 依赖注入的顺序

确保在 `bindServices` 中注册所有依赖：

```typescript
class ServiceA extends Service {}

class ServiceB extends Service {
  @Inject(ServiceA)
  private serviceA!: ServiceA;
}

class ServiceC extends Service {
  @Inject(ServiceB)
  private serviceB!: ServiceB;
}

// ✅ 正确：注册所有依赖
export default bindServices(MyComponent, [
  ServiceA, // 被 ServiceB 依赖
  ServiceB, // 被 ServiceC 依赖
  ServiceC,
]);

// ❌ 错误：缺少 ServiceA
export default bindServices(MyComponent, [ServiceB, ServiceC]);
```

## 类型安全

所有装饰器都提供完整的 TypeScript 类型支持：

```typescript
import { Service, Inject, Memo, Debounce, Throttle } from '@rabjs/react';

class TypeSafeService extends Service {
  // ✅ 类型推导正确
  @Inject(ApiService)
  private api!: ApiService;

  @Memo()
  get data(): string[] {
    return this.processData();
  }

  @Debounce(300)
  async search(keyword: string): Promise<void> {
    // TypeScript 会检查参数和返回值类型
  }

  @Throttle(200)
  handleEvent(event: MouseEvent): void {
    // 类型安全
  }
}
```

## 下一步

- 📖 了解 [Service 深入](./service-deep-dive.md)
- 🏗️ 学习 [Service 领域](./service-domain.md) 架构
- 🔍 查看 [其他 Hooks](./hooks.md)
