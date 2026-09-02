/**
 * view 挂载快照的加固回归（review follow-ups）
 *
 * 1. 探针 recordRead 必须声明 reentrantSafe：某个 reaction 的 debugger
 *    执行期间（isDebugging 重入窗口）同步完成的首挂载，其读取记录会被
 *    重入保护静默丢弃 —— 快照为空，commit 窗口的变更检测被架空。
 * 2. 集合类型判定必须跨 realm 安全（isRewritableMap/isRewritableSet，
 *    issue #92 场景）：裸 instanceof 对 vm/iframe 的 Map/Set 为 false，
 *    快照退化成 Reflect.ownKeys（对 Map 恒为 []），变更永远判不出差异。
 */
import vm from 'node:vm';

import React from 'react';
import { render } from '@testing-library/react';
import { observable, observe } from '@rabjs/observer';
import { view } from '../view';

describe('view 挂载快照：isDebugging 重入窗口内的首挂载', () => {
  it('用户 debugger 执行期间同步挂载的组件，commit 窗口变更仍可检出', () => {
    const store = observable({ count: 0 });
    const trigger = observable({ go: 0 });

    class ClassComp extends React.Component {
      componentDidMount() {
        store.count = 42;
      }

      render() {
        return <span data-testid="v">{store.count}</span>;
      }
    }
    const Reactive = view(ClassComp);

    let rendered: ReturnType<typeof render> | undefined;
    // 未声明 reentrantSafe 的用户 debugger：它执行期间 isDebugging=true。
    // observe 首跑注册依赖时 debugger 同步触发 —— 在此窗口内完成一次
    // 完整的首挂载（render + commit）。
    observe(
      () => {
        void trigger.go;
      },
      {
        debugger: () => {
          if (!rendered) {
            rendered = render(<Reactive />);
          }
        },
      }
    );

    // 修复前：探针的读取记录被 isDebugging 重入保护丢弃，快照为空 →
    // _onDidMount 判「无变化」→ 收集渲染的输出被丢弃，DOM 停在首渲染的 0
    expect(rendered!.getByTestId('v').textContent).toBe('42');
  });
});

describe('view 挂载快照：跨 realm 集合（issue #92 场景）', () => {
  it('render 迭代跨 realm Map：commit 窗口内的 set 被检出，DOM 不停留在旧值', () => {
    // vm 另一 realm 的 Map：instanceof Map 为 false，但 observer 的 G7
    // 路由（tag + duck-check）仍会把它送进 instrumented collection trap
    const crossRealmMap = vm.runInNewContext('new Map([["a", 1]])') as Map<string, number>;
    const store = observable({ m: crossRealmMap });

    class ClassComp extends React.Component {
      componentDidMount() {
        store.m.set('b', 2);
      }

      render() {
        return <span data-testid="v">{[...store.m.values()].join(',')}</span>;
      }
    }
    const Reactive = view(ClassComp);
    const { getByTestId } = render(<Reactive />);

    // 修复前：快照用裸 instanceof 判型失败，iterate 退化 ownKeys(Map)=[]≡[]，
    // commit 窗口的 set('b', 2) 判不出差异，DOM 停在首渲染的 '1'
    expect(getByTestId('v').textContent).toBe('1,2');
  });

  it('render 迭代跨 realm Set：commit 窗口内的 add 被检出', () => {
    const crossRealmSet = vm.runInNewContext('new Set([1])') as Set<number>;
    const store = observable({ s: crossRealmSet });

    class ClassComp extends React.Component {
      componentDidMount() {
        store.s.add(2);
      }

      render() {
        return <span data-testid="v">{[...store.s.values()].join(',')}</span>;
      }
    }
    const Reactive = view(ClassComp);
    const { getByTestId } = render(<Reactive />);

    expect(getByTestId('v').textContent).toBe('1,2');
  });
});

describe('@rabjs/react umbrella：observer 新原语再导出', () => {
  it('untracked / isUntracked / getRunningReaction 可从 @rabjs/react 导入', async () => {
    const main = await import('../main');
    expect(typeof main.untracked).toBe('function');
    expect(typeof main.isUntracked).toBe('function');
    expect(typeof main.getRunningReaction).toBe('function');
  });

  it('经 umbrella 导入的 untracked 语义不变：窗口内读取不注册依赖', async () => {
    const { untracked, observe: observeFromMain } = await import('../main');
    const store = observable({ a: 1 });
    let runs = 0;
    observeFromMain(() => {
      runs++;
      untracked(() => {
        void store.a;
      });
    });
    store.a = 2;
    expect(runs).toBe(1);
  });
});
