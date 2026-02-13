/**
 * 高级场景测试 - 提升整体覆盖率
 */

import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { observer } from '../observer';
import { useObserver } from '../useObserver';
import { observable } from '@rabjs/observer';

describe('高级场景 - 覆盖率提升', () => {
  describe('observer 高级场景', () => {
    it('应该在嵌套 observer 组件中正确工作', async () => {
      const state = observable({ count: 0 });

      const InnerComponent = observer(() => <span>{state.count}</span>);

      const OuterComponent = observer(() => (
        <div>
          <InnerComponent />
        </div>
      ));

      render(<OuterComponent />);

      expect(screen.getByText('0')).toBeInTheDocument();

      act(() => {
        state.count = 1;
      });

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('应该在多个 observer 组件中正确追踪', async () => {
      const state = observable({ a: 'a', b: 'b' });

      const ComponentA = observer(() => <div>{state.a}</div>);
      const ComponentB = observer(() => <div>{state.b}</div>);

      render(
        <div>
          <ComponentA />
          <ComponentB />
        </div>
      );

      expect(screen.getByText('a')).toBeInTheDocument();
      expect(screen.getByText('b')).toBeInTheDocument();

      act(() => {
        state.a = 'a1';
      });

      await waitFor(() => {
        expect(screen.getByText('a1')).toBeInTheDocument();
      });

      expect(screen.getByText('b')).toBeInTheDocument();
    });

    it('应该在条件渲染中正确工作', async () => {
      const state = observable({ show: true, value: 'visible' });

      const Component = observer(() => (
        <div>{state.show ? <span>{state.value}</span> : <span>hidden</span>}</div>
      ));

      render(<Component />);

      expect(screen.getByText('visible')).toBeInTheDocument();

      act(() => {
        state.show = false;
      });

      await waitFor(() => {
        expect(screen.getByText('hidden')).toBeInTheDocument();
      });

      act(() => {
        state.show = true;
      });

      await waitFor(() => {
        expect(screen.getByText('visible')).toBeInTheDocument();
      });
    });

    it('应该在列表渲染中正确追踪', async () => {
      const state = observable({
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      });

      const Component = observer(() => (
        <ul>
          {state.items.map(item => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      ));

      render(<Component />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();

      act(() => {
        state.items[0].name = 'Updated Item 1';
      });

      await waitFor(() => {
        expect(screen.getByText('Updated Item 1')).toBeInTheDocument();
      });
    });

    it('应该正确处理 forwardRef 组件', () => {
      const state = observable({ value: 'test' });
      const Component = React.forwardRef<HTMLDivElement>((props, ref) => (
        <div ref={ref}>{state.value}</div>
      ));

      const ObservedComponent = observer(Component);
      const divRef = React.createRef<HTMLDivElement>();

      render(<ObservedComponent ref={divRef} />);

      expect(divRef.current).toBeInTheDocument();
    });

    it('应该复制静态属性', () => {
      const Component = () => <div>Test</div>;
      (Component as any).staticProp = 'value';

      const ObservedComponent = observer(Component);

      expect((ObservedComponent as any).staticProp).toBe('value');
    });
  });

  describe('useObserver 高级场景', () => {
    it('应该追踪嵌套对象的变化', async () => {
      const state = observable({
        user: { name: 'John', age: 30 },
      });

      const Component = () => {
        const name = useObserver(() => state.user.name);
        return <div>{name}</div>;
      };

      render(<Component />);

      expect(screen.getByText('John')).toBeInTheDocument();

      act(() => {
        state.user.name = 'Jane';
      });

      await waitFor(() => {
        expect(screen.getByText('Jane')).toBeInTheDocument();
      });
    });

    it('应该追踪数组长度的变化', async () => {
      const state = observable({ items: [1, 2, 3] });

      const Component = () => {
        const length = useObserver(() => state.items.length);
        return <div>{length}</div>;
      };

      render(<Component />);

      expect(screen.getByText('3')).toBeInTheDocument();

      act(() => {
        state.items.push(4);
      });

      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });

    it('应该支持自定义调试名称', () => {
      const state = observable({ value: 'test' });

      const Component = () => {
        const value = useObserver(() => state.value, 'CustomDebugName');
        return <div>{value}</div>;
      };

      render(<Component />);

      expect(screen.getByText('test')).toBeInTheDocument();
    });

    it('应该追踪多个 observable 的组合', async () => {
      const state1 = observable({ value: 'a' });
      const state2 = observable({ value: 'b' });

      const Component = () => {
        const combined = useObserver(() => `${state1.value}-${state2.value}`);
        return <div>{combined}</div>;
      };

      render(<Component />);

      expect(screen.getByText('a-b')).toBeInTheDocument();

      act(() => {
        state1.value = 'a1';
      });

      await waitFor(() => {
        expect(screen.getByText('a1-b')).toBeInTheDocument();
      });
    });

    it('应该追踪条件计算属性', async () => {
      const state = observable({
        count: 0,
        multiplier: 2,
      });

      const Component = () => {
        const result = useObserver(() => {
          if (state.count > 5) {
            return state.count * state.multiplier;
          }
          return state.count;
        });
        return <div>{result}</div>;
      };

      render(<Component />);

      expect(screen.getByText('0')).toBeInTheDocument();

      act(() => {
        state.count = 3;
      });

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      act(() => {
        state.count = 10;
      });

      await waitFor(() => {
        expect(screen.getByText('20')).toBeInTheDocument();
      });
    });

    it('应该在严格模式下正确处理多次渲染', async () => {
      const state = observable({ count: 0 });

      const Component = () => {
        const count = useObserver(() => state.count);
        return <div>{count}</div>;
      };

      render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      expect(screen.getByText('0')).toBeInTheDocument();

      act(() => {
        state.count = 1;
      });

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('应该处理 null 返回值', () => {
      const Component = () => {
        const result = useObserver(() => null);
        return <div>{result === null ? 'null' : 'not null'}</div>;
      };

      render(<Component />);

      expect(screen.getByText('null')).toBeInTheDocument();
    });

    it('应该处理 undefined 返回值', () => {
      const Component = () => {
        const result = useObserver(() => undefined);
        return <div>{result === undefined ? 'undefined' : 'defined'}</div>;
      };

      render(<Component />);

      expect(screen.getByText('undefined')).toBeInTheDocument();
    });

    it('应该处理 0 返回值', () => {
      const state = observable({ count: 0 });

      const Component = () => {
        const count = useObserver(() => state.count);
        return <div>{count}</div>;
      };

      render(<Component />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('应该处理 false 返回值', () => {
      const state = observable({ flag: false });

      const Component = () => {
        const flag = useObserver(() => state.flag);
        return <div>{flag ? 'true' : 'false'}</div>;
      };

      render(<Component />);

      expect(screen.getByText('false')).toBeInTheDocument();
    });
  });

  describe('复杂交互场景', () => {
    it('应该在 observer 和 useObserver 混合使用中正确工作', async () => {
      const state = observable({ count: 0, multiplier: 2 });

      const InnerComponent = () => {
        const result = useObserver(() => state.count * state.multiplier);
        return <span data-testid="result">{result}</span>;
      };

      const OuterComponent = observer(() => (
        <div>
          <div data-testid="count">{state.count}</div>
          <InnerComponent />
        </div>
      ));

      render(<OuterComponent />);

      expect(screen.getByTestId('count')).toHaveTextContent('0');
      expect(screen.getByTestId('result')).toHaveTextContent('0');

      act(() => {
        state.count = 5;
      });

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('5');
        expect(screen.getByTestId('result')).toHaveTextContent('10');
      });
    });

    it('应该在深层嵌套中正确追踪', async () => {
      const state = observable({
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      });

      const Component = observer(() => <div>{state.level1.level2.level3.value}</div>);

      render(<Component />);

      expect(screen.getByText('deep')).toBeInTheDocument();

      act(() => {
        state.level1.level2.level3.value = 'updated';
      });

      await waitFor(() => {
        expect(screen.getByText('updated')).toBeInTheDocument();
      });
    });

    it('应该在数组和对象混合中正确追踪', async () => {
      const state = observable({
        users: [
          { id: 1, profile: { name: 'John' } },
          { id: 2, profile: { name: 'Jane' } },
        ],
      });

      const Component = observer(() => (
        <ul>
          {state.users.map(user => (
            <li key={user.id}>{user.profile.name}</li>
          ))}
        </ul>
      ));

      render(<Component />);

      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Jane')).toBeInTheDocument();

      act(() => {
        state.users[0].profile.name = 'Johnny';
      });

      await waitFor(() => {
        expect(screen.getByText('Johnny')).toBeInTheDocument();
      });
    });
  });
});
