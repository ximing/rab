/**
 * React 并发模式测试
 */
import React, { useState } from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { observer } from '../observer';
import { useLocalObservable } from '../useLocalObservable';
import { observable } from '@rabjs/observer';

describe('Concurrent Mode Support', () => {
  it('应该在 Suspense 边界内正常工作(不抛出 Promise)', async () => {
    // 这个测试验证 observer 组件在 Suspense 边界内可以正常渲染
    // 即使不抛出 Promise,也应该能正常工作
    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
        increment() {
          this.count++;
        },
      }));

      return (
        <div>
          <span data-testid="count">{state.count}</span>
          <button onClick={() => state.increment()}>increment</button>
        </div>
      );
    });

    render(
      <React.Suspense fallback={<div>loading</div>}>
        <TestComponent />
      </React.Suspense>
    );

    // 应该直接显示内容,不会显示 loading
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.queryByText('loading')).not.toBeInTheDocument();

    // 状态更新应该正常工作
    act(() => {
      fireEvent.click(screen.getByText('increment'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
  });

  it('应该与异步组件配合工作', async () => {
    // 创建一个真正的异步资源
    let resolveData: (value: string) => void;
    const dataPromise = new Promise<string>(resolve => {
      resolveData = resolve;
    });

    let hasData = false;
    let data = '';

    // 模拟 Suspense 资源
    const resource = {
      read() {
        if (!hasData) {
          throw dataPromise.then(value => {
            hasData = true;
            data = value;
          });
        }
        return data;
      },
    };

    const AsyncComponent = observer(() => {
      const loadedData = resource.read();
      const state = useLocalObservable(() => ({
        count: 0,
      }));

      return (
        <div>
          <span data-testid="data">{loadedData}</span>
          <span data-testid="count">{state.count}</span>
        </div>
      );
    });

    render(
      <React.Suspense fallback={<div>loading</div>}>
        <AsyncComponent />
      </React.Suspense>
    );

    // 应该显示 loading 状态
    expect(screen.getByText('loading')).toBeInTheDocument();

    // 解析数据
    act(() => {
      resolveData!('loaded data');
    });

    // 等待组件渲染
    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('loaded data');
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });

  it('应该在 StrictMode 中正确处理多次渲染', () => {
    const renderCount = { current: 0 };

    const TestComponent = observer(() => {
      renderCount.current++;
      const state = useLocalObservable(() => ({
        count: 0,
      }));

      return <div>{state.count}</div>;
    });

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    // StrictMode 在开发环境中会双重调用,但组件应该正确处理
    expect(renderCount.current).toBeGreaterThan(0);
  });

  it('应该在多个 observer 组件中正确处理状态', () => {
    const Component1 = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
      }));
      return <div>Count: {state.count}</div>;
    });

    const Component2 = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
      }));
      return <div>Double: {state.count * 2}</div>;
    });

    render(
      <React.StrictMode>
        <Component1 />
        <Component2 />
      </React.StrictMode>
    );

    expect(screen.getByText('Count: 0')).toBeInTheDocument();
    expect(screen.getByText('Double: 0')).toBeInTheDocument();
  });

  it('应该在并发更新中保持状态一致性', async () => {
    const sharedState = observable({ count: 0 });

    const Component1 = observer(() => {
      return <div data-testid="comp1">Component1: {sharedState.count}</div>;
    });

    const Component2 = observer(() => {
      return <div data-testid="comp2">Component2: {sharedState.count}</div>;
    });

    render(
      <>
        <Component1 />
        <Component2 />
      </>
    );

    expect(screen.getByTestId('comp1')).toHaveTextContent('Component1: 0');
    expect(screen.getByTestId('comp2')).toHaveTextContent('Component2: 0');

    // 并发更新状态
    act(() => {
      sharedState.count = 1;
    });

    await waitFor(() => {
      expect(screen.getByTestId('comp1')).toHaveTextContent('Component1: 1');
      expect(screen.getByTestId('comp2')).toHaveTextContent('Component2: 1');
    });
  });

  it('应该在 Suspense 和 StrictMode 组合下工作', async () => {
    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
        increment() {
          this.count++;
        },
      }));

      return (
        <div>
          <span data-testid="count">{state.count}</span>
          <button onClick={() => state.increment()}>increment</button>
        </div>
      );
    });

    render(
      <React.StrictMode>
        <React.Suspense fallback={<div>loading</div>}>
          <TestComponent />
        </React.Suspense>
      </React.StrictMode>
    );

    expect(screen.getByTestId('count')).toHaveTextContent('0');

    act(() => {
      fireEvent.click(screen.getByText('increment'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
  });
});
