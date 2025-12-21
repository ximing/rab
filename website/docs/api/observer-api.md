---
sidebar_position: 1
---

# @rabjs/observer API

响应式状态库核心 API 文档。

## 核心 API

### `observable(obj)`

创建一个响应式对象代理。返回的代理会追踪属性访问和变更。

**参数：**

- `obj: T extends object` - 要转换为响应式的对象

**返回值：**

- `T` - 对象的响应式代理

**示例：**

```typescript
import { observable, observe } from '@rabjs/observer';

const state = observable({ count: 0, name: 'Alice' });

observe(() => {
  console.log(`Count: ${state.count}`);
});

state.count++; // 触发观察者，输出 "Count: 1"
```

**特性：**

- 支持嵌套对象自动转换
- 支持数组和 Map/Set 等集合类型
- 支持 getter/setter
- 支持 Symbol 属性

---

### `shadowObservable(obj)`

创建一个浅层响应式对象。只追踪顶层属性的变更，不递归追踪嵌套对象。

**参数：**

- `obj: T extends object` - 要转换为浅层响应式的对象

**返回值：**

- `T` - 对象的浅层响应式代理

**示例：**

```typescript
import { shadowObservable, observe } from '@rabjs/observer';

const state = shadowObservable({
  user: { name: 'Alice', age: 30 },
});

observe(() => {
  console.log(state.user);
});

// 这会触发观察者
state.user = { name: 'Bob', age: 25 };

// 这不会触发观察者（嵌套属性变更）
state.user.name = 'Charlie';
```

**使用场景：**

- 性能优化：当只关心顶层属性变更时
- 与不可变数据结构配合使用
- 减少追踪开销

---

### `observe(fn, options?)`

创建一个观察者反应。当观察者依赖的响应式数据变更时，会自动重新执行。

**参数：**

- `fn: () => void` - 观察者函数
- `options?: ObserveOptions` - 配置选项

**返回值：**

- `Reaction` - 反应对象，可用于手动清理

**ObserveOptions 配置：**

```typescript
interface ObserveOptions {
  // 调度器：控制观察者何时执行
  scheduler?: ReactionScheduler;

  // 延迟执行：首次执行前的延迟时间（毫秒）
  delay?: number;

  // 立即执行：是否在创建时立即执行一次
  immediate?: boolean;
}
```

**示例：**

```typescript
import { observable, observe } from '@rabjs/observer';

const state = observable({ count: 0 });

// 基础用法
const reaction = observe(() => {
  console.log(`Count changed: ${state.count}`);
});

state.count++; // 输出 "Count changed: 1"

// 带选项的用法
observe(
  () => {
    console.log(`Count: ${state.count}`);
  },
  {
    immediate: true, // 立即执行一次
    delay: 100, // 延迟 100ms 执行
  }
);

// 手动清理
reaction.dispose();
```

**特性：**

- 自动依赖追踪
- 支持嵌套观察者
- 支持异步调度
- 支持手动清理

---

### `unobserve(reaction)`

手动清理一个观察者反应。

**参数：**

- `reaction: Reaction` - 由 `observe()` 返回的反应对象

**示例：**

```typescript
import { observable, observe, unobserve } from '@rabjs/observer';

const state = observable({ count: 0 });

const reaction = observe(() => {
  console.log(state.count);
});

state.count++; // 输出 1

unobserve(reaction);

state.count++; // 不输出任何内容
```

---

### `isObservable(obj)`

检查一个对象是否是响应式对象。

**参数：**

- `obj: any` - 要检查的对象

**返回值：**

- `boolean` - 如果是响应式对象返回 true，否则返回 false

**示例：**

```typescript
import { observable, isObservable } from '@rabjs/observer';

const state = observable({ count: 0 });
const plain = { count: 0 };

console.log(isObservable(state)); // true
console.log(isObservable(plain)); // false
```

---

### `raw(obj)`

