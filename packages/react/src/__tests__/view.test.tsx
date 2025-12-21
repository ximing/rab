/**
 * view HOC 测试
 * 测试函数组件和类组件的响应式行为
 */
import * as React from 'react';
import { Component } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { observable } from '@rabjs/observer';
import { view } from '../view';

describe('view', () => {
  describe('函数组件', () => {
    it('应该追踪 observable 变化并重新渲染', async () => {
      const store = observable({ count: 0 });

      const Counter = view(() => {
        return (
          <div>
            <span data-testid="count">{store.count}</span>
            <button onClick={() => store.count++}>Increment</button>
          </div>
        );
      });

      render(<Counter />);

      expect(screen.getByTestId('count')).toHaveTextContent('0');

      fireEvent.click(screen.getByText('Increment'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1');
      });
    });

    it('应该支持 props', async () => {
      const store = observable({ count: 0 });

      const Counter = view<{ prefix: string }>(props => {
        return (
          <div>
            <span data-testid="count">
              {props.prefix}: {store.count}
            </span>
            <button onClick={() => store.count++}>Increment</button>
          </div>
        );
      });

      const { rerender } = render(<Counter prefix="Count" />);

      expect(screen.getByTestId('count')).toHaveTextContent('Count: 0');

      fireEvent.click(screen.getByText('Increment'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('Count: 1');
      });

      // 测试 props 变化
      rerender(<Counter prefix="Total" />);

      expect(screen.getByTestId('count')).toHaveTextContent('Total: 1');
    });

    it('应该只在访问的属性变化时重新渲染', async () => {
      const store = observable({ count: 0, name: 'test' });
      let renderCount = 0;

      const Counter = view(() => {
        renderCount++;
        return <span data-testid="count">{store.count}</span>;
      });

      render(<Counter />);

      const initialRenderCount = renderCount;

      // 修改未访问的属性，不应该触发重新渲染
      store.name = 'updated';

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(renderCount).toBe(initialRenderCount);

      // 修改访问的属性，应该触发重新渲染
      store.count++;

      await waitFor(() => {
        expect(renderCount).toBe(initialRenderCount + 1);
      });
    });
  });

  describe('类组件', () => {
    it('应该追踪 observable 变化并重新渲染', async () => {
      const store = observable({ count: 0 });

      class Counter extends Component {
        render() {
          return (
            <div>
              <span data-testid="count">{store.count}</span>
              <button onClick={() => store.count++}>Increment</button>
            </div>
          );
        }
      }

      const ReactiveCounter = view(Counter);

      render(<ReactiveCounter />);

      expect(screen.getByTestId('count')).toHaveTextContent('0');

      fireEvent.click(screen.getByText('Increment'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1');
      });
    });

    it('应该支持 props 和 state', async () => {
      const store = observable({ count: 0 });

      interface Props {
        prefix: string;
      }

      interface State {
        localCount: number;
      }

      class Counter extends Component<Props, State> {
        state: State = {
          localCount: 0,
        };

        incrementLocal = () => {
          this.setState({ localCount: this.state.localCount + 1 });
        };

        render() {
          return (
            <div>
              <span data-testid="observable-count">
                {this.props.prefix}: {store.count}
              </span>
              <span data-testid="local-count">Local: {this.state.localCount}</span>
              <button onClick={() => store.count++}>Increment Observable</button>
              <button onClick={this.incrementLocal}>Increment Local</button>
            </div>
          );
        }
      }

      const ReactiveCounter = view(Counter);

      const { rerender } = render(<ReactiveCounter prefix="Count" />);

      expect(screen.getByTestId('observable-count')).toHaveTextContent('Count: 0');
      expect(screen.getByTestId('local-count')).toHaveTextContent('Local: 0');

      // 测试 observable 变化
      fireEvent.click(screen.getByText('Increment Observable'));

      await waitFor(() => {
        expect(screen.getByTestId('observable-count')).toHaveTextContent('Count: 1');
      });

      // 测试 state 变化
      fireEvent.click(screen.getByText('Increment Local'));

      await waitFor(() => {
        expect(screen.getByTestId('local-count')).toHaveTextContent('Local: 1');
      });

      // 测试 props 变化
      rerender(<ReactiveCounter prefix="Total" />);

      expect(screen.getByTestId('observable-count')).toHaveTextContent('Total: 1');
    });

    it('应该只在访问的属性变化时重新渲染', async () => {
      const store = observable({ count: 0, name: 'test' });
      let renderCount = 0;

      class Counter extends Component {
        render() {
          renderCount++;
          return <span data-testid="count">{store.count}</span>;
        }
      }

      const ReactiveCounter = view(Counter);

      render(<ReactiveCounter />);

      const initialRenderCount = renderCount;

      // 修改未访问的属性，不应该触发重新渲染
      store.name = 'updated';

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(renderCount).toBe(initialRenderCount);

      // 修改访问的属性，应该触发重新渲染
      store.count++;

      await waitFor(() => {
        expect(renderCount).toBe(initialRenderCount + 1);
      });
    });

    it('应该正确处理生命周期方法', async () => {
      const store = observable({ count: 0 });
      const lifecycleCalls: string[] = [];

      class Counter extends Component {
        componentDidMount() {
          lifecycleCalls.push('didMount');
        }

        componentDidUpdate() {
          lifecycleCalls.push('didUpdate');
        }

        componentWillUnmount() {
          lifecycleCalls.push('willUnmount');
        }

        render() {
          return (
            <div>
              <span data-testid="count">{store.count}</span>
              <button onClick={() => store.count++}>Increment</button>
            </div>
          );
        }
      }

      const ReactiveCounter = view(Counter);

      const { unmount } = render(<ReactiveCounter />);

      expect(lifecycleCalls).toContain('didMount');

      fireEvent.click(screen.getByText('Increment'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1');
      });

      expect(lifecycleCalls).toContain('didUpdate');

      unmount();

      expect(lifecycleCalls).toContain('willUnmount');
    });

    it('应该支持自定义 shouldComponentUpdate', async () => {
      const store = observable({ count: 0 });
      let shouldUpdateCalls = 0;

      interface Props {
        value: number;
      }

      class Counter extends Component<Props> {
        shouldComponentUpdate(nextProps: Props) {
          shouldUpdateCalls++;
          // 只在 props.value 变化时更新
          return this.props.value !== nextProps.value;
        }

        render() {
          return (
            <div>
              <span data-testid="count">{store.count}</span>
              <span data-testid="value">{this.props.value}</span>
            </div>
          );
        }
      }

      const ReactiveCounter = view(Counter);

      const { rerender } = render(<ReactiveCounter value={1} />);

      expect(screen.getByTestId('value')).toHaveTextContent('1');

      // props 不变，不应该更新
      rerender(<ReactiveCounter value={1} />);

      expect(shouldUpdateCalls).toBeGreaterThan(0);

      // props 变化，应该更新
      rerender(<ReactiveCounter value={2} />);

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('2');
      });
    });

    it('应该在组件卸载时清理 reaction', async () => {
      const store = observable({ count: 0 });
      let renderCount = 0;

      class Counter extends Component {
        render() {
          renderCount++;
          return <span data-testid="count">{store.count}</span>;
        }
      }

      const ReactiveCounter = view(Counter);

      const { unmount } = render(<ReactiveCounter />);

      const initialRenderCount = renderCount;

      unmount();

      // 卸载后修改 observable，不应该触发渲染
      store.count++;

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(renderCount).toBe(initialRenderCount);
    });

    it('应该继承静态属性', () => {
      class Counter extends Component {
        static displayName = 'MyCounter';
        static customStatic = 'test';

        render() {
          return <div>Counter</div>;
        }
      }

      const ReactiveCounter = view(Counter);

      expect(ReactiveCounter.displayName).toBe('MyCounter');
      expect((ReactiveCounter as any).customStatic).toBe('test');
    });
  });

  describe('ref 转发', () => {
    it('函数组件应该支持 ref 转发', () => {
      const store = observable({ count: 0 });

      const Counter = view(
        React.forwardRef<HTMLDivElement>((props, ref) => {
          return <div ref={ref}>{store.count}</div>;
        })
      );

      const ref = React.createRef<HTMLDivElement>();
      render(<Counter ref={ref} />);

      expect(ref.current).toBeInTheDocument();
      expect(ref.current?.textContent).toBe('0');
    });

    it('类组件应该支持 ref 转发', () => {
      const store = observable({ count: 0 });

      class Counter extends Component {
        render() {
          return <div>{store.count}</div>;
        }
      }

      const ReactiveCounter = view(Counter);

      const ref = React.createRef<Counter>();
      render(<ReactiveCounter ref={ref} />);

      expect(ref.current).toBeInstanceOf(Counter);
    });
  });

  describe('混合场景', () => {
    it('函数组件和类组件应该共享同一个 observable', async () => {
      const store = observable({ count: 0 });

      const FuncCounter = view(() => {
        return <span data-testid="func-count">{store.count}</span>;
      });

      class ClassCounter extends Component {
        render() {
          return <span data-testid="class-count">{store.count}</span>;
        }
      }

      const ReactiveClassCounter = view(ClassCounter);

      render(
        <>
          <FuncCounter />
          <ReactiveClassCounter />
          <button onClick={() => store.count++}>Increment</button>
        </>
      );

      expect(screen.getByTestId('func-count')).toHaveTextContent('0');
      expect(screen.getByTestId('class-count')).toHaveTextContent('0');

      fireEvent.click(screen.getByText('Increment'));

      await waitFor(() => {
        expect(screen.getByTestId('func-count')).toHaveTextContent('1');
        expect(screen.getByTestId('class-count')).toHaveTextContent('1');
      });
    });
  });
});
