# 深入 Service

深入理解 Service 的架构和高级特性。

## Service 核心特性

### 1. 自动的 Observable 包装

Service 的所有属性都会自动被转换为 observable：

```typescript
import { Service } from '@rabjs/react';

export class DataService extends Service {
  // 这些属性都是 observable 的
  data: any = null;
  loading: boolean = false;
  error: Error | null = null;

  // 嵌套对象也是 observable 的
  user = {
    name: 'John',
    age: 30,
    address: {
      city: 'Beijing',
      country: 'China',
    },
  };
}

// 修改任何属性都会触发响应
const service = new DataService();
service.data = { id: 1 };
service.user.name = 'Jane';
service.user.address.city = 'Shanghai';
```

### 2. 自动的 Action 包装

Service 的所有方法都自动是 action，支持自动批量更新：

```typescript
import { Service } from '@rabjs/react';

export class CounterService extends Service {
  count = 0;
  message = '';

  // 这个方法会自动批量更新
  increment() {
    this.count++;
    this.message = `Count is now ${this.count}`;
    // 即使有多个状态变化，也只会触发一次组件重新渲染
  }

  // 异步方法也支持
  async fetchAndUpdate() {
    const data = await fetch('/api/data').then(r => r.json());
    this.data = data;
    this.message = 'Data loaded';
  }
}
```

### 3. 自动的 Loading 和 Error 状态

Service 会自动为每个方法创建 `loading` 和 `error` 状态：

```typescript
import { Service } from '@rabjs/react';

export class ApiService extends Service {
  data: any = null;

  async fetchData() {
    // 自动设置 this.$model.fetchData.loading = true
    const response = await fetch('/api/data');
    // 自动设置 this.$model.fetchData.loading = false
    this.data = await response.json();
  }

  async fetchWithError() {
    try {
      throw new Error('Network error');
    } catch (error) {
      // 自动设置 this.$model.fetchWithError.error = error
      throw error;
    }
  }
}

// 使用
const service = new ApiService();
service.fetchData();
console.log(service.$model.fetchData.loading); // true
console.log(service.$model.fetchData.error); // null
```

## 依赖注入

### 基础依赖注入

Service 内置了依赖注入容器，支持自动注入依赖：

```typescript
import { Service, Inject } from '@rabjs/react';

export class LoggerService extends Service {
  log(message: string) {
    console.log(`[Logger] ${message}`);
  }
}

export class UserService extends Service {
  @Inject(LoggerService)
  private logger!: LoggerService;

  async fetchUser(id: string) {
    this.logger.log(`Fetching user ${id}`);
    // ...
  }
}

// 使用
const userService = new UserService();
userService.fetchUser('123');
// 输出: [Logger] Fetching user 123
```

### 容器管理

```typescript
import { Container } from '@rabjs/react';

// 创建容器
const container = new Container();

// 注册服务
container.register(LoggerService);
container.register(UserService);

// 获取实例
const userService = container.get(UserService);
```

## React 中使用 Service

### bindServices - 在 React 中注册和使用 Service

`bindServices` 是在 React 组件中使用 Service 的推荐方式。它会自动创建依赖注入容器，并通过 Context 提供给组件及其子组件。

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

// 1. 定义 Service
export class CounterService extends Service {
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}

// 2. 创建组件并使用 observer 包装
const CounterContent = observer(() => {
  // 使用 useService 获取 Service 实例
  const service = useService(CounterService);

  return (
    <div>
      <p>Count: {service.count}</p>
      <button onClick={() => service.increment()}>+1</button>
      <button onClick={() => service.decrement()}>-1</button>
    </div>
  );
});

// 3. 使用 bindServices 导出组件，注册所需的 Service
export default bindServices(CounterContent, [CounterService]);
```

### 多个 Service 的注册

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

export class AuthService extends Service {
  isLoggedIn = false;
  user: any = null;

  login(username: string) {
    this.isLoggedIn = true;
    this.user = { username };
  }

  logout() {
    this.isLoggedIn = false;
    this.user = null;
  }
}

export class NotificationService extends Service {
  messages: string[] = [];

  addMessage(message: string) {
    this.messages.push(message);
  }
}

// 组件中同时使用多个 Service
const AppContent = observer(() => {
  const authService = useService(AuthService);
  const notificationService = useService(NotificationService);

  return (
    <div>
      {authService.isLoggedIn ? (
        <div>
          <p>欢迎, {authService.user.username}</p>
          <button onClick={() => authService.logout()}>退出登录</button>
        </div>
      ) : (
        <button onClick={() => authService.login('user')}>登录</button>
      )}

      <div>
        <h3>通知</h3>
        <ul>
          {notificationService.messages.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
        <button onClick={() => notificationService.addMessage('新消息')}>添加通知</button>
      </div>
    </div>
  );
});

// 注册多个 Service
export default bindServices(AppContent, [AuthService, NotificationService]);
```