获取响应式对象的原始对象。

**参数：**

- `obj: T` - 响应式对象

**返回值：**

- `T` - 原始对象

**示例：**

```typescript
import { observable, raw } from '@rabjs/observer';

const state = observable({ count: 0 });
const original = raw(state);

// 修改原始对象不会触发观察者
original.count++;
```

**使用场景：**

- 性能优化：需要批量修改而不触发观察者
- 序列化：获取纯数据对象
- 与第三方库集成

---

## 配置 API

### `configure(options)`

配置全局默认行为。

**参数：**

- `options: ConfigureOptions` - 配置选项

**ConfigureOptions 配置：**

```typescript
interface ConfigureOptions {
  // 是否启用调试模式
  debug?: boolean;

  // 自定义调度器
  scheduler?: ReactionScheduler;

  // 是否启用严格模式
  strict?: boolean;
}
```

**示例：**

```typescript
import { configure } from '@rabjs/observer';

configure({
  debug: true,
  strict: true,
});
```

---

### `resetGlobalConfig()`

重置全局配置到默认值。

**示例：**

```typescript
import { resetGlobalConfig } from '@rabjs/observer';

resetGlobalConfig();
```

---

## 类型定义

### `Reaction`

观察者反应对象。

```typescript
interface Reaction {
  // 手动执行反应
  track(): void;

  // 清理反应
  dispose(): void;

  // 是否已清理
  isDisposed(): boolean;
}
```

### `ObserveOptions`

观察者选项。

```typescript
interface ObserveOptions {
  scheduler?: ReactionScheduler;
  delay?: number;
  immediate?: boolean;
}
```

### `ConfigureOptions`

全局配置选项。

```typescript
interface ConfigureOptions {
  debug?: boolean;
  scheduler?: ReactionScheduler;
  strict?: boolean;
}
```

---

## 高级用法

### 批量更新

```typescript
import { observable, observe, raw } from '@rabjs/observer';

const state = observable({ count: 0, name: 'Alice' });

observe(() => {
  console.log(`State: ${state.count}, ${state.name}`);
});

// 方法 1：使用原始对象
const original = raw(state);
original.count = 10;
original.name = 'Bob';
// 只输出一次

// 方法 2：使用事务（如果支持）
// 在单个事务中进行多个更新
```

### 条件观察

```typescript
import { observable, observe } from '@rabjs/observer';

const state = observable({ count: 0, enabled: true });

observe(() => {
  if (state.enabled) {
    console.log(`Count: ${state.count}`);
  }
});

// 只有当 enabled 为 true 时才会追踪 count
```

### 清理和内存管理

```typescript
import { observable, observe } from '@rabjs/observer';

const state = observable({ count: 0 });

const reaction = observe(() => {
  console.log(state.count);
});

// 不再需要时清理
reaction.dispose();

// 验证已清理
console.log(reaction.isDisposed()); // true
```

---

## 最佳实践

1. **及时清理观察者**：使用 `dispose()` 或 `unobserve()` 清理不需要的观察者，避免内存泄漏

2. **使用 `shadowObservable` 优化性能**：当只关心顶层属性变更时，使用浅层响应式

3. **避免在观察者中创建新的响应式对象**：可能导致无限循环

4. **使用 `raw()` 进行批量更新**：避免频繁触发观察者

5. **合理使用调度器**：通过自定义调度器控制观察者执行时机

---

## 常见问题

**Q: 响应式对象支持哪些类型？**

A: 支持普通对象、数组、Map、Set、WeakMap、WeakSet 和 TypedArray。

**Q: 如何处理循环引用？**

A: 库会自动处理循环引用，不会导致无限循环。

**Q: 性能如何？**

A: 使用 Proxy 实现，性能接近原生对象访问。对于大规模数据，考虑使用 `shadowObservable`。

**Q: 支持 SSR 吗？**

A: 支持，但需要在服务端禁用观察者追踪。
