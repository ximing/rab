# Observe

深入了解如何使用 Observe 追踪状态变化。

## 基础用法

### 创建 Observe

```typescript
import { observable, observe } from '@rabjs/react';

const state = observable({ count: 0 });

// 创建观察者
const reaction = observe(() => {
  console.log('Count:', state.count);
});

// 输出: Count: 0

state.count = 1;
// 输出: Count: 1

state.count = 2;
// 输出: Count: 2
```

### 停止观察

```typescript
const state = observable({ count: 0 });

const reaction = observe(() => {
  console.log('Count:', state.count);
});

// 停止观察
reaction.dispose?.();

state.count = 1;
// 不输出
```

## Observe 选项

### lazy 选项

默认情况下，observe 会立即执行一次。使用 `lazy: true` 可以延迟执行。

```typescript
const state = observable({ count: 0 });

// 默认行为 - 立即执行
observe(() => {
  console.log('Count:', state.count);
});
// 输出: Count: 0

// 延迟执行
observe(
  () => {
    console.log('Count:', state.count);
  },
  { lazy: true }
);
// 不输出

state.count = 1;
// 输出: Count: 1
```

### scheduler 选项

使用 `scheduler` 选项可以自定义何时执行 reaction。

```typescript
const state = observable({ count: 0 });

// 使用自定义 scheduler
observe(
  () => {
    console.log('Count:', state.count);
  },
  {
    scheduler: callback => {
      // 延迟 100ms 执行
      setTimeout(callback, 100);
    },
  }
);

state.count = 1;
// 100ms 后输出: Count: 1
```

### debugger 选项

使用 `debugger` 选项可以调试 reaction 的执行。

```typescript
const state = observable({ count: 0, name: 'John' });

observe(
  () => {
    console.log('Count:', state.count);
    console.log('Name:', state.name);
  },
  {
    debugger: operation => {
      console.log('Operation:', operation.type, operation.target, operation.key);
    },
  }
);

state.count = 1;
// 输出: Operation: set Object count
```

## 自动追踪

### 追踪属性访问

```typescript
const state = observable({
  firstName: 'John',
  lastName: 'Doe',
  age: 30,
});

let executionCount = 0;

observe(() => {
  executionCount++;
  // 只追踪 firstName 和 lastName
  console.log(`${state.firstName} ${state.lastName}`);
});

console.log('Executions:', executionCount); // 1

state.firstName = 'Jane';
console.log('Executions:', executionCount); // 2

state.age = 31;
console.log('Executions:', executionCount); // 2（age 没有被追踪）
```

### 条件追踪

```typescript
const state = observable({
  showDetails: false,
  name: 'John',
  email: 'john@example.com',
});

observe(() => {
  if (state.showDetails) {
    console.log('Name:', state.name);
    console.log('Email:', state.email);
  } else {
    console.log('Details hidden');
  }
});

// 输出: Details hidden

state.showDetails = true;
// 输出: Name: John
//       Email: john@example.com

state.name = 'Jane';
// 输出: Name: Jane
//       Email: john@example.com

state.showDetails = false;
// 输出: Details hidden

state.name = 'Bob';
// 不输出（因为 showDetails 为 false，不再追踪 name）
```

### 循环追踪

```typescript
const state = observable({
  items: [
    { id: 1, name: 'Item 1', done: false },
    { id: 2, name: 'Item 2', done: false },
    { id: 3, name: 'Item 3', done: false },
  ],
});

observe(() => {
  const doneTodos = state.items.filter(item => item.done);
  console.log('Done:', doneTodos.length);
});

// 输出: Done: 0

state.items[0].done = true;
// 输出: Done: 1

state.items.push({ id: 4, name: 'Item 4', done: true });
// 输出: Done: 2
```

## 高级用法

### 1. 手动执行 Reaction

```typescript
const state = observable({ count: 0 });

const reaction = observe(
  () => {
    console.log('Count:', state.count);
  },
  { lazy: true }
);

// 手动执行
reaction();
// 输出: Count: 0

state.count = 1;
// 输出: Count: 1

// 再次手动执行
reaction();
// 输出: Count: 1
```

### 2. 嵌套 Observe

