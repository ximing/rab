# 基础用法

深入了解 RSJS 在 React 中的基础用法。

## Service 基础

### 定义 Service

Service 是 RSJS 的核心，它继承自 `Service` 基类：

```typescript
import { Service } from '@rabjs/react';

export class TodoService extends Service {
  // 状态属性
  todos: Array<{ id: string; title: string; done: boolean }> = [];
  filter: 'all' | 'active' | 'done' = 'all';

  // 方法
  addTodo(title: string) {
    this.todos.push({
      id: Date.now().toString(),
      title,
      done: false,
    });
  }

  toggleTodo(id: string) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.done = !todo.done;
    }
  }

  removeTodo(id: string) {
    this.todos = this.todos.filter(t => t.id !== id);
  }

  // 计算属性
  get activeTodos() {
    return this.todos.filter(t => !t.done);
  }

  get doneTodos() {
    return this.todos.filter(t => t.done);
  }

  get filteredTodos() {
    switch (this.filter) {
      case 'active':
        return this.activeTodos;
      case 'done':
        return this.doneTodos;
      default:
        return this.todos;
    }
  }
}
```

### 在组件中使用

```typescript
import { observer, useService, bindServices } from '@rabjs/react';
import { TodoService } from './TodoService';

const TodoListContent = observer(() => {
  const service = useService(TodoService);

  return (
    <div>
      <h1>待办事项</h1>

      {/* 输入框 */}
      <input
        type="text"
        placeholder="添加新任务"
        onKeyPress={e => {
          if (e.key === 'Enter' && e.currentTarget.value) {
            service.addTodo(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />

      {/* 过滤器 */}
      <div>
        <button
          onClick={() => (service.filter = 'all')}
          style={{ fontWeight: service.filter === 'all' ? 'bold' : 'normal' }}
        >
          全部 ({service.todos.length})
        </button>
        <button
          onClick={() => (service.filter = 'active')}
          style={{ fontWeight: service.filter === 'active' ? 'bold' : 'normal' }}
        >
          进行中 ({service.activeTodos.length})
        </button>
        <button
          onClick={() => (service.filter = 'done')}
          style={{ fontWeight: service.filter === 'done' ? 'bold' : 'normal' }}
        >
          已完成 ({service.doneTodos.length})
        </button>
      </div>

      {/* 任务列表 */}
      <ul>
        {service.filteredTodos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => service.toggleTodo(todo.id)}
            />
            <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>
              {todo.title}
            </span>
            <button onClick={() => service.removeTodo(todo.id)}>删除</button>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(TodoListContent, [TodoService]);
```

## 异步操作和状态管理

### 自动的 Loading 和 Error 状态

Service 会自动为所有方法创建 `loading` 和 `error` 状态：

```typescript
import { Service } from '@rabjs/react';

export class UserService extends Service {
  users: any[] = [];
  currentUser: any = null;

  async fetchUsers() {
    const response = await fetch('/api/users');
    this.users = await response.json();
  }

  async fetchUserById(id: string) {
    const response = await fetch(`/api/users/${id}`);
    this.currentUser = await response.json();
  }
}

// 在组件中使用
import { observer, useService, bindServices } from '@rabjs/react';

const UserListContent = observer(() => {
  const service = useService(UserService);

  return (
    <div>
      <button onClick={() => service.fetchUsers()}>
        {service.$model.fetchUsers.loading ? '加载中...' : '加载用户'}
      </button>

      {service.$model.fetchUsers.error && (
        <p style={{ color: 'red' }}>错误: {service.$model.fetchUsers.error.message}</p>
      )}

      <ul>
        {service.users.map(user => (
          <li key={user.id}>
            {user.name}
            <button onClick={() => service.fetchUserById(user.id)}>查看详情</button>
          </li>
        ))}
      </ul>

      {service.currentUser && (
        <div>
          <h2>{service.currentUser.name}</h2>
          <p>邮箱: {service.currentUser.email}</p>
        </div>
      )}
    </div>
  );
});

export default bindServices(UserListContent, [UserService]);
```

## 响应式计算

### 使用 Getter 创建计算属性

```typescript
import { Service } from '@rabjs/react';

export class ShoppingCartService extends Service {
  items: Array<{ id: string; price: number; quantity: number }> = [];

  // 计算总价
  get total() {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  // 计算商品数量
  get itemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // 计算是否为空
  get isEmpty() {
    return this.items.length === 0;
  }

  addItem(id: string, price: number) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.quantity++;
    } else {
      this.items.push({ id, price, quantity: 1 });
    }
  }

  removeItem(id: string) {
    this.items = this.items.filter(i => i.id !== id);
  }
}

// 在组件中使用
import { observer, useService, bindServices } from '@rabjs/react';

const ShoppingCartContent = observer(() => {
  const service = useService(ShoppingCartService);

  return (
    <div>
      <h1>购物车</h1>
      <p>商品数: {service.itemCount}</p>
      <p>总价: ¥{service.total.toFixed(2)}</p>

      {service.isEmpty ? (
        <p>购物车为空</p>
      ) : (
        <ul>
          {service.items.map(item => (
            <li key={item.id}>
              {item.id} - ¥{item.price} x {item.quantity}
              <button onClick={() => service.removeItem(item.id)}>删除</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default bindServices(ShoppingCartContent, [ShoppingCartService]);
```

## 最佳实践

### 1. 使用 `observer` 包装组件

```typescript
// ✅ 正确 - 使用 observer 包装
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.count}</div>;
});

// ❌ 错误 - 没有使用 observer
const MyComponent = () => {
  const service = useService(MyService);
  return <div>{service.count}</div>;
};
```

### 2. 使用 `bindServices` 注册 Service

```typescript
// ✅ 正确 - 使用 bindServices 导出
export default bindServices(MyComponent, [MyService]);

// ❌ 错误 - 直接导出
export default MyComponent;
```

### 3. 使用计算属性而不是在组件中计算

```typescript
// ✅ 正确 - 在 Service 中定义计算属性
export class TodoService extends Service {
  todos: any[] = [];

  get activeTodos() {
    return this.todos.filter(t => !t.done);
  }
}

// ❌ 不够优雅 - 在组件中计算
const MyComponent = observer(() => {
  const service = useService(TodoService);
  const activeTodos = service.todos.filter(t => !t.done);
  return <div>{activeTodos.length}</div>;
});
```

### 4. 避免在组件外创建 Service 实例

```typescript
// ✅ 正确 - 通过 useService 获取
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.count}</div>;
});

// ❌ 错误 - 在组件外创建实例
const service = new MyService();
const MyComponent = () => {
  return <div>{service.count}</div>;
};
```

## 下一步

- 🔧 了解 [深入 Service](./service-deep-dive.md) 的高级特性
- 🏗️ 了解 [Service 领域](./service-domain.md) 的架构设计
- 🔍 了解 [observer vs view](./observer-vs-view.md) 的区别
- 🪝 了解 [其他 Hooks](./hooks.md)
