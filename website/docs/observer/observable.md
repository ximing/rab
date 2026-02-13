# Observable

深入了解如何创建和使用 Observable 对象。

## 基础用法

### 创建 Observable

```typescript
import { observable } from '@rabjs/react';

// 创建空 observable
const empty = observable({});

// 创建带初始值的 observable
const state = observable({
  count: 0,
  name: 'John',
  items: [1, 2, 3],
});

// 创建嵌套 observable
const nested = observable({
  user: {
    profile: {
      name: 'John',
      age: 30,
    },
  },
});
```

### 访问和修改属性

```typescript
const state = observable({
  count: 0,
  name: 'John',
});

// 读取属性
console.log(state.count); // 0
console.log(state.name); // 'John'

// 修改属性
state.count = 1;
state.name = 'Jane';

// 添加新属性
state.email = 'jane@example.com';

// 删除属性
delete state.email;
```

## 支持的数据类型

### 基本类型

```typescript
const state = observable({
  // 原始类型
  number: 42,
  string: 'hello',
  boolean: true,
  null: null,
  undefined: undefined,

  // 对象
  object: { a: 1, b: 2 },

  // 数组
  array: [1, 2, 3],

  // 日期
  date: new Date(),

  // 正则表达式
  regex: /test/i,
});
```

### 集合类型

```typescript
const state = observable({
  // Set
  set: new Set([1, 2, 3]),

  // Map
  map: new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ]),

  // WeakSet
  weakSet: new WeakSet(),

  // WeakMap
  weakMap: new WeakMap(),
});

// 操作集合
state.set.add(4);
state.map.set('key3', 'value3');
```

### 类型化数组

```typescript
const state = observable({
  uint8: new Uint8Array([1, 2, 3]),
  int16: new Int16Array([100, 200, 300]),
  float32: new Float32Array([1.5, 2.5, 3.5]),
  float64: new Float64Array([1.1, 2.2, 3.3]),
});

// 修改元素
state.uint8[0] = 10;
state.float32[1] = 5.5;
```

## 嵌套对象

### 自动深度追踪

```typescript
const state = observable({
  user: {
    profile: {
      name: 'John',
      contact: {
        email: 'john@example.com',
        phone: '123-456-7890',
      },
    },
  },
});

// 所有嵌套属性都是 observable 的
state.user.profile.name = 'Jane';
state.user.profile.contact.email = 'jane@example.com';
```

### 替换嵌套对象

```typescript
const state = observable({
  user: {
    name: 'John',
    age: 30,
  },
});

// 替换整个对象
state.user = {
  name: 'Jane',
  age: 25,
};

// 新对象也是 observable 的
state.user.name = 'Bob';
```

## 数组操作

### 基本操作

```typescript
const state = observable({
  items: [1, 2, 3],
});

// 访问元素
console.log(state.items[0]); // 1

// 修改元素
state.items[0] = 10;

// 添加元素
state.items.push(4);
state.items.unshift(0);

// 删除元素
state.items.pop();
state.items.shift();

// 获取长度
console.log(state.items.length); // 3
```

### 数组方法

```typescript
const state = observable({
  items: [1, 2, 3, 4, 5],
});

// 迭代
state.items.forEach(item => console.log(item));

// 映射
const doubled = state.items.map(x => x * 2);

// 过滤
const filtered = state.items.filter(x => x > 2);

// 查找
const found = state.items.find(x => x === 3);

// 排序
state.items.sort((a, b) => b - a);

// 反转
state.items.reverse();

// 切片
const sliced = state.items.slice(1, 3);

// 拼接
state.items.splice(1, 2, 10, 20);
```

## 对象方法

### 属性操作

```typescript
const state = observable({
  name: 'John',
  age: 30,
  email: 'john@example.com',
});

// 获取所有键
const keys = Object.keys(state);
// ['name', 'age', 'email']

// 获取所有值
const values = Object.values(state);
// ['John', 30, 'john@example.com']

// 获取键值对
const entries = Object.entries(state);
// [['name', 'John'], ['age', 30], ['email', 'john@example.com']]

// 检查属性是否存在
console.log('name' in state); // true
console.log(state.hasOwnProperty('name')); // true

// 获取属性描述符
const descriptor = Object.getOwnPropertyDescriptor(state, 'name');
```