```typescript
const state = observable({
  user: { name: 'John', age: 30 },
  posts: [{ id: 1, title: 'Post 1' }],
});

observe(() => {
  console.log('User:', state.user.name);

  observe(() => {
    console.log('Posts:', state.posts.length);
  });
});

// 输出: User: John
//       Posts: 1

state.user.name = 'Jane';
// 输出: User: Jane
//       Posts: 1

state.posts.push({ id: 2, title: 'Post 2' });
// 输出: Posts: 2
```

### 3. 条件 Observe

```typescript
const state = observable({
  enabled: true,
  count: 0,
});

let reaction: any = null;

observe(() => {
  if (state.enabled) {
    if (!reaction) {
      reaction = observe(() => {
        console.log('Count:', state.count);
      });
    }
  } else {
    if (reaction) {
      reaction.dispose?.();
      reaction = null;
    }
  }
});

// 输出: Count: 0

state.count = 1;
// 输出: Count: 1

state.enabled = false;
// 不输出

state.count = 2;
// 不输出

state.enabled = true;
// 输出: Count: 2
```

## 常见模式

### 1. 计算属性

```typescript
const state = observable({
  items: [1, 2, 3, 4, 5],
  filter: 'all',
});

let filteredItems: number[] = [];

observe(() => {
  if (state.filter === 'even') {
    filteredItems = state.items.filter(x => x % 2 === 0);
  } else if (state.filter === 'odd') {
    filteredItems = state.items.filter(x => x % 2 !== 0);
  } else {
    filteredItems = state.items;
  }
  console.log('Filtered:', filteredItems);
});

// 输出: Filtered: [1, 2, 3, 4, 5]

state.filter = 'even';
// 输出: Filtered: [2, 4]

state.items.push(6);
// 输出: Filtered: [2, 4, 6]
```

### 2. 副作用处理

```typescript
const state = observable({
  userId: null as string | null,
  user: null as any,
  loading: false,
  error: null as Error | null,
});

observe(async () => {
  if (!state.userId) {
    state.user = null;
    return;
  }

  state.loading = true;
  state.error = null;

  try {
    const response = await fetch(`/api/users/${state.userId}`);
    state.user = await response.json();
  } catch (error) {
    state.error = error as Error;
  } finally {
    state.loading = false;
  }
});

state.userId = '123';
// 自动加载用户数据
```

### 3. 数据验证

```typescript
const state = observable({
  email: '',
  password: '',
  errors: {} as Record<string, string>,
});

observe(() => {
  state.errors = {};

  if (!state.email) {
    state.errors.email = 'Email is required';
  } else if (!state.email.includes('@')) {
    state.errors.email = 'Invalid email';
  }

  if (!state.password) {
    state.errors.password = 'Password is required';
  } else if (state.password.length < 8) {
    state.errors.password = 'Password must be at least 8 characters';
  }
});

state.email = 'test';
// state.errors.email = 'Invalid email'

state.email = 'test@example.com';
// state.errors.email = undefined

state.password = '123';
// state.errors.password = 'Password must be at least 8 characters'

state.password = 'password123';
// state.errors.password = undefined
```

## 性能优化

### 1. 避免不必要的追踪

```typescript
// ❌ 不好 - 追踪了不需要的属性
observe(() => {
  const unused = state.unused;
  console.log('Count:', state.count);
});

// ✅ 好 - 只追踪需要的属性
observe(() => {
  console.log('Count:', state.count);
});
```

### 2. 使用 Lazy Observe

```typescript
// ❌ 不好 - 立即执行
observe(() => {
  console.log('Count:', state.count);
});

// ✅ 好 - 延迟执行
observe(
  () => {
    console.log('Count:', state.count);
  },
  { lazy: true }
);
```

### 3. 及时清理

```typescript
// ❌ 不好 - 没有清理
const reaction = observe(() => {
  console.log('Count:', state.count);
});

// ✅ 好 - 及时清理
const reaction = observe(() => {
  console.log('Count:', state.count);
});

// 不需要时清理
reaction.dispose?.();
```

## 错误处理

### 捕获错误

```typescript
const state = observable({ count: 0 });

const reaction = observe(() => {
  try {
    console.log('Count:', state.count);
    if (state.count > 10) {
      throw new Error('Count too large');
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

state.count = 15;
// 输出: Error: Count too large
```

## 下一步

- 📖 了解 [Observable](./observable.md) 的详细用法
- 🚀 查看 [高级用法](./advanced.md) 和最佳实践
