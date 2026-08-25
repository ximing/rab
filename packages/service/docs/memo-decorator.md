# @Memo 装饰器

`@Memo` 装饰器用于对 Service 类中的 getter 方法进行缓存优化，只有当依赖的响应式数据发生变化时，才会重新计算。

## 核心特性

- ✅ 自动追踪 getter 中访问的响应式依赖
- ✅ 依赖变化时自动失效缓存
- ✅ 每个实例独立缓存
- ✅ 完整的 TypeScript 类型支持
- ✅ 支持复杂对象和数组依赖
- ✅ 支持手动失效缓存

## 基础用法

```typescript
import { Service, Memo } from '@rabjs/service';

class UserService extends Service {
  users = [
    { id: 1, name: 'Alice', age: 25 },
    { id: 2, name: 'Bob', age: 30 },
  ];

  @Memo()
  get totalAge() {
    console.log('计算 totalAge');
    return this.users.reduce((sum, user) => sum + user.age, 0);
  }

  @Memo()
  get userCount() {
    return this.users.length;
  }
}

const service = new UserService();

// 第一次访问，会执行计算
console.log(service.totalAge); // 输出: "计算 totalAge" 和 55

// 第二次访问，使用缓存，不会重新计算
console.log(service.totalAge); // 直接返回 55，不输出 "计算 totalAge"

// 修改依赖数据
service.users.push({ id: 3, name: 'Charlie', age: 35 });

// 再次访问，会重新计算
console.log(service.totalAge); // 输出: "计算 totalAge" 和 90
```

## 支持的依赖类型

### 1. 基础类型

```typescript
class CounterService extends Service {
  count = 0;

  @Memo()
  get doubled() {
    return this.count * 2;
  }
}
```

### 2. 对象属性

```typescript
class UserService extends Service {
  user = { name: 'Alice', age: 25 };

  @Memo()
  get greeting() {
    return `Hello, ${this.user.name}!`;
  }
}
```

### 3. 数组

```typescript
class TodoService extends Service {
  todos = [
    { id: 1, text: 'Learn React', completed: false },
    { id: 2, text: 'Learn TypeScript', completed: true },
  ];

  @Memo()
  get completedCount() {
    return this.todos.filter(todo => todo.completed).length;
  }

  @Memo()
  get pendingTodos() {
    return this.todos.filter(todo => !todo.completed);
  }
}
```

### 4. 多个依赖

```typescript
class CalculatorService extends Service {
  a = 10;
  b = 20;

  @Memo()
  get sum() {
    return this.a + this.b;
  }

  @Memo()
  get product() {
    return this.a * this.b;
  }
}
```

## 高级用法

### 链式依赖

当一个 memo getter 依赖另一个 memo getter 时，需要注意缓存行为：

```typescript
class DataService extends Service {
  data = 10;

  @Memo()
  get doubled() {
    return this.data * 2;
  }

  // ✅ 推荐：直接依赖原始数据
  @Memo()
  get quadrupled() {
    return this.data * 4;
  }

  // ⚠️ 注意：依赖另一个 memo getter 时，缓存可能不会自动失效
  @Memo()
  get quadrupledFromDoubled() {
    return this.doubled * 2;
  }
}

const service = new DataService();

// 修改数据
service.data = 20;

// quadrupled 会自动重新计算
console.log(service.quadrupled); // 80

// quadrupledFromDoubled 的缓存不会自动失效
// 需要先访问 doubled 或手动失效缓存
console.log(service.doubled); // 40
invalidateMemo(service, 'quadrupledFromDoubled');
console.log(service.quadrupledFromDoubled); // 80
```

### 手动失效缓存

```typescript
import { Service, Memo, invalidateMemo } from '@rabjs/service';

class DataService extends Service {
  data = 10;

  @Memo()
  get expensiveComputation() {
    // 昂贵的计算
    return this.data * 2;
  }

  forceRefresh() {
    // 手动失效缓存
    invalidateMemo(this, 'expensiveComputation');
  }
}
```

### 清理所有缓存

