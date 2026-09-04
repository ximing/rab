/**
 * view 类组件：用户 componentDidMount 抛错时，包装器的挂载落点
 * （_onDidMount：开启依赖追踪）仍必须执行。
 *
 * 背景：master 在构造期就创建 reaction，用户 cDM 抛错不影响响应式；
 * 挂载快照改造把追踪开启推迟到 cDM，若用户 cDM（无论是原型方法经
 * super.* 转发，还是箭头字段经组合函数）抛错时跳过 _onDidMount，
 * 实例一旦幸存（error boundary 重试等）组件将永久静默失去响应式。
 * 与 cWU 侧的「用户方法抛错也必须释放 reaction」同一原则，方向相反。
 */
import React, { act } from 'react';
import { render } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { observable } from '@rabjs/observer';
import { getConnectionsCount } from '../../../observer/src/internals/reaction-track';
import { proxyToRaw } from '../../../observer/src/internals/proxy-raw-map';
import { view } from '../view';

function makeBoundary(caught: unknown[]) {
  return class Boundary extends React.Component<{}, { error: boolean }> {
    state = { error: false };

    static getDerivedStateFromError() {
      return { error: true };
    }

    componentDidCatch(error: unknown) {
      caught.push(error);
    }

    render() {
      return this.state.error ? <span data-testid="fallback">fallback</span> : this.props.children;
    }
  };
}

describe('view 类组件：用户 cDM 抛错不得跳过响应式挂载落点', () => {
  it('原型方法 cDM 抛错：_onDidMount 仍执行（reaction 首跑发生），卸载后订阅无残留', () => {
    const store = observable({ count: 0 });
    const raw = (proxyToRaw.get(store) as object) ?? store;
    const caught: unknown[] = [];
    let renderCount = 0;

    class ClassComp extends React.Component {
      componentDidMount() {
        throw new Error('cdm-boom');
      }

      render() {
        renderCount++;
        return <span>{store.count}</span>;
      }
    }
    const Boundary = makeBoundary(caught);
    const ReactiveClass = view(ClassComp);

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let utils: ReturnType<typeof render>;
    try {
      utils = render(
        <Boundary>
          <ReactiveClass />
        </Boundary>
      );
    } finally {
      errSpy.mockRestore();
    }

    // 错误仍按原语义传播给边界
    expect(caught.length).toBe(1);
    expect((caught[0] as Error).message).toBe('cdm-boom');
    // 探针首渲染 + _onDidMount 的 reaction 首跑 = 2 次；
    // _onDidMount 被跳过则只剩探针的 1 次（响应式从未开启）
    expect(renderCount).toBe(2);
    // 边界接管后卸载：cWU 释放已创建的 reaction，订阅无残留
    expect(getConnectionsCount(raw)).toBe(0);
    expect(utils!.getByTestId('fallback')).toBeTruthy();
  });

  it('箭头字段 cDM 抛错：组合函数经 finally 仍执行 _onDidMount', () => {
    const store = observable({ count: 0 });
    const raw = (proxyToRaw.get(store) as object) ?? store;
    const caught: unknown[] = [];
    let renderCount = 0;

    class ClassComp extends React.Component {
      componentDidMount = () => {
        throw new Error('cdm-boom');
      };

      render() {
        renderCount++;
        return <span>{store.count}</span>;
      }
    }
    const Boundary = makeBoundary(caught);
    const ReactiveClass = view(ClassComp);

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <Boundary>
          <ReactiveClass />
        </Boundary>
      );
    } finally {
      errSpy.mockRestore();
    }

    expect(caught.length).toBe(1);
    expect((caught[0] as Error).message).toBe('cdm-boom');
    expect(renderCount).toBe(2);
    expect(getConnectionsCount(raw)).toBe(0);
  });
});

describe('view 类组件：cDM 在途错误不得被挂载落点的次生错误掩盖', () => {
  it('用户 cDM 抛错后 _onDidMount 的 render 重跑也抛错：边界必须看到用户的原始错误', () => {
    const store = observable({ count: 0 });
    const caught: unknown[] = [];
    let renderCount = 0;

    class ClassComp extends React.Component {
      componentDidMount() {
        throw new Error('cdm-fail');
      }

      render() {
        renderCount++;
        if (renderCount === 2) {
          // _onDidMount 的 reaction 首跑重新执行 render —— 这里抛出的次生
          // 错误不得通过 finally 语义替换掉在途的 'cdm-fail'
          throw new Error('render-boom');
        }
        return <span>{store.count}</span>;
      }
    }
    const Boundary = makeBoundary(caught);
    const ReactiveClass = view(ClassComp);

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <Boundary>
          <ReactiveClass />
        </Boundary>
      );
    } finally {
      errSpy.mockRestore();
    }

    expect(caught.length).toBe(1);
    expect((caught[0] as Error).message).toBe('cdm-fail');
  });

  it('箭头字段 cDM 抛错 + render 重跑抛错：同样保留用户原始错误', () => {
    const store = observable({ count: 0 });
    const caught: unknown[] = [];
    let renderCount = 0;

    class ClassComp extends React.Component {
      componentDidMount = () => {
        throw new Error('cdm-field-fail');
      };

      render() {
        renderCount++;
        if (renderCount === 2) {
          throw new Error('render-boom');
        }
        return <span>{store.count}</span>;
      }
    }
    const Boundary = makeBoundary(caught);
    const ReactiveClass = view(ClassComp);

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <Boundary>
          <ReactiveClass />
        </Boundary>
      );
    } finally {
      errSpy.mockRestore();
    }

    expect(caught.length).toBe(1);
    expect((caught[0] as Error).message).toBe('cdm-field-fail');
  });
});

describe('view 类组件：cDM 内 freeze 实例的降级必须可观测', () => {
  it('componentDidMount 里 Object.freeze(this)：降级失去响应式时必须 dev 警告', () => {
    const store = observable({ count: 0 });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    class ClassComp extends React.Component {
      componentDidMount() {
        Object.freeze(this);
      }

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    // 不用 testing-library 的 render：其 afterEach 会自动 unmount，而 React
    // 自身对 frozen 实例的 cWU（`this.props = ...` 只读赋值）会抛 TypeError
    // —— 那是 React 对 freeze 实例的固有限制，不属于本测试要验证的包装器
    // 行为。手动 createRoot + 永不 unmount，container detach 即可。
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      act(() => {
        root.render(<ReactiveClass />);
      });
      expect(container.textContent).toBe('0');
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('componentDidMount 里 Object.freeze(this)：挂载快照内容必须被释放', () => {
    // 冻结降级路径在「消费挂载快照」之前 return：字段写不进去（frozen），
    // 快照数组若不就地清空，首渲染读到的每个 observable target/value 会被
    // 实例字段钉住，直到实例被 GC。
    const store = observable({ count: 0 });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const ref = React.createRef<any>();

    class ClassComp extends React.Component {
      componentDidMount() {
        Object.freeze(this);
      }

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      act(() => {
        // view 的重载类型不含 ref 转发声明（该测试文件的既有风格：直接 as any）
        root.render(React.createElement(ReactiveClass as any, { ref }));
      });
      expect(container.textContent).toBe('0');
      const snapshot = (ref.current as any)._mountSnapshot;
      expect(snapshot === null || snapshot.length === 0).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
