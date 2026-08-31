/**
 * view/observer 组件 reaction 死亡后的重建测试
 *
 * 实证结论（React 19 并发模式）：
 * - 首次渲染抛 Suspense 的组件会被整体重挂载（fiber/hook 状态不保留），
 *   函数组件路径不会留下死 reaction；
 * - 已 commit 的组件 re-suspend 时 effect cleanup 会把 adm.reaction 置空，
 *   subscribe 的 recreate 兜底，函数组件自愈；
 * - 类组件（view）则不同：componentWillUnmount 把 _reactiveRender 置空后
 *   没有任何地方重建——StrictMode 模拟卸载、Suspense 隐藏→显示都会让
 *   组件永久失去响应式（静默，无报错）。
 */
import React, { act, Suspense, useState } from 'react';
import { render, screen } from '@testing-library/react';
import { observable } from '@rabjs/observer';
import { observer } from '../observer';
import { view } from '../view';

const NEVER = new Promise<void>(() => {});

describe('view 类组件 reaction 重建', () => {
  it('StrictMode 挂载后仍响应 observable 变化', () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    render(
      <React.StrictMode>
        <ReactiveClass />
      </React.StrictMode>
    );
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    // StrictMode 模拟卸载会调用 componentWillUnmount 置空 _reactiveRender，
    // 修复前此后所有渲染走裸 render 降级路径，此处断言会停留在 '0'
    act(() => {
      store.count = 1;
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('Suspense 隐藏→显示（跨 commit 的 effect 拆除/重建）后仍响应', async () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    let toggle: (v: boolean) => void = () => {};
    function MaybeSuspend({ closed }: { closed: boolean }) {
      if (closed) {
        throw NEVER;
      }
      return null;
    }
    function Host() {
      const [hidden, setHidden] = useState(false);
      toggle = setHidden;
      return (
        <Suspense fallback={<span data-testid="fb">loading</span>}>
          <MaybeSuspend closed={hidden} />
          <ReactiveClass />
        </Suspense>
      );
    }

    render(<Host />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    // 重新隐藏：committed 内容被 Offscreen 隐藏，effect/cWU 拆除
    await act(async () => {
      toggle(true);
    });
    expect(screen.getByTestId('fb')).toBeInTheDocument();

    // 显示：实例复用，reaction 需在 render 中重建
    await act(async () => {
      toggle(false);
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    // 修复前：reaction 已被 cWU 置空且无重建，此处断言停留在 '0'
    act(() => {
      store.count = 1;
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('重建后再次经历 隐藏→显示 仍保持响应（重建不是一次性修复）', async () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    let toggle: (v: boolean) => void = () => {};
    function MaybeSuspend({ closed }: { closed: boolean }) {
      if (closed) {
        throw NEVER;
      }
      return null;
    }
    function Host() {
      const [hidden, setHidden] = useState(false);
      toggle = setHidden;
      return (
        <Suspense fallback={<span data-testid="fb">loading</span>}>
          <MaybeSuspend closed={hidden} />
          <ReactiveClass />
        </Suspense>
      );
    }

    render(<Host />);

    for (let round = 1; round <= 2; round++) {
      await act(async () => {
        toggle(true);
      });
      await act(async () => {
        toggle(false);
      });
      act(() => {
        store.count = round;
      });
      expect(screen.getByTestId('count')).toHaveTextContent(String(round));
    }
  });
});

describe('observer 函数组件:同类场景下的自愈行为（覆盖性测试）', () => {
  it('StrictMode 下 subscribe 重建的 reaction 首跑挂起，恢复后仍响应', async () => {
    const store = observable({ count: 0 });
    let renderCount = 0;
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>(r => {
      resolveGate = r;
    });
    let gateOpen = false;

    const Comp = observer(function Probe() {
      renderCount++;
      // 前两次渲染（StrictMode 双渲染）成功；第三次起（subscribe 重建
      // reaction 后的强制重渲染）读取未开闸的 gate → Suspense
      if (renderCount >= 3 && !gateOpen) {
        throw gate;
      }
      return <span data-testid="count">{store.count}</span>;
    });

    render(
      <React.StrictMode>
        <Suspense fallback={<span data-testid="fb">loading</span>}>
          <Comp />
        </Suspense>
      </React.StrictMode>
    );
    // 强制重渲染挂起 → 边界显示 fallback
    expect(screen.getByTestId('fb')).toBeInTheDocument();

    await act(async () => {
      gateOpen = true;
      resolveGate();
      await Promise.resolve();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    // 函数组件由 subscribe cleanup/recreate 兜底自愈；此断言防止
    // 未来改动（如跳过 subscribe 重建）破坏该路径
    act(() => {
      store.count = 42;
    });
    expect(screen.getByTestId('count')).toHaveTextContent('42');
  });
});
