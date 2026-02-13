# 案例 2：待办事项列表（中等复杂度）

这个案例展示了如何构建一个功能完整的待办事项列表应用，涉及更复杂的状态管理和业务逻辑。

## 场景描述

实现一个待办事项管理系统，支持：

- 添加、删除、编辑待办事项
- 标记事项为完成/未完成
- 按状态筛选（全部、进行中、已完成）
- 统计信息展示

## 完整代码

### 1. 定义数据模型

```typescript
// types/todo.ts
export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type FilterType = 'all' | 'active' | 'completed';
```

### 2. 创建 TodoService

```typescript
// services/TodoService.ts
import { Service, Memo } from '@rabjs/react';
import { Todo, FilterType } from '../types/todo';

export class TodoService extends Service {
  // 状态
  todos: Todo[] = [];
  filter: FilterType = 'all';
  editingId: string | null = null;

  // 计算属性 - 使用 @Memo() 装饰器缓存计算结果
  @Memo()
  get activeTodos() {
    return this.todos.filter(todo => !todo.completed);
  }

  @Memo()
  get completedTodos() {
    return this.todos.filter(todo => todo.completed);
  }

  @Memo()
  get filteredTodos() {
    switch (this.filter) {
      case 'active':
        return this.activeTodos;
      case 'completed':
        return this.completedTodos;
      default:
        return this.todos;
    }
  }

  @Memo()
  get stats() {
    return {
      total: this.todos.length,
      active: this.activeTodos.length,
      completed: this.completedTodos.length,
      completionRate:
        this.todos.length > 0
          ? Math.round((this.completedTodos.length / this.todos.length) * 100)
          : 0,
    };
  }

  // 方法
  addTodo(title: string, description?: string) {
    const todo: Todo = {
      id: Date.now().toString(),
      title,
      description,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.todos.push(todo);
  }

  removeTodo(id: string) {
    this.todos = this.todos.filter(todo => todo.id !== id);
  }

  toggleTodo(id: string) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      todo.updatedAt = new Date();
    }
  }

  updateTodo(id: string, title: string, description?: string) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.title = title;
      todo.description = description;
      todo.updatedAt = new Date();
    }
    this.editingId = null;
  }

  startEditing(id: string) {
    this.editingId = id;
  }

  cancelEditing() {
    this.editingId = null;
  }

  setFilter(filter: FilterType) {
    this.filter = filter;
  }

  clearCompleted() {
    this.todos = this.todos.filter(todo => !todo.completed);
  }
}
```

### 3. 创建 React 组件

```typescript
// components/TodoList.tsx
import React, { useState } from 'react';
import { observer, useService, bindServices } from '@rabjs/react';
import { TodoService } from '../services/TodoService';
import { FilterType } from '../types/todo';
import './TodoList.css';

// 待办事项项组件
const TodoItem = observer(({ todoId }: { todoId: string }) => {
  const service = useService(TodoService);
  const todo = service.todos.find(t => t.id === todoId);
  const [editTitle, setEditTitle] = useState(todo?.title || '');
  const [editDesc, setEditDesc] = useState(todo?.description || '');

  if (!todo) return null;

  const isEditing = service.editingId === todoId;

  return (
    <div className="todo-item">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => service.toggleTodo(todoId)}
        className="todo-checkbox"
      />

      {isEditing ? (
        <div className="todo-edit">
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="待办事项标题"
            className="todo-input"
          />
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            placeholder="描述（可选）"
            className="todo-textarea"
          />
          <div className="todo-actions">
            <button
              onClick={() => service.updateTodo(todoId, editTitle, editDesc)}
              className="btn btn-primary"
            >
              保存
            </button>
            <button onClick={() => service.cancelEditing()} className="btn btn-secondary">
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="todo-content">
          <div className={`todo-title ${todo.completed ? 'completed' : ''}`}>{todo.title}</div>
          {todo.description && <div className="todo-description">{todo.description}</div>}
          <div className="todo-meta">{new Date(todo.updatedAt).toLocaleDateString()}</div>
          <div className="todo-actions">
            <button onClick={() => service.startEditing(todoId)} className="btn btn-small">
              编辑
            </button>
            <button onClick={() => service.removeTodo(todoId)} className="btn btn-small btn-danger">
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// 主组件
const TodoListContent = observer(() => {
  const service = useService(TodoService);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleAddTodo = () => {
    if (newTitle.trim()) {
      service.addTodo(newTitle, newDesc);
      setNewTitle('');
      setNewDesc('');
    }
  };

  const filterButtons: FilterType[] = ['all', 'active', 'completed'];

  return (
    <div className="todo-list-container">
      <h1>待办事项列表</h1>

      {/* 统计信息 */}
      <div className="stats">
        <div className="stat-item">
          <span className="stat-label">总数</span>
          <span className="stat-value">{service.stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">进行中</span>
          <span className="stat-value">{service.stats.active}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">已完成</span>
          <span className="stat-value">{service.stats.completed}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">完成率</span>
          <span className="stat-value">{service.stats.completionRate}%</span>
        </div>
      </div>

      {/* 添加新待办事项 */}
      <div className="add-todo">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleAddTodo()}
          placeholder="输入新的待办事项..."
          className="todo-input"
        />
        <textarea
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          placeholder="描述（可选）"
          className="todo-textarea"
        />
        <button onClick={handleAddTodo} className="btn btn-primary">
          添加
        </button>
      </div>

      {/* 筛选按钮 */}
      <div className="filters">
        {filterButtons.map(filter => (
          <button
            key={filter}
            onClick={() => service.setFilter(filter)}
            className={`filter-btn ${service.filter === filter ? 'active' : ''}`}
          >
            {filter === 'all' ? '全部' : filter === 'active' ? '进行中' : '已完成'}
          </button>
        ))}
      </div>

      {/* 待办事项列表 */}
      <div className="todos">
        {service.filteredTodos.length > 0 ? (
          service.filteredTodos.map(todo => <TodoItem key={todo.id} todoId={todo.id} />)
        ) : (
          <div className="empty-state">
            {service.filter === 'all'
              ? '暂无待办事项'
              : service.filter === 'active'
              ? '没有进行中的事项'
              : '没有已完成的事项'}
          </div>
        )}
      </div>

      {/* 清空已完成 */}
      {service.completedTodos.length > 0 && (
        <button onClick={() => service.clearCompleted()} className="btn btn-secondary">
          清空已完成
        </button>
      )}
    </div>
  );
});

export default bindServices(TodoListContent, [TodoService]);
```