```typescript
import { Service, Memo, cleanupAllMemos } from '@rabjs/service';

class DataService extends Service {
  @Memo()
  get data1() {
    return this.compute1();
  }

  @Memo()
  get data2() {
    return this.compute2();
  }

  destroy() {
    // 清理所有 memo 缓存和 reaction
    cleanupAllMemos(this);
  }
}
```

## 性能优化

`@Memo` 装饰器特别适合以下场景：

### 1. 昂贵的计算

```typescript
class DataService extends Service {
  largeArray = Array.from({ length: 10000 }, (_, i) => i);

  @Memo()
  get sum() {
    // 昂贵的计算，只在 largeArray 变化时执行
    return this.largeArray.reduce((a, b) => a + b, 0);
  }
}
```

### 2. 频繁访问的计算属性

```typescript
class UIService extends Service {
  items = [...];

  @Memo()
  get filteredItems() {
    // 在渲染过程中可能被多次访问
    return this.items.filter(item => item.visible);
  }
}
```

### 3. 复杂的数据转换

```typescript
class ChartService extends Service {
  rawData = [...];

  @Memo()
  get chartData() {
    // 复杂的数据转换
    return this.rawData.map(item => ({
      x: item.timestamp,
      y: item.value,
      label: this.formatLabel(item)
    }));
  }
}
```

## 注意事项

### 1. 只能用于 getter

```typescript
class Service {
  // ❌ 错误：不能用于普通属性
  @Memo()
  data = 10;

  // ❌ 错误：不能用于方法
  @Memo()
  compute() {
    return this.data * 2;
  }

  // ✅ 正确：只能用于 getter
  @Memo()
  get computed() {
    return this.data * 2;
  }
}
```

### 2. 依赖必须是响应式的

```typescript
class DataService extends Service {
  // ✅ Service 的属性自动是响应式的
  data = 10;

  @Memo()
  get doubled() {
    return this.data * 2;
  }
}
```

### 3. 避免副作用

```typescript
class DataService extends Service {
  data = 10;
  sideEffectCount = 0;

  // ❌ 不推荐：getter 中有副作用
  @Memo()
  get computed() {
    this.sideEffectCount++; // 副作用
    return this.data * 2;
  }

  // ✅ 推荐：getter 应该是纯函数
  @Memo()
  get pureComputed() {
    return this.data * 2;
  }
}
```

## API 参考

### @Memo(options?)

装饰器选项：

```typescript
interface MemoOptions {
  /**
   * 自定义缓存键
   * 默认使用 getter 名称
   */
  key?: string;
}
```

### invalidateMemo(instance, propertyKey)

手动失效指定 getter 的缓存。

参数：

- `instance`: Service 实例
- `propertyKey`: getter 属性名

### cleanupAllMemos(instance)

清理实例上所有 Memo 装饰器的缓存和 reaction。

参数：

- `instance`: Service 实例

## 与其他装饰器的对比

| 装饰器      | 用途                 | 适用场景                   |
| ----------- | -------------------- | -------------------------- |
| `@Memo`     | 缓存 getter 计算结果 | 昂贵的计算、频繁访问的属性 |
| `@Debounce` | 防抖方法调用         | 搜索输入、窗口 resize      |
| `@Throttle` | 节流方法调用         | 滚动事件、鼠标移动         |
| `@Action`   | 标记批量更新方法     | 状态更新方法               |

## 最佳实践

1. **优先使用 @Memo 优化昂贵的计算**

   ```typescript
   @Memo()
   get expensiveComputation() {
     // 复杂计算
   }
   ```

2. **避免在 getter 中修改状态**

   ```typescript
   // ❌ 不推荐
   @Memo()
   get computed() {
     this.count++; // 修改状态
     return this.data * 2;
   }

   // ✅ 推荐
   @Memo()
   get computed() {
     return this.data * 2; // 纯计算
   }
   ```

3. **合理使用链式依赖**

   ```typescript
   // ✅ 推荐：直接依赖原始数据
   @Memo()
   get result() {
     return this.data * 4;
   }

   // ⚠️ 谨慎使用：依赖其他 memo getter
   @Memo()
   get result() {
     return this.otherMemoGetter * 2;
   }
   ```

4. **在组件卸载时清理缓存**
   ```typescript
   class MyService extends Service {
     destroy() {
       cleanupAllMemos(this);
     }
   }
   ```
