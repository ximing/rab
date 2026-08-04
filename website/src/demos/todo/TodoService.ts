import { Service } from "@rabjs/react";

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

/**
 * Todo Service —— 增删改查 + computed 过滤
 *
 * - todos / filter 是普通属性，自动响应式；
 * - filteredTodos / remaining 是 getter，读取时会被自动追踪，
 *   依赖（todos、filter）变化后重新计算并触发 UI 更新；
 * - 方法默认就是 Action，无需逐个标注。
 */
export class TodoService extends Service {
  todos: Todo[] = [
    { id: 1, title: "读一遍快速开始", done: true },
    { id: 2, title: "写一个自己的 Service", done: false },
  ];

  filter: "all" | "active" | "done" = "all";

  get filteredTodos(): Todo[] {
    if (this.filter === "active") return this.todos.filter((t) => !t.done);
    if (this.filter === "done") return this.todos.filter((t) => t.done);
    return this.todos;
  }

  get remaining(): number {
    return this.todos.filter((t) => !t.done).length;
  }

  add(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    this.todos.push({ id: Date.now(), title: trimmed, done: false });
  }

  toggle(id: number) {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) todo.done = !todo.done;
  }

  remove(id: number) {
    this.todos = this.todos.filter((t) => t.id !== id);
  }

  setFilter(filter: "all" | "active" | "done") {
    this.filter = filter;
  }
}
