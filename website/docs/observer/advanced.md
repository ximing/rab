# 高级用法

掌握 RSJS 响应式系统的高级特性和最佳实践。

## 性能优化

### 1. 细粒度更新

RSJS 会自动追踪细粒度的属性访问，只在相关属性变化时重新执行。

```typescript
const state = observable({
  user: { name: 'John', age: 30 },
  posts: [{ id: 1, title: 'Post 1' }],
  settings: { theme: 'dark', language: 'en' },
});

let userExecutions = 0;
let postsExecutions = 0;

observe(() => {
  userExecutions++;
  console.log('User:', state.user.name);
});

observe(() => {
  postsExecutions++;
  console.log('Posts:', state.posts.length);
});

console.log('User executions:', userExecutions); // 1
console.log('Posts executions:', postsExecutions); // 1

state.user.name = 'Jane';
console.log('User executions:', userExecutions); // 2
console.log('Posts executions:', postsExecutions); // 1

state.posts.push({ id: 2, title: 'Post 2' });
console.log('User executions:', userExecutions); // 2
console.log('Posts executions:', postsExecutions); // 2

state.settings.theme = 'light';
console.log('User executions:', userExecutions); // 2
console.log('Posts executions:', postsExecutions); // 2
```

### 2. 批量更新

使用 `configure` 配置全局 scheduler 实现批量更新。

```typescript
import { configure } from '@rabjs/react';

// 配置全局 scheduler
configure({
  scheduler: callback => {
    // 使用 requestAnimationFrame 批量更新
    requestAnimationFrame(callback);
  },
});

const state = observable({
  count: 0,
  message: '',
  timestamp: 0,
});

let executionCount = 0;

observe(() => {
  executionCount++;
  console.log('State changed');
});

// 多个属性变化
state.count = 1;
state.message = 'Hello';
state.timestamp = Date.now();

// 只会执行一次 reaction
console.log('Executions:', executionCount); // 1
```

### 3. Shadow Observable

对于大型对象，使用 shadow observable 可以提高性能。

```typescript
import { shadowObservable } from '@rabjs/react';

// 普通 observable - 追踪所有嵌套属性
const normal = observable({
  data: new Array(10000).fill(0),
});

// Shadow observable - 只追踪顶层属性
const shadow = shadowObservable({
  data: new Array(10000).fill(0),
});

let normalExecutions = 0;
let shadowExecutions = 0;

observe(() => {
  normalExecutions++;
  console.log('Normal data length:', normal.data.length);
});

observe(() => {
  shadowExecutions++;
  console.log('Shadow data length:', shadow.data.length);
});

// 修改数组元素
normal.data[0] = 1;
console.log('Normal executions:', normalExecutions); // 2

shadow.data[0] = 1;
console.log('Shadow executions:', shadowExecutions); // 1

// 替换整个数组
normal.data = new Array(10000).fill(1);
console.log('Normal executions:', normalExecutions); // 3

shadow.data = new Array(10000).fill(1);
console.log('Shadow executions:', shadowExecutions); // 2
```

## 内存管理

### 1. 自动清理

RSJS 会自动清理不再使用的 reaction。

```typescript
const state = observable({ count: 0 });

// 创建 reaction
const reaction = observe(() => {
  console.log('Count:', state.count);
});

// 手动清理
reaction.dispose?.();

state.count = 1;
// 不输出
```

### 2. 防止内存泄漏

```typescript
// ❌ 不好 - 可能导致内存泄漏
class Component {
  reaction: any;

  constructor() {
    this.reaction = observe(() => {
      console.log('State changed');
    });
  }

  // 没有清理 reaction
}

// ✅ 好 - 正确清理
class Component {
  reaction: any;

  constructor() {
    this.reaction = observe(() => {
      console.log('State changed');
    });
  }

  destroy() {
    this.reaction.dispose?.();
  }
}

const component = new Component();
// ...
component.destroy();
```

### 3. 弱引用

使用 WeakMap 和 WeakSet 可以避免强引用导致的内存泄漏。

```typescript
const state = observable({
  cache: new WeakMap(),
  tags: new WeakSet(),
});

const obj = { id: 1 };

state.cache.set(obj, 'cached value');
state.tags.add(obj);

// 当 obj 被垃圾回收时，缓存和标签也会被自动清理
```

## 高级模式

### 1. 状态机

```typescript
const state = observable({
  status: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  data: null as any,
  error: null as Error | null,
});

const actions = {
  async load() {
    state.status = 'loading';
    state.error = null;

    try {
      const response = await fetch('/api/data');
      state.data = await response.json();
      state.status = 'success';
    } catch (error) {
      state.error = error as Error;
      state.status = 'error';
    }
  },

  reset() {
    state.status = 'idle';
    state.data = null;
    state.error = null;
  },
};

observe(() => {
  switch (state.status) {
    case 'idle':
      console.log('Ready to load');
      break;
    case 'loading':
      console.log('Loading...');
      break;
    case 'success':
      console.log('Data loaded:', state.data);
      break;
    case 'error':
      console.log('Error:', state.error?.message);
      break;
  }
});
```

### 2. 事件系统

