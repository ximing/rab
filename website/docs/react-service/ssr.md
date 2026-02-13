# SSR 支持

在服务端渲染（SSR）应用中使用 RSJS。

## 什么是 SSR？

服务端渲染（Server-Side Rendering）是指在服务器上执行 React 代码，生成 HTML 字符串，然后发送给客户端。这与客户端渲染（CSR）不同，CSR 是在浏览器中执行 React 代码。

## SSR 中的挑战

在 SSR 中使用响应式状态库面临以下挑战：

1. **服务器上没有 DOM** - 无法使用浏览器 API
2. **没有事件循环** - 无法使用 setTimeout 等异步 API
3. **状态同步** - 需要将服务器上的状态同步到客户端
4. **性能** - 需要快速生成 HTML

## 配置 SSR

### 1. 启用静态渲染模式

在服务器上渲染时，需要启用静态渲染模式：

```typescript
// server.ts
import { enableStaticRendering } from '@rabjs/react';

// 在服务器上启用静态渲染
enableStaticRendering(true);

// 渲染应用
const html = renderToString(<App />);

// 在客户端禁用静态渲染
enableStaticRendering(false);
```

### 2. 完整的 SSR 示例

```typescript
// server.ts
import express from 'express';
import { renderToString } from 'react-dom/server';
import { enableStaticRendering } from '@rabjs/react';
import { App } from './App';

const app = express();

app.get('/', (req, res) => {
  // 启用静态渲染
  enableStaticRendering(true);

  try {
    // 渲染应用
    const html = renderToString(<App />);

    // 发送 HTML
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>My App</title>
        </head>
        <body>
          <div id="root">${html}</div>
          <script src="/client.js"></script>
        </body>
      </html>
    `);
  } finally {
    // 禁用静态渲染
    enableStaticRendering(false);
  }
});

app.listen(3000);
```

```typescript
// client.ts
import { hydrateRoot } from 'react-dom/client';
import { App } from './App';

// 水合应用
hydrateRoot(document.getElementById('root')!, <App />);
```

## 静态渲染模式

### 工作原理

当启用静态渲染模式时：

1. `useObserver` 会直接执行渲染函数，不创建 reaction
2. 不会追踪 observable 属性的访问
3. 不会订阅状态变化
4. 组件只会渲染一次

```typescript
// 在静态渲染模式下
export function Counter() {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
  }));

  return useObserver(() => {
    // 在服务器上：直接执行，返回 JSX
    // 在客户端：创建 reaction，追踪 state.count
    return <div>Count: {state.count}</div>;
  });
}
```

### 何时使用

```typescript
import { isUsingStaticRendering } from '@rabjs/react';

export function Component() {
  if (isUsingStaticRendering()) {
    // 在服务器上执行
    return <div>Server rendered</div>;
  } else {
    // 在客户端执行
    return <div>Client rendered</div>;
  }
}
```

## 状态同步

### 问题

在 SSR 中，服务器和客户端需要渲染相同的 HTML。如果状态不同步，会导致水合失败。

### 解决方案

#### 1. 使用初始状态

```typescript
// server.ts
export function renderApp(initialState: any) {
  enableStaticRendering(true);

  try {
    const html = renderToString(<App initialState={initialState} />);
    return html;
  } finally {
    enableStaticRendering(false);
  }
}

// App.tsx
export function App({ initialState }: { initialState: any }) {
  const service = useLocalObservable(() => new DataService(initialState));

  return useObserver(() => (
    <div>
      <p>Data: {service.data}</p>
    </div>
  ));
}

// DataService.ts
export class DataService extends Service {
  data: any = null;

  constructor(initialState: any) {
    super();
    if (initialState) {
      this.data = initialState.data;
    }
  }
}
```

#### 2. 序列化状态

```typescript
// server.ts
import { renderToString } from 'react-dom/server';

