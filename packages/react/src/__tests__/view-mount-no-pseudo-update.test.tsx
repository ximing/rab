/**
 * view 类组件：挂载不得变成一次「伪 update commit」
 *
 * 背景：commit 前不做依赖追踪的修复（见 view-aborted-render-leak）让
 * componentDidMount 负责首次依赖收集。若用 forceUpdate 完成收集，
 * 每次挂载都会额外走一遍完整 update commit —— componentDidUpdate /
 * getSnapshotBeforeUpdate 紧随 mount 被触发（prevProps === props），
 * 未做挂载防护的用户副作用（滚动到底、focus、analytics updated 事件）
 * 被 spurious 执行。修复：cDM 里同步执行一次 reaction 完成收集，
 * 输出与刚 commit 的首渲染必然相同，直接丢弃，不产生 commit。
 */
import React, { act } from 'react';
import { render } from '@testing-library/react';
import { observable } from '@rabjs/observer';
// 直接引用 observer 源码内部探针（jest moduleNameMapper 保证与 @rabjs/observer
// 是同一模块实例）
import { getConnectionsCount } from '../../../observer/src/internals/reaction-track';
import { proxyToRaw } from '../../../observer/src/internals/proxy-raw-map';
import { view } from '../view';

describe('view 类组件：挂载不产生伪 update commit', () => {
  it('挂载后 componentDidUpdate / getSnapshotBeforeUpdate 不被触发', () => {
    const store = observable({ count: 0 });
    const calls: string[] = [];

    class ClassComp extends React.Component {
      componentDidMount() {
        calls.push('cDM');
      }

      componentDidUpdate() {
        calls.push('cDU');
      }

      getSnapshotBeforeUpdate() {
        calls.push('gSBU');
        return null;
      }

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    render(<ReactiveClass />);

    expect(calls).toContain('cDM');
    expect(calls).not.toContain('cDU');
    expect(calls).not.toContain('gSBU');
  });

  it('回归控制：挂载后的 observable 变化仍正常触发更新', () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    const { getByTestId } = render(<ReactiveClass />);
    expect(getByTestId('count').textContent).toBe('0');

    act(() => {
      store.count = 42;
    });
    expect(getByTestId('count').textContent).toBe('42');
  });

  it('原型方法 cWU 抛错时 reaction 仍被释放（订阅不泄漏）', () => {
    const store = observable({ count: 0 });
    const raw = (proxyToRaw.get(store) as object) ?? store;

    class ClassComp extends React.Component {
      // 原型方法（非箭头字段）：走包装器原型上的 componentWillUnmount
      // —— super.componentWillUnmount() 抛错不得跳过 _releaseReaction
      componentWillUnmount() {
        throw new Error('user-cwu-exploded');
      }

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    const { unmount } = render(<ReactiveClass />);
    expect(getConnectionsCount(raw)).toBe(1);

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      unmount();
    } catch {
      // React 可能把 cWU 的错误重抛给调用方，也可能只报告 —— 两种形态都接受
    } finally {
      errSpy.mockRestore();
    }

    expect(getConnectionsCount(raw)).toBe(0);

    act(() => {
      store.count = 1;
    });
    expect(getConnectionsCount(raw)).toBe(0);
  });

  it('箭头字段 cWU 抛错时 reaction 仍被释放（订阅不泄漏）', () => {
    const store = observable({ count: 0 });
    const raw = (proxyToRaw.get(store) as object) ?? store;

    class ClassComp extends React.Component {
      // 箭头字段：遮蔽包装器原型上的 componentWillUnmount，
      // 由构造期的字段重绑定组合用户逻辑与包装器清理
      componentWillUnmount = () => {
        throw new Error('user-cwu-exploded');
      };

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    const { unmount } = render(<ReactiveClass />);
    expect(getConnectionsCount(raw)).toBe(1);

    // React 会报告 cWU 抛出的错误（控制台噪音，与断言无关）
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      unmount();
    } catch {
      // React 可能把 cWU 的错误重抛给调用方，也可能只报告 —— 两种形态都接受
    } finally {
      errSpy.mockRestore();
    }

    // 用户字段抛错不得跳过包装器的 reaction 清理
    expect(getConnectionsCount(raw)).toBe(0);

    // 死实例不再收到调度
    act(() => {
      store.count = 1;
    });
    expect(getConnectionsCount(raw)).toBe(0);
  });
});
