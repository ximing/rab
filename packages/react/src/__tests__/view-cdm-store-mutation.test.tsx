/**
 * view 类组件：commit 阶段的 store 变更不得丢失
 *
 * 背景：commit 前不做依赖追踪（view-aborted-render-leak）让首次依赖收集
 * 推迟到 componentDidMount。但「首渲染结束 → 本组件 _onDidMount」之间存在
 * commit 窗口：自身 cDM（先执行用户 cDM）、子组件 cDM（子先于父挂载）都可能
 * 写入 render 依赖的 observable。此窗口内没有 reaction 订阅，写入被静默丢弃；
 * _onDidMount 的收集渲染读到新值却按「输出必然相同」假设丢弃输出 —— DOM
 * 永久停留在首渲染旧值，直到下一次无关变更才自愈。
 *
 * 修复：首渲染用一次性探针 reaction 记录读取快照（render 结束即 unobserve，
 * 注册生命周期不超出 render 调用，不重新引入泄漏）；_onDidMount 对比快照，
 * 有差才 forceUpdate（数据确实变了，cDU 触发是正当的），无差维持
 * 「同步收集、丢弃输出」，不产生伪 update。
 */
import React from 'react';
import { render } from '@testing-library/react';
import { observable } from '@rabjs/observer';
import { getConnectionsCount } from '../../../observer/src/internals/reaction-track';
import { proxyToRaw } from '../../../observer/src/internals/proxy-raw-map';
import { view } from '../view';

describe('view 类组件：commit 阶段的 store 变更', () => {
  it('自身 cDM 写入 render 依赖的 observable，DOM 反映新值', () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      componentDidMount() {
        // 挂载拉数并写入 store 是类组件的典型用法
        store.count = 1;
      }

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    const { getByTestId } = render(<ReactiveClass />);

    expect(getByTestId('count').textContent).toBe('1');
  });

  it('子组件 cDM 写入父组件 render 依赖的 observable，父 DOM 反映新值', () => {
    const store = observable({ count: 0 });

    class Child extends React.Component {
      componentDidMount() {
        store.count = 2;
      }

      render() {
        return null;
      }
    }

    class Parent extends React.Component {
      render() {
        return (
          <div>
            <span data-testid="count">{store.count}</span>
            <Child />
          </div>
        );
      }
    }

    const ReactiveParent = view(Parent);
    const { getByTestId } = render(<ReactiveParent />);

    expect(getByTestId('count').textContent).toBe('2');
  });

  it('窗口内 Map/Set/数组读取的变更同样被检测', () => {
    const store = observable({ list: [1, 2, 3] });

    class ClassComp extends React.Component {
      componentDidMount() {
        store.list.push(4);
      }

      render() {
        return <span data-testid="len">{store.list.length}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    const { getByTestId } = render(<ReactiveClass />);

    expect(getByTestId('len').textContent).toBe('4');
  });

  it('回归控制：窗口内无变更时不产生伪 update（cDU 不触发）', () => {
    const store = observable({ count: 0 });
    const calls: string[] = [];

    class ClassComp extends React.Component {
      componentDidUpdate() {
        calls.push('cDU');
      }

      render() {
        return <span>{store.count}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    render(<ReactiveClass />);

    expect(calls).not.toContain('cDU');
  });

  it('commit 窗口内 store 被改为 render 抛错的状态：错误按 render 语义抛出，reaction 不残留', () => {
    const store = observable({ count: 0 });
    const raw = (proxyToRaw.get(store) as object) ?? store;
    const caught: unknown[] = [];

    class ClassComp extends React.Component {
      componentDidMount() {
        store.count = 1;
      }

      render() {
        if (store.count === 1) {
          throw new Error('render-boom');
        }
        return <span>{store.count}</span>;
      }
    }

    class Boundary extends React.Component<{}, { error: boolean }> {
      state = { error: false };

      static getDerivedStateFromError() {
        return { error: true };
      }

      componentDidCatch(error: unknown) {
        caught.push(error);
      }

      render() {
        return this.state.error ? (
          <span data-testid="fallback">fallback</span>
        ) : (
          this.props.children
        );
      }
    }

    const ReactiveClass = view(ClassComp);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let getByTestId: any;
    try {
      ({ getByTestId } = render(
        <Boundary>
          <ReactiveClass />
        </Boundary>
      ));
    } finally {
      errSpy.mockRestore();
    }

    // 错误被边界捕获（而不是以「挂载即崩且无边界语义」的形态逸出）
    expect(caught.length).toBe(1);
    expect((caught[0] as Error).message).toBe('render-boom');
    expect(getByTestId('fallback')).toBeTruthy();
    // 首跑失败的 reaction 自动脱管，不向 store 残留订阅
    expect(getConnectionsCount(raw)).toBe(0);
  });
});
