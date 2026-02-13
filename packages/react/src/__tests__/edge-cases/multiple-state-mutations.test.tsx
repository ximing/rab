/**
 * 多次状态修改渲染次数测试
 *
 * 测试场景：在同一个函数中多次修改 state，验证 React 组件的渲染次数
 * 目的：确保响应式系统能够正确批处理多个状态变化，避免不必要的重新渲染
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { observer, useLocalObservable, observable } from '../../main';

// ============ 测试工具 ============

/**
 * 渲染计数器 - 用于追踪组件渲染次数
 */
class RenderCounter {
  count = 0;

  increment() {
    this.count++;
  }

  reset() {
    this.count = 0;
  }

  getCount() {
    return this.count;
  }
}

// ============ 测试用例 ============

describe('多次状态修改渲染次数', () => {
  it('应该在同一个函数中多次修改 state 时只渲染一次', async () => {
    const renderCounter = new RenderCounter();
    const state = observable({
      count: 0,
      name: 'test',
      value: 0,
    });

    const TestComponent = observer(() => {
      renderCounter.increment();
      return (
        <div>
          <div data-testid="count">{state.count}</div>
          <div data-testid="name">{state.name}</div>
          <div data-testid="value">{state.value}</div>
          <div data-testid="render-count">{renderCounter.getCount()}</div>
        </div>
      );
    });

    render(<TestComponent />);

    // 初始渲染
    expect(renderCounter.getCount()).toBe(1);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('name')).toHaveTextContent('test');
    expect(screen.getByTestId('value')).toHaveTextContent('0');

    // 在同一个函数中多次修改 state
    const updateState = () => {
      state.count = 1;
      state.name = 'updated';
      state.value = 100;
    };

    updateState();

    // 应该只渲染一次（批处理）
    await waitFor(() => {
      expect(renderCounter.getCount()).toBe(2);
      expect(screen.getByTestId('count')).toHaveTextContent('1');
      expect(screen.getByTestId('name')).toHaveTextContent('updated');
      expect(screen.getByTestId('value')).toHaveTextContent('100');
    });
  });

  it('应该在事件处理器中多次修改 state 时只渲染一次', async () => {
    const renderCounter = new RenderCounter();
    const state = observable({
      a: 0,
      b: 0,
      c: 0,
    });

    const TestComponent = observer(() => {
      renderCounter.increment();

      const handleClick = () => {
        state.a += 1;
        state.b += 1;
        state.c += 1;
      };

      return (
        <div>
          <div data-testid="values">
            {state.a}-{state.b}-{state.c}
          </div>
          <button onClick={handleClick} data-testid="update-btn">
            Update
          </button>
          <div data-testid="render-count">{renderCounter.getCount()}</div>
        </div>
      );
    });

    render(<TestComponent />);

    expect(renderCounter.getCount()).toBe(1);
    expect(screen.getByTestId('values')).toHaveTextContent('0-0-0');

    // 点击按钮触发多个状态修改
    const button = screen.getByTestId('update-btn');
    fireEvent.click(button);

    // 应该只渲染一次
    await waitFor(() => {
      expect(renderCounter.getCount()).toBe(2);
      expect(screen.getByTestId('values')).toHaveTextContent('1-1-1');
    });
  });

  it('应该在异步函数中多次修改 state 时正确渲染', async () => {
    const renderCounter = new RenderCounter();
    const state = observable({
      step1: false,
      step2: false,
      step3: false,
      loading: false,
    });

    const TestComponent = observer(() => {
      renderCounter.increment();

      const handleAsyncUpdate = async () => {
        state.loading = true;

        // 模拟异步操作
        await new Promise(resolve => setTimeout(resolve, 50));

        state.step1 = true;
        state.step2 = true;
        state.step3 = true;
        state.loading = false;
      };

      return (
        <div>
          <div data-testid="status">{state.loading ? 'loading' : 'done'}</div>
          <div data-testid="steps">
            {state.step1 ? '✓' : '✗'}-{state.step2 ? '✓' : '✗'}-{state.step3 ? '✓' : '✗'}
          </div>
          <button onClick={handleAsyncUpdate} data-testid="async-btn">
            Async Update
          </button>
          <div data-testid="render-count">{renderCounter.getCount()}</div>
        </div>
      );
    });

    render(<TestComponent />);

    expect(renderCounter.getCount()).toBe(1);
    expect(screen.getByTestId('status')).toHaveTextContent('done');

    const button = screen.getByTestId('async-btn');
    fireEvent.click(button);

    // 等待 loading 状态更新
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('loading');
    });

    const renderCountAfterLoading = renderCounter.getCount();

    // 等待异步操作完成
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('done');
      expect(screen.getByTestId('steps')).toHaveTextContent('✓-✓-✓');
    });

    // 应该有两次额外的渲染：一次是 loading=true，一次是最终状态
    expect(renderCounter.getCount()).toBe(renderCountAfterLoading + 1);
  });

  it('应该在循环中多次修改 state 时只渲染一次', async () => {
    const renderCounter = new RenderCounter();
    const state = observable({
      items: [0, 0, 0, 0, 0],
      total: 0,
    });

    const TestComponent = observer(() => {
      renderCounter.increment();

      const handleBatchUpdate = () => {
        // 在循环中修改多个项
        for (let i = 0; i < state.items.length; i++) {
          state.items[i] = i + 1;
        }
        // 计算总和
        state.total = state.items.reduce((sum, item) => sum + item, 0);
      };

      return (
        <div>
          <div data-testid="items">{state.items.join(',')}</div>
          <div data-testid="total">{state.total}</div>
          <button onClick={handleBatchUpdate} data-testid="batch-btn">
            Batch Update
          </button>
          <div data-testid="render-count">{renderCounter.getCount()}</div>
        </div>
      );
    });

    render(<TestComponent />);

    expect(renderCounter.getCount()).toBe(1);
    expect(screen.getByTestId('items')).toHaveTextContent('0,0,0,0,0');
    expect(screen.getByTestId('total')).toHaveTextContent('0');

    const button = screen.getByTestId('batch-btn');
    fireEvent.click(button);

    // 应该只渲染一次
    await waitFor(() => {
      expect(renderCounter.getCount()).toBe(2);
      expect(screen.getByTestId('items')).toHaveTextContent('1,2,3,4,5');
      expect(screen.getByTestId('total')).toHaveTextContent('15');
    });
  });

  it('应该在 useLocalObservable 中多次修改 state 时只渲染一次', async () => {
    const renderCounter = new RenderCounter();

    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        x: 0,
        y: 0,
        z: 0,

        updateAll() {
          this.x = 10;
          this.y = 20;
          this.z = 30;
        },
      }));

      renderCounter.increment();

      return (
        <div>
          <div data-testid="coords">
            {state.x},{state.y},{state.z}
          </div>
          <button onClick={() => state.updateAll()} data-testid="update-coords">
            Update Coords
          </button>
          <div data-testid="render-count">{renderCounter.getCount()}</div>
        </div>
      );
    });

    render(<TestComponent />);

    expect(renderCounter.getCount()).toBe(1);
    expect(screen.getByTestId('coords')).toHaveTextContent('0,0,0');

    const button = screen.getByTestId('update-coords');
    fireEvent.click(button);

    // 应该只渲染一次
    await waitFor(() => {
      expect(renderCounter.getCount()).toBe(2);
      expect(screen.getByTestId('coords')).toHaveTextContent('10,20,30');
    });
  });

  it('应该在嵌套对象修改时只渲染一次', async () => {
    const renderCounter = new RenderCounter();
    const state = observable({
      user: {
        name: 'John',
        age: 30,
        address: {
          city: 'Beijing',
          country: 'China',
        },
      },
    });

    const TestComponent = observer(() => {
      renderCounter.increment();

      const handleUpdate = () => {
        state.user.name = 'Jane';
        state.user.age = 25;
        state.user.address.city = 'Shanghai';
        state.user.address.country = 'China';
      };

      return (
        <div>
          <div data-testid="user-info">
            {state.user.name}, {state.user.age}, {state.user.address.city}
          </div>
          <button onClick={handleUpdate} data-testid="update-user">
            Update User
          </button>
          <div data-testid="render-count">{renderCounter.getCount()}</div>
        </div>
      );
    });

    render(<TestComponent />);

    expect(renderCounter.getCount()).toBe(1);
    expect(screen.getByTestId('user-info')).toHaveTextContent('John, 30, Beijing');

    const button = screen.getByTestId('update-user');
    fireEvent.click(button);

    // 应该只渲染一次
    await waitFor(() => {
      expect(renderCounter.getCount()).toBe(2);
      expect(screen.getByTestId('user-info')).toHaveTextContent('Jane, 25, Shanghai');
    });
  });

  it('应该在多个 observer 组件中正确处理多次修改', async () => {
    const renderCounter1 = new RenderCounter();
    const renderCounter2 = new RenderCounter();
    const state = observable({
      count: 0,
      name: 'test',
    });

    const Component1 = observer(() => {
      renderCounter1.increment();
      return <div data-testid="comp1">{state.count}</div>;
    });

    const Component2 = observer(() => {
      renderCounter2.increment();
      return <div data-testid="comp2">{state.name}</div>;
    });

    const TestComponent = () => {
      const handleUpdate = () => {
        state.count = 1;
        state.name = 'updated';
      };

      return (
        <div>
          <Component1 />
          <Component2 />
          <button onClick={handleUpdate} data-testid="update-btn">
            Update
          </button>
        </div>
      );
    };

    render(<TestComponent />);

    expect(renderCounter1.getCount()).toBe(1);
    expect(renderCounter2.getCount()).toBe(1);

    const button = screen.getByTestId('update-btn');
    fireEvent.click(button);

    // 两个组件都应该只渲染一次
    await waitFor(() => {
      expect(renderCounter1.getCount()).toBe(2);
      expect(renderCounter2.getCount()).toBe(2);
      expect(screen.getByTestId('comp1')).toHaveTextContent('1');
      expect(screen.getByTestId('comp2')).toHaveTextContent('updated');
    });
  });

  it('应该在条件分支中多次修改 state 时只渲染一次', async () => {
    const renderCounter = new RenderCounter();
    const state = observable({
      mode: 'simple',
      a: 0,
      b: 0,
      c: 0,
    });

    const TestComponent = observer(() => {
      renderCounter.increment();

      const handleUpdate = () => {
        if (state.mode === 'simple') {
          state.a = 1;
          state.b = 2;
        } else {
          state.a = 10;
          state.b = 20;
          state.c = 30;
        }
      };

      return (
        <div>
          <div data-testid="values">
            {state.a}-{state.b}-{state.c}
          </div>
          <div data-testid="mode">{state.mode}</div>
          <button onClick={handleUpdate} data-testid="update-btn">
            Update
          </button>
          <button
            onClick={() => (state.mode = state.mode === 'simple' ? 'complex' : 'simple')}
            data-testid="toggle-mode"
          >
            Toggle Mode
          </button>
          <div data-testid="render-count">{renderCounter.getCount()}</div>
        </div>
      );
    });

    render(<TestComponent />);

    expect(renderCounter.getCount()).toBe(1);

    // 第一次更新（simple 模式）
    let button = screen.getByTestId('update-btn');
    fireEvent.click(button);

    await waitFor(() => {
      expect(renderCounter.getCount()).toBe(2);
      expect(screen.getByTestId('values')).toHaveTextContent('1-2-0');
    });

    const renderCountAfterFirstUpdate = renderCounter.getCount();

    // 切换模式
    const toggleBtn = screen.getByTestId('toggle-mode');
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mode')).toHaveTextContent('complex');
    });

    const renderCountAfterToggle = renderCounter.getCount();
    // 切换模式应该导致一次额外的渲染
    expect(renderCountAfterToggle).toBe(renderCountAfterFirstUpdate + 1);

    // 第二次更新（complex 模式）
    button = screen.getByTestId('update-btn');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('values')).toHaveTextContent('10-20-30');
    });

    // 应该只有一次额外的渲染
    expect(renderCounter.getCount()).toBe(renderCountAfterToggle + 1);
  });

  it('应该在数组操作中多次修改 state 时只渲染一次', async () => {
    const renderCounter = new RenderCounter();
    const state = observable({
      items: [1, 2, 3],
      count: 0,
    });

    const TestComponent = observer(() => {
      renderCounter.increment();

      const handleBatchOperation = () => {
        // 多个数组操作
        state.items.push(4);
        state.items.push(5);
        state.items[0] = 10;
        state.count = state.items.length;
      };

      return (
        <div>
          <div data-testid="items">{state.items.join(',')}</div>
          <div data-testid="count">{state.count}</div>
          <button onClick={handleBatchOperation} data-testid="batch-btn">
            Batch Operation
          </button>
          <div data-testid="render-count">{renderCounter.getCount()}</div>
        </div>
      );
    });

    render(<TestComponent />);

    expect(renderCounter.getCount()).toBe(1);
    expect(screen.getByTestId('items')).toHaveTextContent('1,2,3');
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    const button = screen.getByTestId('batch-btn');
    fireEvent.click(button);

    // 应该只渲染一次
    await waitFor(() => {
      expect(renderCounter.getCount()).toBe(2);
      expect(screen.getByTestId('items')).toHaveTextContent('10,2,3,4,5');
      expect(screen.getByTestId('count')).toHaveTextContent('5');
    });
  });
});
