/**
 * Todo 服务 - 用于演示 useObserverService 的选择器功能
 *
 * 这个服务展示了如何使用 getter 属性和复杂的状态管理
 */
import { Service } from '@rabjs/react';

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

export class TodoService extends Service {
  todos: Todo[] = [
    {
      id: 1,
      title: '学习 React Hooks',
      completed: true,
      priority: 'high',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: 2,
      title: '实现 useObserverService',
      completed: true,
      priority: 'high',
      createdAt: new Date('2024-01-02'),
    },
    {
      id: 3,
      title: '编写 Demo 应用',
      completed: false,
      priority: 'medium',
      createdAt: new Date('2024-01-03'),
    },
    {
      id: 4,
      title: '优化性能',
      completed: false,
      priority: 'low',
      createdAt: new Date('2024-01-04'),
    },
  ];

  filter: 'all' | 'active' | 'completed' = 'all';

  get filteredTodos(): Todo[] {
    switch (this.filter) {
      case 'active':
        return this.todos.filter(t => !t.completed);
      case 'completed':
        return this.todos.filter(t => t.completed);
      default:
        return this.todos;
    }
  }

  get stats() {
    return {
      total: this.todos.length,
      completed: this.todos.filter(t => t.completed).length,
      active: this.todos.filter(t => !t.completed).length,
      highPriority: this.todos.filter(t => t.priority === 'high').length,
    };
  }

  get completionRate(): number {
    if (this.todos.length === 0) return 0;
    return Math.round((this.stats.completed / this.stats.total) * 100);
  }

  addTodo(title: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    const newTodo: Todo = {
      id: Math.max(...this.todos.map(t => t.id), 0) + 1,
      title,
      completed: false,
      priority,
      createdAt: new Date(),
    };
    this.todos.push(newTodo);
    return newTodo;
  }

  toggleTodo(id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }

  removeTodo(id: number) {
    this.todos = this.todos.filter(t => t.id !== id);
  }

  updateTodo(id: number, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      Object.assign(todo, updates);
    }
  }

  setFilter(filter: 'all' | 'active' | 'completed') {
    this.filter = filter;
  }

  clearCompleted() {
    this.todos = this.todos.filter(t => !t.completed);
  }

  getTodoById(id: number): Todo | undefined {
    return this.todos.find(t => t.id === id);
  }
}