```typescript
const eventBus = observable({
  listeners: new Map<string, Set<Function>>(),

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  },

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  },

  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  },
});

// 使用
eventBus.on('user-login', user => {
  console.log('User logged in:', user);
});

eventBus.emit('user-login', { id: 1, name: 'John' });
// 输出: User logged in: { id: 1, name: 'John' }
```

### 3. 撤销/重做

```typescript
const state = observable({
  value: 0,
  history: [0],
  historyIndex: 0,
});

const actions = {
  setValue(value: number) {
    // 移除当前位置之后的历史
    state.history = state.history.slice(0, state.historyIndex + 1);
    // 添加新值
    state.history.push(value);
    state.historyIndex++;
    state.value = value;
  },

  undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      state.value = state.history[state.historyIndex];
    }
  },

  redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      state.value = state.history[state.historyIndex];
    }
  },

  get canUndo() {
    return state.historyIndex > 0;
  },

  get canRedo() {
    return state.historyIndex < state.history.length - 1;
  },
};

actions.setValue(1);
actions.setValue(2);
actions.setValue(3);

console.log(state.value); // 3

actions.undo();
console.log(state.value); // 2

actions.undo();
console.log(state.value); // 1

actions.redo();
console.log(state.value); // 2
```

## 调试

### 1. 使用 Debugger

```typescript
const state = observable({
  count: 0,
  name: 'John',
});

observe(
  () => {
    console.log('Count:', state.count);
    console.log('Name:', state.name);
  },
  {
    debugger: operation => {
      console.log('Operation:', {
        type: operation.type,
        target: operation.target,
        key: operation.key,
        value: operation.value,
      });
    },
  }
);

state.count = 1;
// 输出: Operation: { type: 'set', target: {...}, key: 'count', value: 1 }
```

### 2. 追踪执行

```typescript
const state = observable({ count: 0 });

let executionCount = 0;

const reaction = observe(() => {
  executionCount++;
  console.log(`Execution #${executionCount}: Count = ${state.count}`);
});

state.count = 1;
state.count = 2;
state.count = 3;

console.log(`Total executions: ${executionCount}`);
```

### 3. 性能监测

```typescript
const state = observable({
  items: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: 0 })),
});

const startTime = performance.now();

const reaction = observe(() => {
  const sum = state.items.reduce((acc, item) => acc + item.value, 0);
  console.log('Sum:', sum);
});

const endTime = performance.now();
console.log(`Reaction creation time: ${endTime - startTime}ms`);

const updateStart = performance.now();
state.items[0].value = 100;
const updateEnd = performance.now();
console.log(`Update time: ${updateEnd - updateStart}ms`);
```

## 最佳实践

### 1. 分离关注点

```typescript
// ✅ 好 - 分离状态和操作
const state = observable({
  count: 0,
  message: '',
});

const actions = {
  increment() {
    state.count++;
  },
  setMessage(msg: string) {
    state.message = msg;
  },
};

// ❌ 不好 - 混合状态和操作
const state = observable({
  count: 0,
  increment() {
    this.count++;
  },
});
```

### 2. 使用类型

```typescript
// ✅ 好 - 类型清晰
interface AppState {
  user: { id: string; name: string } | null;
  posts: Array<{ id: string; title: string }>;
  loading: boolean;
}

const state = observable<AppState>({
  user: null,
  posts: [],
  loading: false,
});

// ❌ 不好 - 类型不清晰
const state = observable({
  user: null,
  posts: [],
  loading: false,
});
```

### 3. 避免过度优化

```typescript
// ❌ 不好 - 过度优化
const state = observable({
  count: 0,
  get doubledCount() {
    return this.count * 2;
  },
  get tripledCount() {
    return this.count * 3;
  },
  get quadrupledCount() {
    return this.count * 4;
  },
  // ... 更多计算属性
});

// ✅ 好 - 只计算需要的
const state = observable({
  count: 0,
});

const computed = {
  get doubledCount() {
    return state.count * 2;
  },
};
```

## 常见问题

### Q: 为什么我的 reaction 没有执行？

A: 确保你在 reaction 中访问了 observable 属性。如果只是读取了普通变量，不会触发追踪。

```typescript
// ❌ 错误 - 没有访问 observable
const count = state.count;
observe(() => {
  console.log('Count:', count); // count 是普通变量，不会被追踪
});

// ✅ 正确 - 访问 observable
observe(() => {
  console.log('Count:', state.count); // state.count 会被追踪
});
```

### Q: 如何避免无限循环？

A: 避免在 reaction 中修改被追踪的属性。

```typescript
// ❌ 错误 - 无限循环
observe(() => {
  state.count++;
});

// ✅ 正确 - 使用条件判断
observe(() => {
  if (state.count < 10) {
    state.count++;
  }
});
```

### Q: 如何处理异步操作？

A: 使用 async/await 或 Promise。

```typescript
observe(async () => {
  const data = await fetch('/api/data').then(r => r.json());
  state.data = data;
});
```

## 下一步

- 📖 查看 [React 集成](../react-service/quick-start.md)
- 🔧 了解 [Service 架构](../react-service/service-deep-dive.md)
