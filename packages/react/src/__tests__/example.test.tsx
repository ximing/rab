/**
 * 完整示例测试 - 展示 @rabjs/react 的各种用法
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  observer,
  useLocalObservable,
  useAsObservableSource,
  observable,
  observe,
  unobserve,
} from '../main';

describe('Complete Examples', () => {
  describe('Todo App Example', () => {
    it('应该实现一个完整的 Todo 应用', async () => {
      // 创建全局状态
      const todoStore = observable({
        todos: [] as Array<{ id: number; text: string; done: boolean }>,
        nextId: 1,

        addTodo(text: string) {
          this.todos.push({
            id: this.nextId++,
            text,
            done: false,
          });
        },

        toggleTodo(id: number) {
          const todo = this.todos.find(t => t.id === id);
          if (todo) {
            todo.done = !todo.done;
          }
        },

        removeTodo(id: number) {
          this.todos = this.todos.filter(t => t.id !== id);
        },

        get completedCount() {
          return this.todos.filter(t => t.done).length;
        },

        get totalCount() {
          return this.todos.length;
        },
      });

      // 创建 TodoList 组件
      const TodoList = observer(() => {
        return (
          <div>
            <h2>
              Todos ({todoStore.completedCount}/{todoStore.totalCount})
            </h2>
            <ul>
              {todoStore.todos.map(todo => (
                <li key={todo.id}>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => todoStore.toggleTodo(todo.id)}
                  />
                  <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>
                    {todo.text}
                  </span>
                  <button onClick={() => todoStore.removeTodo(todo.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
        );
      });

      // 创建 TodoInput 组件
      const TodoInput = () => {
        const [input, setInput] = React.useState('');

        return (
          <div>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Add a todo..."
            />
            <button
              onClick={() => {
                if (input.trim()) {
                  todoStore.addTodo(input);
                  setInput('');
                }
              }}
            >
              Add
            </button>
          </div>
        );
      };

      // 创建主应用
      function App() {
        return (
          <div>
            <h1>Todo App</h1>
            <TodoInput />
            <TodoList />
          </div>
        );
      }

      render(<App />);

      // 测试初始状态
      expect(screen.getByText('Todos (0/0)')).toBeInTheDocument();

      // 添加 todo
      const input = screen.getByPlaceholderText('Add a todo...');
      fireEvent.change(input, { target: { value: 'Learn React' } });
      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('Todos (0/1)')).toBeInTheDocument();
        expect(screen.getByText('Learn React')).toBeInTheDocument();
      });

      // 添加另一个 todo
      fireEvent.change(input, { target: { value: 'Learn Observable' } });
      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('Todos (0/2)')).toBeInTheDocument();
      });

      // 完成第一个 todo
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(screen.getByText('Todos (1/2)')).toBeInTheDocument();
      });
    });
  });

  describe('Counter with useLocalObservable', () => {
    it('应该实现一个计数器', async () => {
      const Counter = observer(() => {
        const state = useLocalObservable(() => ({
          count: 0,
          increment() {
            this.count++;
          },
          decrement() {
            this.count--;
          },
          reset() {
            this.count = 0;
          },
          get isPositive() {
            return this.count > 0;
          },
          get isNegative() {
            return this.count < 0;
          },
        }));

        return (
          <div>
            <p>Count: {state.count}</p>
            <p>Status: {state.isPositive ? 'Positive' : state.isNegative ? 'Negative' : 'Zero'}</p>
            <button onClick={() => state.increment()}>+1</button>
            <button onClick={() => state.decrement()}>-1</button>
            <button onClick={() => state.reset()}>Reset</button>
          </div>
        );
      });

      render(<Counter />);

      expect(screen.getByText('Count: 0')).toBeInTheDocument();
      expect(screen.getByText('Status: Zero')).toBeInTheDocument();

      fireEvent.click(screen.getByText('+1'));
      await waitFor(() => {
        expect(screen.getByText('Count: 1')).toBeInTheDocument();
        expect(screen.getByText('Status: Positive')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('-1'));
      fireEvent.click(screen.getByText('-1'));
      await waitFor(() => {
        expect(screen.getByText('Count: -1')).toBeInTheDocument();
        expect(screen.getByText('Status: Negative')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Reset'));
      await waitFor(() => {
        expect(screen.getByText('Count: 0')).toBeInTheDocument();
        expect(screen.getByText('Status: Zero')).toBeInTheDocument();
      });
    });
  });

  describe('Observer Component Example', () => {
    it('应该使用 Observer 组件进行局部响应式渲染', async () => {
      const state = observable({
        name: 'John',
        age: 30,
      });

      const StateDisplay = observer(() => (
        <div>
          <p>Name: {state.name}</p>
          <p>Age: {state.age}</p>
        </div>
      ));

      function App() {
        const [renderCount, setRenderCount] = React.useState(0);

        return (
          <div>
            <p>App renders: {renderCount}</p>
            <button onClick={() => setRenderCount(c => c + 1)}>Rerender App</button>

            <StateDisplay />

            <button onClick={() => (state.name = 'Jane')}>Change Name</button>
            <button onClick={() => (state.age = 31)}>Change Age</button>
          </div>
        );
      }

      render(<App />);

      expect(screen.getByText('Name: John')).toBeInTheDocument();
      expect(screen.getByText('Age: 30')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Change Name'));
      await waitFor(() => {
        expect(screen.getByText('Name: Jane')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Change Age'));
      await waitFor(() => {
        expect(screen.getByText('Age: 31')).toBeInTheDocument();
      });
    });
  });

  describe('useAsObservableSource Example', () => {
    it('应该将 props 转换为 observable', () => {
      const UserProfile = observer(({ userId, userName }: { userId: number; userName: string }) => {
        const observableProps = useAsObservableSource({ userId, userName });

        const state = useLocalObservable(() => ({
          get displayName() {
            return `User #${observableProps.userId}: ${observableProps.userName}`;
          },
        }));

        return <div>{state.displayName}</div>;
      });

      const { rerender } = render(<UserProfile userId={1} userName="John" />);
      expect(screen.getByText('User #1: John')).toBeInTheDocument();

      rerender(<UserProfile userId={2} userName="Jane" />);
      expect(screen.getByText('User #2: Jane')).toBeInTheDocument();
    });
  });

  describe('observe Function Example', () => {
    it('应该使用 observe 函数创建 reactions', () => {
      const state = observable({ count: 0 });
      const results: number[] = [];

      const reaction = observe(() => {
        results.push(state.count);
      });

      expect(results).toEqual([0]); // 初始执行

      state.count = 1;
      expect(results).toEqual([0, 1]);

      state.count = 2;
      expect(results).toEqual([0, 1, 2]);

      unobserve(reaction);
      state.count = 3;
      expect(results).toEqual([0, 1, 2]); // 不再追踪
    });
  });

  describe('Nested Observable Example', () => {
    it('应该支持嵌套 observable', async () => {
      const store = observable({
        user: {
          profile: {
            name: 'John',
            email: 'john@example.com',
          },
          settings: {
            theme: 'light',
            notifications: true,
          },
        },
      });

      const UserSettings = observer(() => {
        return (
          <div>
            <p>Name: {store.user.profile.name}</p>
            <p>Email: {store.user.profile.email}</p>
            <p>Theme: {store.user.settings.theme}</p>
            <p>Notifications: {store.user.settings.notifications ? 'On' : 'Off'}</p>
          </div>
        );
      });

      render(<UserSettings />);

      expect(screen.getByText('Name: John')).toBeInTheDocument();
      expect(screen.getByText('Theme: light')).toBeInTheDocument();

      store.user.settings.theme = 'dark';
      await waitFor(() => {
        expect(screen.getByText('Theme: dark')).toBeInTheDocument();
      });
    });
  });
});
