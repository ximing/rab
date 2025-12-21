/**
 * TODO Store - 用于演示 observable 的基本使用
 */
import { observable } from '@rabjs/react';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
}

export type FilterType = 'all' | 'active' | 'completed';

export class TodoStore {
  todos: Todo[] = [];
  filter: FilterType = 'all';
  private nextId = 1;

  /**
   * 添加新的 TODO
   */
  addTodo(text: string) {
    if (!text.trim()) return;

    this.todos.push({
      id: this.nextId++,
      text: text.trim(),
      completed: false,
      createdAt: new Date(),
    });
  }

  /**
   * 删除 TODO
   */
  removeTodo(id: number) {
    const index = this.todos.findIndex(todo => todo.id === id);
    if (index !== -1) {
      this.todos.splice(index, 1);
    }
  }

  /**
   * 切换 TODO 完成状态
   */
  toggleTodo(id: number) {
    const todo = this.todos.find(todo => todo.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }

  /**
   * 编辑 TODO 文本
   */
  editTodo(id: number, text: string) {
    const todo = this.todos.find(todo => todo.id === id);
    if (todo && text.trim()) {
      todo.text = text.trim();
    }
  }

  /**
   * 切换所有 TODO 的完成状态
   */
  toggleAll() {
    const allCompleted = this.todos.every(todo => todo.completed);
    this.todos.forEach(todo => {
      todo.completed = !allCompleted;
    });
  }

  /**
   * 清除所有已完成的 TODO
   */
  clearCompleted() {
    this.todos = this.todos.filter(todo => !todo.completed);
  }

  /**
   * 设置过滤器
   */
  setFilter(filter: FilterType) {
    this.filter = filter;
  }

  /**
   * 获取过滤后的 TODO 列表
   */
  get filteredTodos(): Todo[] {
    switch (this.filter) {
      case 'active':
        return this.todos.filter(todo => !todo.completed);
      case 'completed':
        return this.todos.filter(todo => todo.completed);
      default:
        return this.todos;
    }
  }

  /**
   * 获取未完成的 TODO 数量
   */
  get activeCount(): number {
    return this.todos.filter(todo => !todo.completed).length;
  }

  /**
   * 获取已完成的 TODO 数量
   */
  get completedCount(): number {
    return this.todos.filter(todo => todo.completed).length;
  }

  /**
   * 是否所有 TODO 都已完成
   */
  get allCompleted(): boolean {
    return this.todos.length > 0 && this.todos.every(todo => todo.completed);
  }
}

// 创建全局单例 - 使用 observable 包装使其成为响应式对象
export const todoStore = observable(new TodoStore());