### 属性定义

```typescript
const state = observable({});

// 定义属性
Object.defineProperty(state, 'count', {
  value: 0,
  writable: true,
  enumerable: true,
  configurable: true,
});

// 定义多个属性
Object.defineProperties(state, {
  name: {
    value: 'John',
    writable: true,
  },
  age: {
    value: 30,
    writable: true,
  },
});
```

## 计算属性

### 使用 Getter

```typescript
const state = observable({
  firstName: 'John',
  lastName: 'Doe',
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  },
});

console.log(state.fullName); // 'John Doe'

state.firstName = 'Jane';
console.log(state.fullName); // 'Jane Doe'
```

### 使用 Getter 和 Setter

```typescript
const state = observable({
  _count: 0,
  get count() {
    return this._count;
  },
  set count(value: number) {
    this._count = Math.max(0, value);
  },
});

state.count = 10;
console.log(state.count); // 10

state.count = -5;
console.log(state.count); // 0（被限制为最小值 0）
```

## 方法

### 定义方法

```typescript
const state = observable({
  count: 0,
  increment() {
    this.count++;
  },
  decrement() {
    this.count--;
  },
  add(value: number) {
    this.count += value;
  },
  reset() {
    this.count = 0;
  },
});

state.increment();
console.log(state.count); // 1

state.add(5);
console.log(state.count); // 6

state.reset();
console.log(state.count); // 0
```

### 异步方法

```typescript
const state = observable({
  data: null,
  loading: false,
  error: null,

  async fetchData() {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch('/api/data');
      this.data = await response.json();
    } catch (error) {
      this.error = error;
    } finally {
      this.loading = false;
    }
  },
});

state.fetchData();
```

## 特殊情况

### 循环引用

```typescript
const state = observable({
  name: 'John',
});

// 创建循环引用
state.self = state;

// 不会导致无限循环
console.log(state.self.name); // 'John'
```

### 冻结对象

```typescript
const state = observable({
  count: 0,
});

// 冻结对象
Object.freeze(state);

// 尝试修改会失败（在严格模式下抛出错误）
state.count = 1; // 不会改变
```

### Symbol 属性

```typescript
const state = observable({
  name: 'John',
});

const symbolKey = Symbol('key');
state[symbolKey] = 'value';

console.log(state[symbolKey]); // 'value'
```

## 性能考虑

### 1. 避免过度嵌套

```typescript
// ✅ 好
const state = observable({
  user: { name: 'John', age: 30 },
  posts: [{ id: 1, title: 'Post 1' }],
});

// ❌ 不好 - 过度嵌套
const state = observable({
  data: {
    user: {
      profile: {
        personal: {
          name: 'John',
        },
      },
    },
  },
});
```

### 2. 避免大型数组

```typescript
// ✅ 好 - 使用分页
const state = observable({
  items: [],
  page: 1,
  pageSize: 20,
});

// ❌ 不好 - 一次性加载所有数据
const state = observable({
  items: [], // 包含 10000+ 项
});
```

### 3. 使用 Shadow Observable

对于大型对象，可以使用 shadow observable 来提高性能：

```typescript
import { shadowObservable } from '@rabjs/react';

const state = shadowObservable({
  largeData: new Array(10000).fill(0),
});

// shadow observable 只追踪顶层属性
state.largeData = new Array(10000).fill(1);
```

## 最佳实践

### 1. 使用类型化对象

```typescript
// ✅ 好 - 类型清晰
interface User {
  name: string;
  age: number;
  email: string;
}

const state = observable<User>({
  name: 'John',
  age: 30,
  email: 'john@example.com',
});

// ❌ 不好 - 类型不清晰
const state = observable({
  name: 'John',
  age: 30,
  email: 'john@example.com',
});
```

### 2. 分离关注点

```typescript
// ✅ 好 - 分离状态和方法
const state = observable({
  count: 0,
});

const actions = {
  increment() {
    state.count++;
  },
  decrement() {
    state.count--;
  },
};

// ❌ 不好 - 混合状态和方法
const state = observable({
  count: 0,
  increment() {
    this.count++;
  },
});
```

## 下一步

- 👁️ 学习 [Observe](./observe.md) 追踪状态变化
- 🚀 查看 [高级用法](./advanced.md) 和优化技巧
