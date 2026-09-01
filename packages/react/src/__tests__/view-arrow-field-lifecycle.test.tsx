/**
 * view 类组件：用户以箭头函数字段形式声明生命周期的测试
 *
 * 背景：ReactiveClassComponent 把 componentDidMount/componentWillUnmount
 * 定义在包装类原型上并通过 super.* 转发。若用户类用类字段声明
 * `componentDidMount = () => {...}`，该字段是实例自身属性，查找时优先于
 * 包装器原型方法——React 只会调用实例字段，包装器的 reaction 复活/清理
 * 逻辑被完全跳过：
 * - cDM 字段遮蔽：StrictMode 模拟卸载、Suspense 隐藏→显示这类「重放
 *   cDM 但不重跑 render」的路径上，被杀死的 reaction 无人复活，组件
 *   静默失去响应式；
 * - cWU 字段遮蔽：卸载时 reaction 不被 unobserve，泄漏的 reaction 继续
 *   对已卸载实例 forceUpdate。
 */
import React, { act, Suspense, useState } from 'react';
import { render, screen } from '@testing-library/react';
import { observable } from '@rabjs/observer';
import { enableStaticRendering } from '../static-rendering';
import { view } from '../view';

const NEVER = new Promise<void>(() => {});

describe('view 类组件：箭头函数生命周期字段不得遮蔽包装器逻辑', () => {
  it('箭头函数字段 componentDidMount：StrictMode 模拟重挂载后仍响应 observable 变化', () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      // 用户自己的 cDM，以箭头函数字段声明（常见 TS 写法）
      componentDidMount = () => {};

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

    // StrictMode 模拟卸载已杀死 reaction；cDM 重放时若包装器复活逻辑被
    // 字段遮蔽，此处断言会停留在 '0'
    act(() => {
      store.count = 1;
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('箭头函数字段 componentDidMount：Suspense 隐藏→显示后仍响应', async () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      componentDidMount = () => {};

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

    await act(async () => {
      toggle(true);
    });
    expect(screen.getByTestId('fb')).toBeInTheDocument();

    await act(async () => {
      toggle(false);
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    act(() => {
      store.count = 1;
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('箭头函数字段 componentDidMount：用户回调仍被调用，且先于复活逻辑', () => {
    const store = observable({ count: 0 });
    const calls: string[] = [];

    class ClassComp extends React.Component {
      componentDidMount = () => {
        calls.push('user');
      };

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    render(<ReactiveClass />);
    // 用户字段必须仍然执行（包装是增强而非吞掉）
    expect(calls).toContain('user');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('箭头函数字段 componentWillUnmount：卸载时 reaction 仍被清理', () => {
    const store = observable({ count: 0 });
    let instance: any = null;

    class ClassComp extends React.Component {
      componentWillUnmount = () => {};

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    const { unmount } = render(
      <ReactiveClass
        ref={(r: any) => {
          if (r) instance = r;
        }}
      />
    );
    expect(instance._reactiveRender).not.toBeNull();

    unmount();
    // cWU 字段遮蔽若生效，包装器清理被跳过，_reactiveRender 仍存活
    expect(instance._reactiveRender).toBeNull();
  });

  it('箭头函数字段 componentWillUnmount：卸载后变更不再对已卸载实例 forceUpdate', () => {
    const store = observable({ count: 0 });
    let instance: any = null;

    class ClassComp extends React.Component {
      componentWillUnmount = () => {};

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    const { unmount } = render(
      <ReactiveClass
        ref={(r: any) => {
          if (r) instance = r;
        }}
      />
    );
    const forceUpdateSpy = jest.spyOn(instance, 'forceUpdate');
    unmount();

    act(() => {
      store.count = 1;
    });
    expect(forceUpdateSpy).not.toHaveBeenCalled();
  });

  it('原型方法声明的 componentDidMount/componentWillUnmount：行为不受影响（回归控制）', () => {
    const store = observable({ count: 0 });
    const calls: string[] = [];
    let instance: any = null;

    class ClassComp extends React.Component {
      componentDidMount() {
        calls.push('user-did-mount');
      }

      componentWillUnmount() {
        calls.push('user-will-unmount');
      }

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    const { unmount } = render(
      <React.StrictMode>
        <ReactiveClass
          ref={(r: any) => {
            if (r) instance = r;
          }}
        />
      </React.StrictMode>
    );
    expect(calls).toContain('user-did-mount');

    act(() => {
      store.count = 1;
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    unmount();
    expect(calls).toContain('user-will-unmount');
    expect(instance._reactiveRender).toBeNull();
  });

  it('构造期 static rendering 开启 + 箭头字段 cDM：flag 关闭后仍恢复响应（#254）', () => {
    const store = observable({ count: 0 });
    let instance: any = null;

    class ClassComp extends React.Component {
      componentDidMount = () => {};

      render() {
        return <span data-testid="count">{store.count}</span>;
      }
    }
    const ReactiveClass = view(ClassComp);

    // 构造+挂载期间 flag 开启（如同进程内 SSR 后未关、或测试环境遗留）：
    // 构造期的早退若跳过字段重绑定，箭头字段 cDM 会永久遮蔽 _onDidMount，
    // _committed 永远为 false，组件从此失去响应式。
    enableStaticRendering(true);
    try {
      render(
        <ReactiveClass
          ref={(r: any) => {
            if (r) instance = r;
          }}
        />
      );
    } finally {
      enableStaticRendering(false);
    }

    // flag 关闭时尚未建立任何依赖（flag 开启期间 render 是裸执行的），
    // 需一次渲染开启追踪 —— 与函数组件 observer 路径行为对齐。
    // 注意不能用 rerender 同 props：SCU 浅比较会 bail out，render 不会执行。
    act(() => {
      instance.forceUpdate();
    });
    act(() => {
      store.count = 1;
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