### Service 之间的依赖

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

export class LoggerService extends Service {
  logs: string[] = [];

  log(message: string) {
    this.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  }
}

export class UserService extends Service {
  @Inject(LoggerService)
  private logger!: LoggerService;

  users: any[] = [];

  async fetchUsers() {
    this.logger.log('开始加载用户列表');
    const response = await fetch('/api/users');
    this.users = await response.json();
    this.logger.log(`成功加载 ${this.users.length} 个用户`);
  }
}

// 组件中使用
const UserListContent = observer(() => {
  const userService = useService(UserService);
  const loggerService = useService(LoggerService);

  return (
    <div>
      <button onClick={() => userService.fetchUsers()}>加载用户</button>
      <ul>
        {userService.users.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>

      <h3>日志</h3>
      <ul>
        {loggerService.logs.map((log, i) => (
          <li key={i}>{log}</li>
        ))}
      </ul>
    </div>
  );
});

// 注册 Service - LoggerService 会自动被注入到 UserService
export default bindServices(UserListContent, [LoggerService, UserService]);
```

### bindServices 工作原理

`bindServices` 做了以下事情：

1. **创建容器** - 为组件创建一个独立的依赖注入容器
2. **注册 Service** - 将所有传入的 Service 类注册到容器中
3. **提供 Context** - 通过 React Context 将容器提供给组件及其子组件
4. **包装组件** - 返回一个包装后的组件，使得 `useService` 可以访问容器

```typescript
// bindServices 的简化实现逻辑
function bindServices(Component, services) {
  return props => {
    // 1. 创建容器
    const container = new Container();

    // 2. 注册 Service
    services.forEach(service => container.register(service));

    // 3. 通过 Context 提供容器
    return (
      <ContainerContext.Provider value={container}>
        <Component {...props} />
      </ContainerContext.Provider>
    );
  };
}

// useService 的简化实现逻辑
function useService(ServiceClass) {
  const container = useContext(ContainerContext);
  return container.get(ServiceClass);
}
```

## 装饰器

### @Action 和 @SyncAction

```typescript
import { Service, Action, SyncAction } from '@rabjs/react';

export class DataService extends Service {
  count = 0;
  data: any = null;

  // 默认所有方法都是 action（支持批量更新）
  increment() {
    this.count++;
  }

  // 使用 @SyncAction 排除批量更新
  @SyncAction
  directUpdate() {
    this.count++;
    // 这个方法会立即执行，不会等待批量更新
  }

  // 异步方法也是 Action
  async fetchData() {
    const response = await fetch('/api/data');
    this.data = await response.json();
  }
}
```

### @Debounce

```typescript
import { Service, debounce } from '@rabjs/react';
import { observer, useService, bindServices } from '@rabjs/react';

export class SearchService extends Service {
  query: string = '';
  results: any[] = [];

  @Debounce(300)
  async search() {
    const response = await fetch(`/api/search?q=${this.query}`);
    this.results = await response.json();
  }
}

// 在组件中使用
const SearchBoxContent = observer(() => {
  const service = useService(SearchService);

  return (
    <div>
      <input
        value={service.query}
        onChange={e => {
          service.query = e.target.value;
          service.search(); // 会自动防抖
        }}
      />
      <ul>
        {service.results.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(SearchBoxContent, [SearchService]);
```

## 内置事件系统

Service 内置了完整的事件系统，支持容器级别和全局事件，无需额外的事件管理库。

### 基本用法

```typescript
import { Service } from '@rabjs/react';

export class UserService extends Service {
  user: any = null;

  constructor() {
    super();

    // 监听容器级别事件（默认）
    this.on('user:update', (user: any) => {
      console.log('User updated:', user);
      this.user = user;
    });

    // 监听全局事件
    this.on(
      'app:theme-changed',
      (theme: string) => {
        console.log('Theme changed:', theme);
      },
      'global'
    );
  }

  login(username: string, password: string) {
    // 登录逻辑...
    const user = { id: 1, name: username };
    this.user = user;

    // 发送容器级别事件
    this.emit('user:login', user);

    // 发送全局事件
    this.emit('app:user-logged-in', user, 'global');
  }

  logout() {
    this.user = null;
    this.emit('user:logout');
  }
}
```

### 事件方法

#### on - 监听事件

```typescript
class MyService extends Service {
  constructor() {
    super();

    // 监听容器级别事件（默认）
    this.on('event:name', data => {
      console.log('Received:', data);
    });

    // 监听全局事件
    this.on(
      'global:event',
      data => {
        console.log('Global event:', data);
      },
      'global'
    );
  }
}
```

#### once - 监听一次性事件

```typescript
class MyService extends Service {
  constructor() {
    super();

    // 只触发一次
    this.once('data:loaded', data => {
      console.log('Data loaded once:', data);
    });

    // 全局一次性事件
    this.once(
      'app:initialized',
      () => {
        console.log('App initialized');
      },
      'global'
    );
  }
}
```

#### emit - 发送事件

```typescript
class MyService extends Service {
  sendMessage(message: string) {
    // 发送容器级别事件
    this.emit('message:sent', { message });

    // 发送全局事件
    this.emit('global:message', { message }, 'global');
  }
}
```

#### off - 移除事件监听器

```typescript
class MyService extends Service {
  private handler = (data: any) => {
    console.log('Received:', data);
  };

  constructor() {
    super();
    this.on('event:name', this.handler);
  }

  destroy() {
    // 移除特定监听器
    this.off('event:name', this.handler);

    // 移除事件的所有监听器
    this.off('event:name');

    super.destroy();
  }
}
```

### 容器级别 vs 全局事件

```typescript
// 容器级别事件 - 仅在当前容器内有效
class ServiceA extends Service {
  constructor() {
    super();
    this.on('container:event', data => {
      console.log('Container event:', data);
    });
  }
}

class ServiceB extends Service {
  sendContainerEvent() {
    // 只有同一容器内的 ServiceA 能收到
    this.emit('container:event', { message: 'Hello' });
  }
}

// 全局事件 - 所有容器共享
class ServiceC extends Service {
  constructor() {
    super();
    this.on(
      'global:event',
      data => {
        console.log('Global event:', data);
      },
      'global'
    );
  }
}

class ServiceD extends Service {
  sendGlobalEvent() {
    // 所有容器内的 ServiceC 都能收到
    this.emit('global:event', { message: 'Hello' }, 'global');
  }
}
```

### Service 间通信

```typescript
import { Service, Inject } from '@rabjs/react';

// 发送方 Service
export class ChatService extends Service {
  messages: Array<{ from: string; text: string }> = [];

  sendMessage(from: string, text: string) {
    const message = { from, text };
    this.messages.push(message);

    // 发送事件通知其他 Service
    this.emit('chat:message', message);
  }
}

// 接收方 Service
export class NotificationService extends Service {
  notifications: string[] = [];

  constructor() {
    super();

    // 监听聊天消息事件
    this.on('chat:message', (message: { from: string; text: string }) => {
      this.notifications.push(`${message.from}: ${message.text}`);
    });
  }
}

// 在组件中使用
const ChatComponent = observer(() => {
  const chatService = useService(ChatService);
  const notificationService = useService(NotificationService);

  return (
    <div>
      <button onClick={() => chatService.sendMessage('User', 'Hello')}>发送消息</button>
      <ul>
        {notificationService.notifications.map((notif, i) => (
          <li key={i}>{notif}</li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(ChatComponent, [ChatService, NotificationService]);
```

### 跨容器通信

```typescript
// 使用全局事件实现跨容器通信
export class PageAService extends Service {
  sendToPageB(data: any) {
    // 发送全局事件
    this.emit('page:data', data, 'global');
  }
}

export class PageBService extends Service {
  receivedData: any = null;

  constructor() {
    super();

    // 监听全局事件
    this.on(
      'page:data',
      (data: any) => {
        this.receivedData = data;
      },
      'global'
    );
  }
}

// PageA 组件
const PageAContent = observer(() => {
  const service = useService(PageAService);
  return (
    <button onClick={() => service.sendToPageB({ message: 'Hello from A' })}>发送到 PageB</button>
  );
});

export const PageA = bindServices(PageAContent, [PageAService]);

// PageB 组件
const PageBContent = observer(() => {
  const service = useService(PageBService);
  return <div>收到: {service.receivedData?.message}</div>;
});

export const PageB = bindServices(PageBContent, [PageBService]);
```

### 类型安全的事件

```typescript
// 定义事件类型
interface UserLoginEvent {
  id: number;
  name: string;
  email: string;
}

interface MessageEvent {
  from: string;
  text: string;
  timestamp: number;
}

export class TypedEventService extends Service {
  constructor() {
    super();

    // 使用泛型指定事件数据类型
    this.on<UserLoginEvent>('user:login', user => {
      console.log(user.id, user.name, user.email); // 类型安全
    });

    this.on<MessageEvent>('message:received', message => {
      console.log(message.from, message.text); // 类型安全
    });
  }

  login(user: UserLoginEvent) {
    // 发送类型安全的事件
    this.emit<UserLoginEvent>('user:login', user);
  }

  sendMessage(message: MessageEvent) {
    this.emit<MessageEvent>('message:received', message);
  }
}
```

## 高级模式

### 1. 服务组合

```typescript
import { Service, Inject } from '@rabjs/react';

export class AuthService extends Service {
  token: string | null = null;
  user: any = null;

  async login(username: string, password: string) {
    const response = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    this.token = data.token;
    this.user = data.user;

    // 发送登录成功事件
    this.emit('auth:login-success', this.user);
  }

  logout() {
    this.token = null;
    this.user = null;
    this.emit('auth:logout');
  }
}

export class AppService extends Service {
  @Inject(AuthService)
  auth!: AuthService;

  constructor() {
    super();

    // 监听认证事件
    this.on('auth:login-success', (user: any) => {
      console.log('User logged in:', user);
    });

    this.on('auth:logout', () => {
      console.log('User logged out');
    });
  }

  get isLoggedIn() {
    return this.auth.token !== null;
  }

  get currentUser() {
    return this.auth.user;
  }
}
```

### 2. 状态持久化

```typescript
import { Service } from '@rabjs/react';

export class PersistentService extends Service {
  data: any = null;

  constructor() {
    super();
    this.loadFromStorage();

    // 监听数据变化事件
    this.on('data:changed', (data: any) => {
      this.saveToStorage(data);
    });
  }

  private loadFromStorage() {
    const stored = localStorage.getItem('app-data');
    if (stored) {
      this.data = JSON.parse(stored);
    }
  }

  private saveToStorage(data: any) {
    localStorage.setItem('app-data', JSON.stringify(data));
  }

  updateData(newData: any) {
    this.data = newData;
    // 发送数据变化事件
    this.emit('data:changed', newData);
  }
}
```

### 3. 事件驱动的状态同步

```typescript
import { Service } from '@rabjs/react';

export class CounterService extends Service {
  count = 0;

  constructor() {
    super();

    // 监听增加事件
    this.on('counter:increment', () => {
      this.count++;
      this.emit('counter:changed', this.count);
    });

    // 监听减少事件
    this.on('counter:decrement', () => {
      this.count--;
      this.emit('counter:changed', this.count);
    });
  }
}

// 在组件中使用
const CounterComponent = observer(() => {
  const service = useService(CounterService);

  return (
    <div>
      <p>Count: {service.count}</p>
      <button onClick={() => service.emit('counter:increment')}>+</button>
      <button onClick={() => service.emit('counter:decrement')}>-</button>
    </div>
  );
});

export default bindServices(CounterComponent, [CounterService]);
```

## 性能优化

### 1. 使用计算属性缓存

```typescript
import { Service } from '@rabjs/react';

export class ListService extends Service {
  items: any[] = [];
  filter: string = '';

  // 计算属性会自动缓存，只在依赖变化时重新计算
  get filteredItems() {
    return this.items.filter(item => item.name.toLowerCase().includes(this.filter.toLowerCase()));
  }

  get itemCount() {
    return this.filteredItems.length;
  }
}
```

### 2. 避免不必要的重新渲染

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

const OptimizedListContent = observer(() => {
  const service = useService(ListService);

  return (
    <div>
      {/* 只在 filteredItems 变化时重新渲染 */}
      <ul>
        {service.filteredItems.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      {/* 只在 itemCount 变化时重新渲染 */}
      <p>总数: {service.itemCount}</p>
    </div>
  );
});

export default bindServices(OptimizedListContent, [ListService]);
```

## 下一步

- 🏗️ 了解 [Service 领域](./service-domain.md) 的架构设计
- 🔍 了解 [observer vs view](./observer-vs-view.md) 的区别
- 🪝 了解 [其他 Hooks](./hooks.md)
- 🌐 了解 [SSR 支持](./ssr.md)
