/**
 * view() HOC 与数组 push 响应性测试
 *
 * 测试场景：使用 view() 包裹组件，验证当 Service 中的数组 push 元素时，
 * 组件是否能正常接收响应式更新并触发重新渲染
 *
 * 关键测试点：
 * 1. view() 能否正确包裹函数组件
 * 2. view() 能否正确包裹类组件
 * 3. 数组 push 操作能否触发组件重新渲染
 * 4. 计算属性（依赖数组的 getter）能否正确追踪
 * 5. 新增元素能否正确显示在 UI 中
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  view,
  observable,
  bindServices,
  useService,
  Service,
  RSStrict,
  RSRoot,
} from "../../main";

// ============ 类型定义 ============

interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
}

// ============ Service 实现 ============

class TodoService {
  todos: TodoItem[] = [
    { id: 1, title: "学习 React", completed: false },
    { id: 2, title: "学习 Observable", completed: true },
  ];

  nextId = 3;

  /**
   * 继承自 Service 的 TodoService（用于 bindServices）
   */
  static ServiceImpl = class TodoServiceImpl extends Service {
    todos: TodoItem[] = [
      { id: 1, title: "学习 React", completed: false },
      { id: 2, title: "学习 Observable", completed: true },
    ];

    nextId = 3;

    get pendingCount(): number {
      return this.todos.filter((todo) => !todo.completed).length;
    }

    get completedCount(): number {
      return this.todos.filter((todo) => todo.completed).length;
    }

    get totalCount(): number {
      return this.todos.length;
    }

    addTodo(title: string): void {
      this.todos.push({
        id: this.nextId++,
        title,
        completed: false,
      });
    }

    toggleTodo(id: number): void {
      const todo = this.todos.find((t) => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
      }
    }

    removeTodo(id: number): void {
      const index = this.todos.findIndex((t) => t.id === id);
      if (index !== -1) {
        this.todos.splice(index, 1);
      }
    }

    addMultipleTodos(titles: string[]): void {
      for (const title of titles) {
        this.todos.push({
          id: this.nextId++,
          title,
          completed: false,
        });
      }
    }

    clearCompleted(): void {
      this.todos = this.todos.filter((t) => !t.completed);
    }
  };

  // 计算属性 - 待完成的任务数
  get pendingCount(): number {
    return this.todos.filter((todo) => !todo.completed).length;
  }

  // 计算属性 - 完成的任务数
  get completedCount(): number {
    return this.todos.filter((todo) => todo.completed).length;
  }

  // 计算属性 - 总任务数
  get totalCount(): number {
    return this.todos.length;
  }

  // 添加待办项
  addTodo(title: string): void {
    this.todos.push({
      id: this.nextId++,
      title,
      completed: false,
    });
  }

  // 切换任务完成状态
  toggleTodo(id: number): void {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }

  // 删除任务
  removeTodo(id: number): void {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.todos.splice(index, 1);
    }
  }

  // 批量添加待办项
  addMultipleTodos(titles: string[]): void {
    for (const title of titles) {
      this.todos.push({
        id: this.nextId++,
        title,
        completed: false,
      });
    }
  }

  // 清空完成的任务
  clearCompleted(): void {
    this.todos = this.todos.filter((t) => !t.completed);
  }
}

// ============ 测试用例 ============

