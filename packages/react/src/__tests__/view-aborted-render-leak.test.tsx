/**
 * view 类组件：render pass 被丢弃（永不 commit）时 reaction 不得泄漏
 *
 * 背景：构造函数/渲染期创建的 reaction 在 render 中执行后即向 store 注册
 * 依赖。若该 render pass 因兄弟组件 suspend 等原因被整体丢弃且永不 commit，
 * componentWillUnmount 不会运行——reaction 永久留在 connectionStore 中，
 * 其 scheduler 闭包持续对已丢弃实例 forceUpdate。类组件无法套用
 * useObserver 的 FinalizationRegistry 兜底（泄漏子图 store→reaction→实例
 * 自持，registry 永不触发），唯一可靠的修法是 commit 前不做依赖追踪：
 * 首渲染裸执行，componentDidMount 建 reaction 并强制重跑一次收集依赖。
 */
import React, { act, Suspense } from 'react';
import { render } from '@testing-library/react';
import { observable } from '@rabjs/observer';
// 直接引用 observer 源码内部探针（jest moduleNameMapper 保证与 @rabjs/observer
// 是同一模块实例）
import { getConnectionsCount } from '../../../observer/src/internals/reaction-track';
import { proxyToRaw } from '../../../observer/src/internals/proxy-raw-map';
import { view } from '../view';

const NEVER = new Promise<void>(() => {});

function makeInstrumentedComponent(store: { count: number }) {
  const stats = {
    constructed: 0,
    mounted: 0,
    /** 从未挂载（或已卸载）实例收到的 forceUpdate 次数 —— 泄漏 reaction 的直接证据 */
    deadForceUpdates: 0,
  };

  class ClassComp extends React.Component {
    private alive = false;

    constructor(props: Record<string, never>) {
      super(props);
      stats.constructed++;
    }

    componentDidMount() {
      stats.mounted++;
      this.alive = true;
    }

    componentWillUnmount() {
      this.alive = false;
    }

    forceUpdate(callback?: () => void): void {
      if (!this.alive) {
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

describe('view 类组件：被丢弃的 render pass 不得泄漏 reaction', () => {
  it('回归控制：正常挂载→卸载后无残留依赖、无死实例调度', () => {
    const store = observable({ count: 0 });
    const raw = (proxyToRaw.get(store) as object) ?? store;
    const { ReactiveClass } = makeInstrumentedComponent(store);

    const { unmount } = render(<ReactiveClass />);
    expect(getConnectionsCount(raw)).toBe(1);

    unmount();
    expect(getConnectionsCount(raw)).toBe(0);

    act(() => {
      store.count = 1;
    });
  });

  it('兄弟组件永久 suspend 导致 render pass 永不 commit：卸载边界后无泄漏', () => {
    const store = observable({ count: 0 });
    const raw = (proxyToRaw.get(store) as object) ?? store;
    const { ReactiveClass, stats } = makeInstrumentedComponent(store);

    function MaybeSuspend() {
      throw NEVER;
    }

    const { unmount } = render(
      <Suspense fallback={<span data-testid="fb">loading</span>}>
        <ReactiveClass />
        <MaybeSuspend />
      </Suspense>
    );

    // 兄弟永远 suspend：我们的组件被构造/渲染过，但从未 commit
    expect(stats.constructed).toBeGreaterThan(0);
    expect(stats.mounted).toBe(0);

    unmount();

    // 泄漏形态：store 上残留 connection entry（应为 0）
    expect(getConnectionsCount(raw)).toBe(0);

    // 泄漏功能后果：变更触发死实例的 forceUpdate（应为 0）
    act(() => {
      store.count = 1;
    });
    expect(stats.deadForceUpdates).toBe(0);
  });

  it('suspend 解除后组件正常挂载并保持响应（commit 后追踪开启）', async () => {
    const store = observable({ count: 0 });
    const { ReactiveClass, stats } = makeInstrumentedComponent(store);

    let gateOpen = false;
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>(r => {
      resolveGate = r;
    });
    function MaybeSuspend() {
      if (!gateOpen) {
        throw gate;
      }
      return null;
    }

    render(
      <Suspense fallback={<span data-testid="fb">loading</span>}>
        <ReactiveClass />
        <MaybeSuspend />
      </Suspense>
    );
    expect(stats.mounted).toBe(0);

    await act(async () => {
      gateOpen = true;
      resolveGate();
      await Promise.resolve();
    });
    expect(stats.mounted).toBeGreaterThan(0);

    // commit 后必须正常响应
    act(() => {
      store.count = 7;
    });
    // 通过 DOM 断言：挂载的实例渲染了新值
    const spans = document.querySelectorAll('[data-testid="count"]');
    expect(spans[spans.length - 1]).toHaveTextContent('7');
  });
});
