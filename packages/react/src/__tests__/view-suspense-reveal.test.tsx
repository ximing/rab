/**
 * view 类组件：Suspense 隐藏→显示（reveal）路径的响应式正确性
 *
 * 背景：React 在「已显示内容的边界于更新期间 suspend」时走 Offscreen 隐藏 —
 * 对已挂载子树执行 componentWillUnmount（释放 reaction）但保留实例；
 * 解除后重放 componentDidMount 而不再 render（包装器 SCU 浅比较 bail out）。
 *
 * 两个回归：
 * 1. reveal 时 _onDidMount 没有首渲染快照可比对（snapshot===null），
 *    隐藏期间的 store 变更无从检测 —— 若仍走「同步收集、丢弃输出」，
 *    revived reaction 的新渲染输出被丢弃，DOM 永久停留在隐藏前的值
 *    （master 在此路径无条件 forceUpdate）。
 * 2. _committed 在 cWU 不重置：隐藏树被 props 驱动重渲染时走 committed
 *    路径，在 render 里重建并执行存活 reaction；若子树随后在隐藏中被删除，
 *    React 不会重放 cWU（hide 时已执行），reaction 永不 unobserve ——
 *    与首渲染泄漏同类的订阅泄漏。
 */
import React, { act, Suspense } from 'react';
import { render } from '@testing-library/react';
import { observable } from '@rabjs/observer';
// 直接引用 observer 源码内部探针（jest moduleNameMapper 保证与 @rabjs/observer
// 是同一模块实例）
import { getConnectionsCount } from '../../../observer/src/internals/reaction-track';
import { proxyToRaw } from '../../../observer/src/internals/proxy-raw-map';
import { view } from '../view';

function makeHarness(store: { count: number }) {
  const stats = { deadForceUpdates: 0, mounted: 0, unmounted: 0 };
  let aliveFlag = false;

  class ClassComp extends React.Component<{ marker?: number }> {
    componentDidMount() {
      aliveFlag = true;
      stats.mounted++;
    }

    componentWillUnmount() {
      aliveFlag = false;
      stats.unmounted++;
    }

    forceUpdate(callback?: () => void): void {
      if (!aliveFlag) {
        stats.deadForceUpdates++;
      }
      super.forceUpdate(callback);
    }

    render() {
      return <span data-testid="count">{store.count}</span>;
    }
  }

  return { ReactiveClass: view(ClassComp), stats };
}

function makeGate() {
  let shouldSuspend = false;
  let gate = new Promise<void>(() => {});
  let resolveGate: () => void = () => {};
  return {
    arm() {
      gate = new Promise<void>(r => {
        resolveGate = r;
      });
      shouldSuspend = true;
    },
    release() {
      shouldSuspend = false;
      resolveGate();
    },
    MaybeSuspend({ tick }: { tick: number }) {
      void tick;
      if (shouldSuspend) {
        throw gate;
      }
      return null;
    },
  };
}

describe('view 类组件：Suspense 隐藏→显示', () => {
  it('隐藏期间的 store 变更在 reveal 后反映到 DOM（reveal 无快照可比对，必须重渲染）', async () => {
    const store = observable({ count: 0 });
    const { ReactiveClass, stats } = makeHarness(store);
    const gate = makeGate();
    const { MaybeSuspend } = gate;

    function App({ tick }: { tick: number }) {
      return (
        <Suspense fallback={<span data-testid="fb">loading</span>}>
          <ReactiveClass />
          <MaybeSuspend tick={tick} />
        </Suspense>
      );
    }

    const { getByTestId, rerender } = render(<App tick={0} />);
    expect(getByTestId('count').textContent).toBe('0');

    // 更新期间 suspend：边界隐藏已挂载内容（cWU 释放 reaction），显示 fallback
    gate.arm();
    act(() => {
      rerender(<App tick={1} />);
    });
    // Offscreen 隐藏：DOM 保留但 display:none，cWU 已执行（reaction 已释放）
    expect(getByTestId('count').style.display).toBe('none');
    expect(stats.unmounted).toBe(1);

    // 隐藏期间数据变化：没有订阅（by design），写入无人接收
    act(() => {
      store.count = 42;
    });

    // 解除 suspend：React 重放 cDM 而不 render（props 未变，SCU bail out）
    await act(async () => {
      gate.release();
      await Promise.resolve();
    });

    expect(getByTestId('count').textContent).toBe('42');

    // reveal 后响应式必须恢复
    act(() => {
      store.count = 43;
    });
    expect(getByTestId('count').textContent).toBe('43');
  });

  it('隐藏期间被驱动 render 后在隐藏中删除：reaction 不泄漏', async () => {
    const store = observable({ count: 0 });
    const raw = (proxyToRaw.get(store) as object) ?? store;
    const { ReactiveClass, stats } = makeHarness(store);
    const gate = makeGate();
    const { MaybeSuspend } = gate;

    function App({ tick, show }: { tick: number; show: boolean }) {
      return show ? (
        <Suspense fallback={<span data-testid="fb">loading</span>}>
          <ReactiveClass marker={tick} />
          <MaybeSuspend tick={tick} />
        </Suspense>
      ) : (
        <span data-testid="gone">gone</span>
      );
    }

    const { getByTestId, rerender } = render(<App tick={0} show={true} />);
    expect(getConnectionsCount(raw)).toBe(1);

    // 隐藏已挂载的子树
    gate.arm();
    act(() => {
      rerender(<App tick={1} show={true} />);
    });
    expect(getByTestId('count').style.display).toBe('none');
    expect(stats.unmounted).toBe(1);
    // hide 的 cWU 已释放 reaction
    expect(getConnectionsCount(raw)).toBe(0);

    // 隐藏期间以新 props 驱动子树重渲染：committed 路径会在 render 里
    // 重建并执行存活 reaction（泄漏的入口）
    act(() => {
      rerender(<App tick={2} show={true} />);
    });

    // 子树在隐藏中被删除：React 不会重放 cWU（hide 时已执行过）
    act(() => {
      rerender(<App tick={3} show={false} />);
    });

    // 泄漏形态：store 上残留 connection entry
    expect(getConnectionsCount(raw)).toBe(0);

    // 泄漏功能后果：变更触发死实例的 forceUpdate
    act(() => {
      store.count = 99;
    });
    expect(stats.deadForceUpdates).toBe(0);
  });
});