describe("view() HOC 与数组 push 响应性测试", () => {
  describe("函数组件 + view() 包裹", () => {
    it("应该在 push 新元素后正确触发重新渲染", async () => {
      const todoService = observable(new TodoService());

      // 使用 view() 包裹函数组件
      const TodoList = view(() => {
        return (
          <div>
            <div data-testid="total-count">{todoService.totalCount}</div>
            <div data-testid="pending-count">{todoService.pendingCount}</div>
            <div data-testid="completed-count">
              {todoService.completedCount}
            </div>
            <button
              onClick={() => todoService.addTodo("新任务")}
              data-testid="add-btn"
            >
              Add Todo
            </button>
            <ul data-testid="todo-list">
              {todoService.todos.map((todo) => (
                <li key={todo.id} data-testid={`todo-${todo.id}`}>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => todoService.toggleTodo(todo.id)}
                    data-testid={`checkbox-${todo.id}`}
                  />
                  <span>{todo.title}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      });

      render(<TodoList />);

      // 初始状态：2 个任务（1 个待完成，1 个已完成）
      expect(screen.getByTestId("total-count")).toHaveTextContent("2");
      expect(screen.getByTestId("pending-count")).toHaveTextContent("1");
      expect(screen.getByTestId("completed-count")).toHaveTextContent("1");
      expect(screen.getByTestId("todo-1")).toBeInTheDocument();
      expect(screen.getByTestId("todo-2")).toBeInTheDocument();

      // 点击添加按钮
      fireEvent.click(screen.getByTestId("add-btn"));

      // 应该显示 3 个任务
      await waitFor(() => {
        expect(screen.getByTestId("total-count")).toHaveTextContent("3");
        expect(screen.getByTestId("pending-count")).toHaveTextContent("2");
        expect(screen.getByTestId("todo-3")).toBeInTheDocument();
      });

      // 验证新增的任务内容
      const newTodo = screen.getByTestId("todo-3");
      expect(newTodo).toHaveTextContent("新任务");
    });

    it("应该在多次 push 操作后正确更新计数", async () => {
      const todoService = observable(new TodoService());

      const TodoList = view(() => {
        return (
          <div>
            <div data-testid="total-count">{todoService.totalCount}</div>
            <button
              onClick={() => todoService.addTodo(`任务 ${todoService.nextId}`)}
              data-testid="add-btn"
            >
              Add
            </button>
            <ul>
              {todoService.todos.map((todo) => (
                <li key={todo.id} data-testid={`todo-${todo.id}`}>
                  {todo.title}
                </li>
              ))}
            </ul>
          </div>
        );
      });

      render(<TodoList />);

      expect(screen.getByTestId("total-count")).toHaveTextContent("2");

      // 第一次添加
      fireEvent.click(screen.getByTestId("add-btn"));
      await waitFor(() => {
        expect(screen.getByTestId("total-count")).toHaveTextContent("3");
      });

      // 第二次添加
      fireEvent.click(screen.getByTestId("add-btn"));
      await waitFor(() => {
        expect(screen.getByTestId("total-count")).toHaveTextContent("4");
      });

      // 第三次添加
      fireEvent.click(screen.getByTestId("add-btn"));
      await waitFor(() => {
        expect(screen.getByTestId("total-count")).toHaveTextContent("5");
        expect(screen.getByTestId("todo-3")).toBeInTheDocument();
        expect(screen.getByTestId("todo-4")).toBeInTheDocument();
        expect(screen.getByTestId("todo-5")).toBeInTheDocument();
      });
    });

    it("应该在删除元素后正确更新列表", async () => {
      const todoService = observable(new TodoService());

      const TodoList = view(() => {
        return (
          <div>
            <div data-testid="count">{todoService.totalCount}</div>
            <ul>
              {todoService.todos.map((todo) => (
                <li key={todo.id} data-testid={`todo-${todo.id}`}>
                  <span>{todo.title}</span>
                  <button
                    onClick={() => todoService.removeTodo(todo.id)}
                    data-testid={`remove-${todo.id}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      });

      render(<TodoList />);

      expect(screen.getByTestId("count")).toHaveTextContent("2");
      expect(screen.getByTestId("todo-1")).toBeInTheDocument();
      expect(screen.getByTestId("todo-2")).toBeInTheDocument();

      // 删除第一个任务
      fireEvent.click(screen.getByTestId("remove-1"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("1");
        expect(screen.queryByTestId("todo-1")).not.toBeInTheDocument();
        expect(screen.getByTestId("todo-2")).toBeInTheDocument();
      });
    });

    it("应该在批量 push 后正确更新视图", async () => {
      const todoService = observable(new TodoService());

      const TodoList = view(() => {
        return (
          <div>
            <div data-testid="count">{todoService.totalCount}</div>
            <button
              onClick={() => {
                todoService.addMultipleTodos([
                  "批量任务1",
                  "批量任务2",
                  "批量任务3",
                ]);
              }}
              data-testid="batch-add"
            >
              Batch Add
            </button>
            <ul data-testid="todo-list">
              {todoService.todos.map((todo) => (
                <li key={todo.id} data-testid={`todo-${todo.id}`}>
                  {todo.title}
                </li>
              ))}
            </ul>
          </div>
        );
      });

      render(<TodoList />);

      expect(screen.getByTestId("count")).toHaveTextContent("2");

      // 批量添加
      fireEvent.click(screen.getByTestId("batch-add"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("5");
        expect(screen.getByTestId("todo-3")).toBeInTheDocument();
        expect(screen.getByTestId("todo-4")).toBeInTheDocument();
        expect(screen.getByTestId("todo-5")).toBeInTheDocument();
      });

      // 验证批量添加的内容
      expect(screen.getByText("批量任务1")).toBeInTheDocument();
      expect(screen.getByText("批量任务2")).toBeInTheDocument();
      expect(screen.getByText("批量任务3")).toBeInTheDocument();
    });
  });

  describe("类组件 + view() 包裹", () => {
    it("应该在 push 新元素后正确触发重新渲染", async () => {
      const todoService = observable(new TodoService());

      class TodoListClass extends React.Component<{}, {}> {
        render() {
          return (
            <div>
              <div data-testid="total-count">{todoService.totalCount}</div>
              <div data-testid="pending-count">{todoService.pendingCount}</div>
              <button
                onClick={() => todoService.addTodo("新任务")}
                data-testid="add-btn"
              >
                Add Todo
              </button>
              <ul>
                {todoService.todos.map((todo) => (
                  <li key={todo.id} data-testid={`todo-${todo.id}`}>
                    {todo.title}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      }

      // 使用 view() 包裹类组件
      const TodoList = view(TodoListClass);

      render(<TodoList />);

      // 初始状态
      expect(screen.getByTestId("total-count")).toHaveTextContent("2");

      // 点击添加按钮
      fireEvent.click(screen.getByTestId("add-btn"));

      // 应该显示 3 个任务
      await waitFor(() => {
        expect(screen.getByTestId("total-count")).toHaveTextContent("3");
        expect(screen.getByTestId("todo-3")).toBeInTheDocument();
      });
    });

    it("应该正确追踪计算属性的变化", async () => {
      const todoService = observable(new TodoService());

      class TodoStats extends React.Component<{}, {}> {
        render() {
          return (
            <div>
              <div data-testid="total">{todoService.totalCount}</div>
              <div data-testid="pending">{todoService.pendingCount}</div>
              <div data-testid="completed">{todoService.completedCount}</div>
              <button
                onClick={() => todoService.addTodo("新任务")}
                data-testid="add-btn"
              >
                Add
              </button>
              <button
                onClick={() => todoService.toggleTodo(1)}
                data-testid="toggle-btn"
              >
                Toggle
              </button>
            </div>
          );
        }
      }

      const TodoStatsView = view(TodoStats);

      render(<TodoStatsView />);

      // 初始状态：1 个待完成，1 个已完成
      expect(screen.getByTestId("total")).toHaveTextContent("2");
      expect(screen.getByTestId("pending")).toHaveTextContent("1");
      expect(screen.getByTestId("completed")).toHaveTextContent("1");

      // 添加新任务（未完成）
      fireEvent.click(screen.getByTestId("add-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("total")).toHaveTextContent("3");
        expect(screen.getByTestId("pending")).toHaveTextContent("2");
        expect(screen.getByTestId("completed")).toHaveTextContent("1");
      });

      // 切换任务 1 的完成状态
      fireEvent.click(screen.getByTestId("toggle-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("total")).toHaveTextContent("3");
        expect(screen.getByTestId("pending")).toHaveTextContent("1");
        expect(screen.getByTestId("completed")).toHaveTextContent("2");
      });
    });
  });

  describe("嵌套场景：view() 与 push 的复杂交互", () => {
    it("应该正确处理多个组件共享同一个 Service", async () => {
      const todoService = observable(new TodoService());

      const TodoForm = view(() => (
        <div>
          <button
            onClick={() => todoService.addTodo("表单添加")}
            data-testid="form-add"
          >
            Form Add
          </button>
        </div>
      ));

      const TodoListView = view(() => (
        <div>
          <div data-testid="list-count">{todoService.totalCount}</div>
          <ul>
            {todoService.todos.map((todo) => (
              <li key={todo.id} data-testid={`todo-${todo.id}`}>
                {todo.title}
              </li>
            ))}
          </ul>
        </div>
      ));

      render(
        <div>
          <TodoForm />
          <TodoListView />
        </div>
      );

      expect(screen.getByTestId("list-count")).toHaveTextContent("2");

      // 通过表单添加
      fireEvent.click(screen.getByTestId("form-add"));

      await waitFor(() => {
        expect(screen.getByTestId("list-count")).toHaveTextContent("3");
        expect(screen.getByTestId("todo-3")).toBeInTheDocument();
      });
    });

    it("应该在 splice 操作后正确更新", async () => {
      const todoService = observable(new TodoService());

      const TodoList = view(() => (
        <div>
          <div data-testid="count">{todoService.totalCount}</div>
          <button
            onClick={() => todoService.clearCompleted()}
            data-testid="clear-btn"
          >
            Clear Completed
          </button>
          <ul>
            {todoService.todos.map((todo) => (
              <li key={todo.id} data-testid={`todo-${todo.id}`}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => todoService.toggleTodo(todo.id)}
                  data-testid={`checkbox-${todo.id}`}
                />
                {todo.title}
              </li>
            ))}
          </ul>
        </div>
      ));

      render(<TodoList />);

      // 初始状态：2 个任务（1 个完成，1 个未完成）
      expect(screen.getByTestId("count")).toHaveTextContent("2");
      expect(screen.getByTestId("todo-1")).toBeInTheDocument();
      expect(screen.getByTestId("todo-2")).toBeInTheDocument();

      // 清空已完成的任务
      fireEvent.click(screen.getByTestId("clear-btn"));

      await waitFor(() => {
        // 应该只剩 1 个未完成的任务
        expect(screen.getByTestId("count")).toHaveTextContent("1");
        expect(screen.getByTestId("todo-1")).toBeInTheDocument();
        expect(screen.queryByTestId("todo-2")).not.toBeInTheDocument();
      });
    });
  });

  describe("边界情况", () => {
    it("应该在空数组后 push 第一个元素", async () => {
      class EmptyService {
        items: { id: number; name: string }[] = [];
        nextId = 1;

        addItem(name: string): void {
          this.items.push({ id: this.nextId++, name });
        }

        get count(): number {
          return this.items.length;
        }
      }

      const service = observable(new EmptyService());

      const ItemList = view(() => (
        <div>
          <div data-testid="count">{service.count}</div>
          <button
            onClick={() => service.addItem("第一个项目")}
            data-testid="add-btn"
          >
            Add
          </button>
          <ul>
            {service.items.map((item) => (
              <li key={item.id} data-testid={`item-${item.id}`}>
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      ));

      render(<ItemList />);

      expect(screen.getByTestId("count")).toHaveTextContent("0");

      fireEvent.click(screen.getByTestId("add-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("1");
        expect(screen.getByTestId("item-1")).toHaveTextContent("第一个项目");
      });
    });

    it("应该支持大量元素的 push 操作", async () => {
      class ListService {
        items: number[] = [];

        addMany(count: number): void {
          for (let i = 0; i < count; i++) {
            this.items.push(this.items.length + 1);
          }
        }
      }

      const service = observable(new ListService());

      const ItemList = view(() => (
        <div>
          <div data-testid="count">{service.items.length}</div>
          <button onClick={() => service.addMany(10)} data-testid="add-many">
            Add 10
          </button>
          <div data-testid="list">
            {service.items.map((item, idx) => (
              <div key={idx} data-testid={`item-${idx}`}>
                {item}
              </div>
            ))}
          </div>
        </div>
      ));

      render(<ItemList />);

      expect(screen.getByTestId("count")).toHaveTextContent("0");

      fireEvent.click(screen.getByTestId("add-many"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("10");
        expect(screen.getByTestId("item-0")).toBeInTheDocument();
        expect(screen.getByTestId("item-9")).toBeInTheDocument();
      });
    });
  });

  describe("bindServices + 数组 push 响应性", () => {
    it("应该通过 bindServices 绑定 Service，并正确触发数组 push 时的重新渲染", async () => {
      // 使用 Service 类并通过 bindServices 绑定
      const TodoListWithService = bindServices(
        () => {
          // 在组件内通过 useService 获取服务实例
          const todoService = useService(TodoService.ServiceImpl);

          return (
            <div>
              <div data-testid="total-count">{todoService.totalCount}</div>
              <div data-testid="pending-count">{todoService.pendingCount}</div>
              <div data-testid="completed-count">
                {todoService.completedCount}
              </div>
              <button
                onClick={() => todoService.addTodo("bindServices 新任务")}
                data-testid="add-btn"
              >
                Add Todo
              </button>
              <ul data-testid="todo-list">
                {todoService.todos.map((todo) => (
                  <li key={todo.id} data-testid={`todo-${todo.id}`}>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => todoService.toggleTodo(todo.id)}
                      data-testid={`checkbox-${todo.id}`}
                    />
                    <span>{todo.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        },
        [TodoService.ServiceImpl] // 注册 Service
      );

      render(
        <RSRoot>
          <RSStrict>
            <TodoListWithService />
          </RSStrict>
        </RSRoot>
      );

      // 初始状态：2 个任务
      expect(screen.getByTestId("total-count")).toHaveTextContent("2");
      expect(screen.getByTestId("pending-count")).toHaveTextContent("1");
      expect(screen.getByTestId("completed-count")).toHaveTextContent("1");

      // 点击添加按钮
      fireEvent.click(screen.getByTestId("add-btn"));

      // 应该显示 3 个任务
      await waitFor(() => {
        expect(screen.getByTestId("total-count")).toHaveTextContent("3");
        expect(screen.getByTestId("pending-count")).toHaveTextContent("2");
        expect(screen.getByTestId("todo-3")).toBeInTheDocument();
        expect(screen.getByTestId("todo-3")).toHaveTextContent(
          "bindServices 新任务"
        );
      });
    });

    it("应该通过 bindServices 支持多次 push 操作", async () => {
      const TodoListWithService = bindServices(() => {
        const todoService = useService(TodoService.ServiceImpl);

        return (
          <div>
            <div data-testid="count">{todoService.totalCount}</div>
            <button
              onClick={() => todoService.addTodo(`任务 ${todoService.nextId}`)}
              data-testid="add-btn"
            >
              Add
            </button>
            <ul>
              {todoService.todos.map((todo) => (
                <li key={todo.id} data-testid={`todo-${todo.id}`}>
                  {todo.title}
                </li>
              ))}
            </ul>
          </div>
        );
      }, [TodoService.ServiceImpl]);

      render(<TodoListWithService />);

      expect(screen.getByTestId("count")).toHaveTextContent("2");

      // 第一次添加
      fireEvent.click(screen.getByTestId("add-btn"));
      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("3");
      });

      // 第二次添加
      fireEvent.click(screen.getByTestId("add-btn"));
      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("4");
      });

      // 第三次添加
      fireEvent.click(screen.getByTestId("add-btn"));
      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("5");
        expect(screen.getByTestId("todo-3")).toBeInTheDocument();
        expect(screen.getByTestId("todo-4")).toBeInTheDocument();
        expect(screen.getByTestId("todo-5")).toBeInTheDocument();
      });
    });

    it("应该通过 bindServices 正确处理批量 push 操作", async () => {
      const TodoListWithService = bindServices(() => {
        const todoService = useService(TodoService.ServiceImpl);

        return (
          <div>
            <div data-testid="count">{todoService.totalCount}</div>
            <button
              onClick={() => {
                todoService.addMultipleTodos([
                  "批量任务1",
                  "批量任务2",
                  "批量任务3",
                ]);
              }}
              data-testid="batch-add"
            >
              Batch Add
            </button>
            <ul data-testid="todo-list">
              {todoService.todos.map((todo) => (
                <li key={todo.id} data-testid={`todo-${todo.id}`}>
                  {todo.title}
                </li>
              ))}
            </ul>
          </div>
        );
      }, [TodoService.ServiceImpl]);

      render(<TodoListWithService />);

      expect(screen.getByTestId("count")).toHaveTextContent("2");

      // 批量添加
      fireEvent.click(screen.getByTestId("batch-add"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("5");
        expect(screen.getByTestId("todo-3")).toBeInTheDocument();
        expect(screen.getByTestId("todo-4")).toBeInTheDocument();
        expect(screen.getByTestId("todo-5")).toBeInTheDocument();
      });

      // 验证批量添加的内容
      expect(screen.getByText("批量任务1")).toBeInTheDocument();
      expect(screen.getByText("批量任务2")).toBeInTheDocument();
      expect(screen.getByText("批量任务3")).toBeInTheDocument();
    });

    it("应该通过 bindServices 正确处理数组删除（splice）操作", async () => {
      const TodoListWithService = bindServices(() => {
        const todoService = useService(TodoService.ServiceImpl);

        return (
          <div>
            <div data-testid="count">{todoService.totalCount}</div>
            <button
              onClick={() => todoService.clearCompleted()}
              data-testid="clear-btn"
            >
              Clear Completed
            </button>
            <ul>
              {todoService.todos.map((todo) => (
                <li key={todo.id} data-testid={`todo-${todo.id}`}>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => todoService.toggleTodo(todo.id)}
                    data-testid={`checkbox-${todo.id}`}
                  />
                  {todo.title}
                </li>
              ))}
            </ul>
          </div>
        );
      }, [TodoService.ServiceImpl]);

      render(<TodoListWithService />);

      // 初始状态：2 个任务（1 个完成，1 个未完成）
      expect(screen.getByTestId("count")).toHaveTextContent("2");
      expect(screen.getByTestId("todo-1")).toBeInTheDocument();
      expect(screen.getByTestId("todo-2")).toBeInTheDocument();

      // 清空已完成的任务
      fireEvent.click(screen.getByTestId("clear-btn"));

      await waitFor(() => {
        // 应该只剩 1 个未完成的任务
        expect(screen.getByTestId("count")).toHaveTextContent("1");
        expect(screen.getByTestId("todo-1")).toBeInTheDocument();
        expect(screen.queryByTestId("todo-2")).not.toBeInTheDocument();
      });
    });

    it("应该通过 bindServices 正确追踪计算属性和 push 的关联", async () => {
      const TodoStatsWithService = bindServices(() => {
        const todoService = useService(TodoService.ServiceImpl);

        return (
          <div>
            <div data-testid="total">{todoService.totalCount}</div>
            <div data-testid="pending">{todoService.pendingCount}</div>
            <div data-testid="completed">{todoService.completedCount}</div>
            <button
              onClick={() => todoService.addTodo("新任务")}
              data-testid="add-btn"
            >
              Add
            </button>
            <button
              onClick={() => todoService.toggleTodo(1)}
              data-testid="toggle-btn"
            >
              Toggle
            </button>
          </div>
        );
      }, [TodoService.ServiceImpl]);

      render(<TodoStatsWithService />);

      // 初始状态：1 个待完成，1 个已完成
      expect(screen.getByTestId("total")).toHaveTextContent("2");
      expect(screen.getByTestId("pending")).toHaveTextContent("1");
      expect(screen.getByTestId("completed")).toHaveTextContent("1");

      // 添加新任务（未完成）
      fireEvent.click(screen.getByTestId("add-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("total")).toHaveTextContent("3");
        expect(screen.getByTestId("pending")).toHaveTextContent("2");
        expect(screen.getByTestId("completed")).toHaveTextContent("1");
      });

      // 切换任务 1 的完成状态
      fireEvent.click(screen.getByTestId("toggle-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("total")).toHaveTextContent("3");
        expect(screen.getByTestId("pending")).toHaveTextContent("1");
        expect(screen.getByTestId("completed")).toHaveTextContent("2");
      });
    });
  });
});
