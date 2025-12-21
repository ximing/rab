# 响应式状态介绍

深入了解 RSJS 响应式系统的核心概念。

## 什么是响应式？

响应式是指当数据变化时，依赖这些数据的代码会自动重新执行。这是一种声明式的编程范式，与命令式编程相对。

### 命令式 vs 声明式

```typescript
// 命令式 - 手动管理依赖
let count = 0;
let doubled = count * 2;

count = 5;
// 需要手动更新 doubled
doubled = count * 2;

console.log(doubled); // 10
```

```typescript
// 声明式 - 自动管理依赖
import { observable, observe } from '@rabjs/react';

const state = observable({ count: 0 });

observe(() => {
  console.log('Doubled:', state.count * 2);
});

state.count = 5; // 自动输出: Doubled: 10
```

## 核心概念

### 1. Observable（响应式对象）

Observable 是一个被代理的对象，其属性访问和修改都会被追踪。

```typescript
import { observable } from '@rabjs/react';

// 创建 observable
const state = observable({
  count: 0,
  name: 'John',
  nested: {
    value: 42,
  },
});

// 访问属性
console.log(state.count); // 0

// 修改属性
state.count = 1;

// 修改嵌套属性
state.nested.value = 100;

// 添加新属性
state.age = 30;
```

### 2. Observe（观察者）

Observe 是一个函数，用于追踪 observable 属性的访问，当这些属性变化时自动重新执行。

```typescript
import { observable, observe } from '@rabjs/react';

const state = observable({ count: 0 });

// 创建观察者
const reaction = observe(() => {
  console.log('Count changed:', state.count);
});

state.count = 1; // 输出: Count changed: 1
state.count = 2; // 输出: Count changed: 2

// 停止观察
reaction.dispose?.();
state.count = 3; // 不输出
```

### 3. Reaction（反应）

Reaction 是 observe 返回的函数，代表一个响应式的计算。

```typescript
const reaction = observe(() => {
  // 这个函数会在依赖的 observable 属性变化时重新执行
  console.log('Reaction executed');
});

// 手动执行 reaction
reaction();

// 清理 reaction
reaction.dispose?.();
```

## 工作原理

### 追踪过程

```
1. 创建 Observable
   ↓
2. 创建 Observe（Reaction）
   ↓
3. 执行 Reaction 函数
   ↓
4. 追踪属性访问
   ↓
5. 建立依赖关系
   ↓
6. 当属性变化时，触发 Reaction 重新执行
```

### 示例

```typescript
import { observable, observe } from '@rabjs/react';

const state = observable({
  firstName: 'John',
  lastName: 'Doe',
});

// 创建 reaction
const reaction = observe(() => {
  // 这个函数会追踪 state.firstName 和 state.lastName 的访问
  const fullName = `${state.firstName} ${state.lastName}`;
  console.log('Full name:', fullName);
});

// 输出: Full name: John Doe

// 修改 firstName
state.firstName = 'Jane';
// 输出: Full name: Jane Doe

// 修改 lastName
state.lastName = 'Smith';
// 输出: Full name: Jane Smith
```

## 自动追踪

RSJS 会自动追踪 reaction 中访问的所有 observable 属性。

### 条件追踪

```typescript
const state = observable({
  showName: true,
  name: 'John',
  age: 30,
});

observe(() => {
  if (state.showName) {
    // 只有当 showName 为 true 时，才会追踪 name
    console.log('Name:', state.name);
  } else {
    // 当 showName 为 false 时，会追踪 age
    console.log('Age:', state.age);
  }
});

// 输出: Name: John

state.showName = false;
// 输出: Age: 30

state.name = 'Jane';
// 不输出（因为 showName 为 false，不再追踪 name）

state.age = 31;
// 输出: Age: 31
```

### 循环追踪

```typescript
const state = observable({
  items: [1, 2, 3],
});

observe(() => {
  // 会追踪数组的每个元素
  const sum = state.items.reduce((a, b) => a + b, 0);
  console.log('Sum:', sum);
});

// 输出: Sum: 6

state.items[0] = 10;
// 输出: Sum: 15

state.items.push(4);
// 输出: Sum: 19
```

## 性能特性

### 1. 细粒度追踪

RSJS 只追踪实际访问的属性，不会追踪未使用的属性。

```typescript
const state = observable({
  count: 0,
  name: 'John',
  unused: 'value',
});

let executionCount = 0;

observe(() => {
  executionCount++;
  console.log('Count:', state.count);
  console.log('Name:', state.name);
  // 没有访问 state.unused
});

console.log('Executions:', executionCount); // 1

state.unused = 'new value';
console.log('Executions:', executionCount); // 1（不会重新执行）

state.count = 1;
console.log('Executions:', executionCount); // 2（会重新执行）
```

### 2. 自动批量更新

多个属性变化可以通过配置 scheduler 来实现批量更新。

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
});

let executionCount = 0;

observe(() => {
  executionCount++;
  console.log('Count:', state.count, 'Message:', state.message);
});

// 多个属性变化
state.count = 1;
state.message = 'Hello';

// 只会执行一次 reaction
console.log('Executions:', executionCount); // 1
```

## 内存管理

### 自动清理

RSJS 会自动清理不再使用的 reaction。

```typescript
const state = observable({ count: 0 });

const reaction = observe(() => {
  console.log('Count:', state.count);
});

// 手动清理
reaction.dispose?.();

state.count = 1; // 不输出
```

### 防止内存泄漏

```typescript
// ✅ 正确 - 使用 useEffect 清理
React.useEffect(() => {
  const reaction = observe(() => {
    console.log('Count:', state.count);
  });

  return () => {
    reaction.dispose?.();
  };
}, []);

// ❌ 错误 - 没有清理
const reaction = observe(() => {
  console.log('Count:', state.count);
});
```

## 高级特性

### 1. 嵌套 Observable

```typescript
const state = observable({
  user: {
    name: 'John',
    address: {
      city: 'Beijing',
      country: 'China',
    },
  },
});

observe(() => {
  console.log('City:', state.user.address.city);
});

// 修改嵌套属性
state.user.address.city = 'Shanghai';
// 输出: City: Shanghai
```

### 2. 数组和集合

```typescript
const state = observable({
  items: [1, 2, 3],
  tags: new Set(['a', 'b', 'c']),
  map: new Map([['key', 'value']]),
});

observe(() => {
  console.log('Items:', state.items);
  console.log('Tags:', Array.from(state.tags));
  console.log('Map:', Array.from(state.map.entries()));
});

state.items.push(4);
state.tags.add('d');
state.map.set('key2', 'value2');
```

### 3. 计算属性

```typescript
const state = observable({
  firstName: 'John',
  lastName: 'Doe',
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  },
});

observe(() => {
  console.log('Full name:', state.fullName);
});

state.firstName = 'Jane';
// 输出: Full name: Jane Doe
```

## 下一步

- 📖 了解 [Observable](./observable.md) 的详细用法
- 👁️ 学习 [Observe](./observe.md) 的高级特性
- 🚀 查看 [高级用法](./advanced.md) 和最佳实践