export function renderApp() {
  enableStaticRendering(true);

  const service = new DataService();
  // 在服务器上初始化数据
  service.data = { id: 1, name: 'Test' };

  try {
    const html = renderToString(<App service={service} />);

    // 序列化状态
    const state = JSON.stringify({
      data: service.data,
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>My App</title>
        </head>
        <body>
          <div id="root">${html}</div>
          <script>
            window.__INITIAL_STATE__ = ${state};
          </script>
          <script src="/client.js"></script>
        </body>
      </html>
    `;
  } finally {
    enableStaticRendering(false);
  }
}

// client.ts
const initialState = (window as any).__INITIAL_STATE__;
const service = new DataService(initialState);

hydrateRoot(document.getElementById('root')!, <App service={service} />);
```

## 常见问题

### Q: 为什么需要 `enableStaticRendering`？

A: 在服务器上，没有浏览器事件循环和 DOM。启用静态渲染模式可以让 RSJS 在服务器上正确工作，避免创建不必要的 reaction 和订阅。

### Q: 如何处理异步操作？

A: 在服务器上，应该在渲染前完成所有异步操作，然后将结果作为初始状态传递给组件。

```typescript
// server.ts
export async function renderApp() {
  enableStaticRendering(true);

  try {
    // 在渲染前完成异步操作
    const data = await fetchData();

    const html = renderToString(<App initialData={data} />);

    return html;
  } finally {
    enableStaticRendering(false);
  }
}
```

### Q: 如何避免水合不匹配？

A: 确保服务器和客户端使用相同的初始状态：

```typescript
// ✅ 正确
export function App({ initialState }: { initialState: any }) {
  const service = useLocalObservable(() => new Service(initialState));
  return useObserver(() => <div>{service.data}</div>);
}

// ❌ 错误 - 使用随机值
export function App() {
  const service = useLocalObservable(() => ({
    id: Math.random(), // 每次都不同！
  }));
  return useObserver(() => <div>{service.id}</div>);
}
```

### Q: 如何在 SSR 中使用 Service 依赖注入？

A: 为每个请求创建独立的容器：

```typescript
// server.ts
import { Container } from '@rabjs/react';

app.get('/', (req, res) => {
  enableStaticRendering(true);

  try {
    // 为每个请求创建独立的容器
    const container = new Container();
    container.register(UserService);
    container.register(DataService);

    const html = renderToString(<App container={container} />);

    res.send(html);
  } finally {
    enableStaticRendering(false);
  }
});

// App.tsx
export function App({ container }: { container: Container }) {
  const userService = container.get(UserService);
  const dataService = container.get(DataService);

  return useObserver(() => (
    <div>
      <p>User: {userService.name}</p>
      <p>Data: {dataService.data}</p>
    </div>
  ));
}
```

## 性能优化

### 1. 缓存渲染结果

```typescript
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({ max: 100 });

app.get('/:id', (req, res) => {
  const cacheKey = `page-${req.params.id}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    res.send(cached);
    return;
  }

  enableStaticRendering(true);

  try {
    const html = renderToString(<App id={req.params.id} />);
    cache.set(cacheKey, html);
    res.send(html);
  } finally {
    enableStaticRendering(false);
  }
});
```

### 2. 流式渲染

```typescript
import { renderToPipeableStream } from 'react-dom/server';

app.get('/', (req, res) => {
  enableStaticRendering(true);

  const { pipe } = renderToPipeableStream(<App />, {
    onShellReady() {
      res.setHeader('content-type', 'text/html');
      pipe(res);
    },
  });
});
```

## 下一步

- 📖 了解 [响应式状态](../observer/introduction.md) 的底层原理
- 🔧 查看 [深入 Service](./service-deep-dive.md) 的更多特性
- 🏗️ 了解 [Service 领域](./service-domain.md) 的架构设计
- 🔍 了解 [observer vs view](./observer-vs-view.md) 的区别
