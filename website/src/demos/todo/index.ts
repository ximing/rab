import TodoDemo from './TodoDemo';

export default TodoDemo;
export { TodoService } from './TodoService';

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 内容约定：改动 TodoService / TodoDemo 时同步更新这里的字符串。
 */
export const todoDemoCode = `import { Service } from "@rabjs/react";
import { bindServices, observer, useService } from "@rabjs/react";

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

// 1. 定义 Service：getter 就是 computed，依赖变化自动重算
class TodoService extends Service {
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

// 2. observer 包装组件，useService 取实例
const Todo = observer(() => {
  const todo = useService(TodoService);
  // ...渲染 todo.filteredTodos，按钮调用 todo.add / toggle / remove / setFilter
  return null;
});

// 3. bindServices 提供服务容器
export default bindServices(Todo, [TodoService]);
`;