### 4. 样式文件

```css
/* components/TodoList.css */
.todo-list-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 20px 0;
}

.stat-item {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.add-todo {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 20px 0;
}

.todo-input,
.todo-textarea {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.todo-textarea {
  resize: vertical;
  min-height: 60px;
}

.filters {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.filter-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.todos {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 20px 0;
}

.todo-item {
  display: flex;
  gap: 10px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #eee;
}

.todo-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  margin-top: 2px;
}

.todo-content {
  flex: 1;
}

.todo-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 5px;
}

.todo-title.completed {
  text-decoration: line-through;
  color: #999;
}

.todo-description {
  font-size: 14px;
  color: #666;
  margin-bottom: 5px;
}

.todo-meta {
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
}

.todo-actions {
  display: flex;
  gap: 5px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 16px;
}

.todo-edit {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
```

## 关键特性

✅ **复杂状态管理**：多个相关的状态和计算属性  
✅ **列表操作**：添加、删除、编辑、筛选等完整的 CRUD 操作  
✅ **计算属性**：自动计算统计信息和筛选结果  
✅ **细粒度更新**：只有相关的组件会重新渲染  
✅ **嵌套组件**：展示如何在嵌套组件中使用 Service  
✅ **性能优化**：使用 `@Memo()` 装饰器缓存计算结果

## 工作原理

1. **Service 中的计算属性**：`filteredTodos` 和 `stats` 会根据状态自动计算
2. **细粒度追踪**：组件只追踪实际访问的属性，避免不必要的重新渲染
3. **嵌套组件共享 Service**：`TodoItem` 组件通过 `useService` 获取同一个 Service 实例
4. **自动批量更新**：多个状态变化会被自动批量处理

## @Memo() 装饰器优化

在这个例子中，我们使用 `@Memo()` 装饰器来缓存计算属性的结果，这带来以下优势：

### 为什么使用 @Memo()?

- **避免重复计算**：计算属性只在依赖数据变化时重新计算，否则返回缓存结果
- **性能提升**：特别是在列表较大或计算复杂时，性能提升明显
- **自动依赖追踪**：装饰器自动追踪 getter 中访问的响应式数据，依赖变化时自动失效缓存

### 缓存的计算属性

```typescript
// 这些计算属性都被缓存了：
@Memo()
get activeTodos() { /* 过滤未完成的任务 */ }

@Memo()
get completedTodos() { /* 过滤已完成的任务 */ }

@Memo()
get filteredTodos() { /* 根据 filter 返回对应的任务列表 */ }

@Memo()
get stats() { /* 计算统计信息 */ }
```

### 缓存失效时机

- 当 `todos` 数组变化时，`activeTodos`、`completedTodos`、`filteredTodos` 和 `stats` 的缓存会自动失效
- 当 `filter` 变化时，`filteredTodos` 和 `stats` 的缓存会自动失效
- 下次访问这些属性时，会重新计算并缓存新的结果

### 性能对比

```typescript
// 不使用 @Memo() - 每次访问都重新计算
service.stats.total; // 计算一次
service.stats.active; // 再计算一次
service.stats.completed; // 再计算一次

// 使用 @Memo() - 第一次计算，后续访问返回缓存
service.stats.total; // 计算一次，缓存结果
service.stats.active; // 返回缓存结果
service.stats.completed; // 返回缓存结果
```

## 下一步

- 查看 [案例 3：用户管理系统](./03-user-management.md) 了解异步操作和多个 Service 的依赖注入
