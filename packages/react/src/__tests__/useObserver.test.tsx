/**
 * useObserver Hook 测试
 */
import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useObserver } from '../useObserver';
import { observable } from '@rabjs/observer';

describe('useObserver Hook', () => {
  it('应该追踪 observable 的变化', async () => {
    const state = observable({ count: 0 });

    function TestComponent() {
      const count = useObserver(() => state.count);
      return <div>{count}</div>;
    }

    const { rerender } = render(<TestComponent />);
    expect(screen.getByText('0')).toBeInTheDocument();

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('应该支持在严格模式下的多次渲染', async () => {
    const state = observable({ count: 0 });
    const renderCount = { value: 0 };

    function TestComponent() {
      renderCount.value++;
      const count = useObserver(() => state.count);
      return <div>{count}</div>;
    }

    const { rerender } = render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('0')).toBeInTheDocument();

    // 在严格模式下，状态变化应该正确触发重新渲染
    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // 再次更新状态
    act(() => {
      state.count = 2;
    });
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    // 强制重新渲染组件
    rerender(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('应该在严格模式下正确处理多个 observable 对象', async () => {
    const state1 = observable({ value: 'a' });
    const state2 = observable({ value: 'b' });

    function TestComponent() {
      const val1 = useObserver(() => state1.value);
      const val2 = useObserver(() => state2.value);
      return (
        <div>
          <span>{val1}</span>
          <span>{val2}</span>
        </div>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();

    // 更新第一个 observable
    act(() => {
      state1.value = 'a1';
    });
    await waitFor(() => {
      expect(screen.getByText('a1')).toBeInTheDocument();
    });

    // 更新第二个 observable
    act(() => {
      state2.value = 'b1';
    });
    await waitFor(() => {
      expect(screen.getByText('b1')).toBeInTheDocument();
    });
  });

  it('应该在严格模式下正确处理嵌套对象', async () => {
    const state = observable({
      user: {
        name: 'John',
        profile: {
          age: 30,
        },
      },
    });

    function TestComponent() {
      const name = useObserver(() => state.user.name);
      const age = useObserver(() => state.user.profile.age);
      return (
        <div>
          <span>{name}</span>
          <span>{age}</span>
        </div>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    // 更新嵌套属性
    act(() => {
      state.user.name = 'Jane';
    });
    await waitFor(() => {
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    act(() => {
      state.user.profile.age = 31;
    });
    await waitFor(() => {
      expect(screen.getByText('31')).toBeInTheDocument();
    });
  });

  it('应该在严格模式下正确处理条件渲染', async () => {
    const state = observable({ show: true, count: 0 });

    function TestComponent() {
      const show = useObserver(() => state.show);
      const count = useObserver(() => state.count);
      return (
        <div>
          {show && <span>{count}</span>}
          <span>show: {show ? 'yes' : 'no'}</span>
        </div>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('show: yes')).toBeInTheDocument();

    // 隐藏元素
    act(() => {
      state.show = false;
    });
    await waitFor(() => {
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(screen.getByText('show: no')).toBeInTheDocument();
    });

    // 再次显示
    act(() => {
      state.show = true;
      state.count = 5;
    });
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('show: yes')).toBeInTheDocument();
    });
  });

  it('应该在严格模式下正确处理列表渲染', async () => {
    const state = observable({ items: ['a', 'b', 'c'] });

    function TestComponent() {
      // 在 useObserver 中访问整个数组，以便追踪数组的变化
      const items = useObserver(() => {
        // 通过访问 length 来确保追踪数组的长度变化
        return state.items.slice();
      });
      return (
        <ul>
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();

    // 修改列表元素
    act(() => {
      state.items[0] = 'a-modified';
    });
    await waitFor(() => {
      expect(screen.getByText('a-modified')).toBeInTheDocument();
    });

    // 修改列表元素
    act(() => {
      state.items[1] = 'b-modified';
    });
    await waitFor(() => {
      expect(screen.getByText('b-modified')).toBeInTheDocument();
    });
  });

  it('应该在并发模式下工作', async () => {
    const state = observable({ count: 0 });

    function TestComponent() {
      const count = useObserver(() => state.count);
      return <div>{count}</div>;
    }

    render(
      <React.Suspense fallback={<div>loading</div>}>
        <TestComponent />
      </React.Suspense>
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('应该正确处理异常', async () => {
    const state = observable({ count: 0 });
    const errorBoundary = { error: null as Error | null };

    function TestComponent() {
      try {
        return useObserver(() => {
          if (state.count > 0) {
            throw new Error('Count is too high');
          }
          return <div>{state.count}</div>;
        });
      } catch (error) {
        errorBoundary.error = error as Error;
        return <div>Error: {(error as Error).message}</div>;
      }
    }

    render(<TestComponent />);
    expect(screen.getByText('0')).toBeInTheDocument();

    await act(async () => {
      state.count = 1;
    });

    // 异常会被捕获并显示
    expect(screen.getByText('Error: Count is too high')).toBeInTheDocument();
  });

  it('应该支持自定义组件名称用于调试', () => {
    const state = observable({ count: 0 });

    function TestComponent() {
      return useObserver(() => <div>{state.count}</div>, 'MyCustomComponent');
    }

    render(<TestComponent />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('应该在严格模式下正确处理多个 useObserver 调用', async () => {
    const state = observable({ a: 1, b: 2, c: 3 });

    function TestComponent() {
      const a = useObserver(() => state.a);
      const b = useObserver(() => state.b);
      const c = useObserver(() => state.c);
      const sum = useObserver(() => state.a + state.b + state.c);
      return (
        <div>
          <span>a: {a}</span>
          <span>b: {b}</span>
          <span>c: {c}</span>
          <span>sum: {sum}</span>
        </div>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('a: 1')).toBeInTheDocument();
    expect(screen.getByText('b: 2')).toBeInTheDocument();
    expect(screen.getByText('c: 3')).toBeInTheDocument();
    expect(screen.getByText('sum: 6')).toBeInTheDocument();

    // 更新所有值
    act(() => {
      state.a = 10;
      state.b = 20;
      state.c = 30;
    });
    await waitFor(() => {
      expect(screen.getByText('a: 10')).toBeInTheDocument();
      expect(screen.getByText('b: 20')).toBeInTheDocument();
      expect(screen.getByText('c: 30')).toBeInTheDocument();
      expect(screen.getByText('sum: 60')).toBeInTheDocument();
    });
  });

  it('应该在严格模式下正确处理快速连续的状态更新', async () => {
    const state = observable({ count: 0 });

    function TestComponent() {
      const count = useObserver(() => state.count);
      return <div>{count}</div>;
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('0')).toBeInTheDocument();

    // 快速连续更新
    act(() => {
      state.count = 1;
      state.count = 2;
      state.count = 3;
      state.count = 4;
      state.count = 5;
    });
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('应该在严格模式下正确处理对象替换', async () => {
    const state = observable({ user: { name: 'John', age: 30 } });

    function TestComponent() {
      const user = useObserver(() => state.user);
      return (
        <div>
          <span>{user.name}</span>
          <span>{user.age}</span>
        </div>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    // 替换整个对象
    act(() => {
      state.user = { name: 'Jane', age: 25 };
    });
    await waitFor(() => {
      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  it('应该在严格模式下正确处理计算属性', async () => {
    const state = observable({ width: 100, height: 200 });

    function TestComponent() {
      const area = useObserver(() => state.width * state.height);
      const perimeter = useObserver(() => 2 * (state.width + state.height));
      return (
        <div>
          <span>area: {area}</span>
          <span>perimeter: {perimeter}</span>
        </div>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('area: 20000')).toBeInTheDocument();
    expect(screen.getByText('perimeter: 600')).toBeInTheDocument();

    // 更新尺寸
    act(() => {
      state.width = 50;
      state.height = 100;
    });
    await waitFor(() => {
      expect(screen.getByText('area: 5000')).toBeInTheDocument();
      expect(screen.getByText('perimeter: 300')).toBeInTheDocument();
    });
  });

  it('应该在严格模式下正确处理布尔值切换', async () => {
    const state = observable({ isActive: false, isVisible: true });

    function TestComponent() {
      const isActive = useObserver(() => state.isActive);
      const isVisible = useObserver(() => state.isVisible);
      return (
        <div>
          <span>active: {isActive ? 'yes' : 'no'}</span>
          <span>visible: {isVisible ? 'yes' : 'no'}</span>
        </div>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('active: no')).toBeInTheDocument();
    expect(screen.getByText('visible: yes')).toBeInTheDocument();

    // 切换布尔值
    act(() => {
      state.isActive = true;
      state.isVisible = false;
    });
    await waitFor(() => {
      expect(screen.getByText('active: yes')).toBeInTheDocument();
      expect(screen.getByText('visible: no')).toBeInTheDocument();
    });

    // 再次切换
    act(() => {
      state.isActive = false;
      state.isVisible = true;
    });
    await waitFor(() => {
      expect(screen.getByText('active: no')).toBeInTheDocument();
      expect(screen.getByText('visible: yes')).toBeInTheDocument();
    });
  });

  it('应该在严格模式下正确处理字符串拼接', async () => {
    const state = observable({ firstName: 'John', lastName: 'Doe' });

    function TestComponent() {
      const fullName = useObserver(() => `${state.firstName} ${state.lastName}`);
      return <div>{fullName}</div>;
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    // 更新名字
    act(() => {
      state.firstName = 'Jane';
    });
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    // 更新姓氏
    act(() => {
      state.lastName = 'Smith';
    });
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });
});
