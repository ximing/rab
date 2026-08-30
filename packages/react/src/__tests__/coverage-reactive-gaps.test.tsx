/**
 * 响应式 React API 未覆盖分支：用行为断言补洞。
 * 失败 = 真实契约缺口。
 */
import React, { Component } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { observable } from '@rabjs/observer';
import { Service, ServiceScope } from '@rabjs/service';
import { observer } from '../observer';
import { view } from '../view';
import { useObserver } from '../use-observer';
import { useReaction } from '../use-reaction';
import { enableStaticRendering } from '../static-rendering';
import { bindServices } from '../domain/bind';
import { useService, useContainer } from '../domain/use-service';
import { useObserverService } from '../domain/use-observer-service';
import { RSStrict } from '../domain/strict-context';
import { RSRoot } from '../domain/root-context';
import { RSROOT } from '../domain/constant';
import { debuggerReaction } from '../utils/debug';
import type { Operation } from '@rabjs/observer';

afterEach(() => {
  enableStaticRendering(false);
});

describe('domain 常量', () => {
  it('RSROOT 是全局 symbol', () => {
    expect(RSROOT).toBe(Symbol.for('rsRoot'));
  });
});

describe('observer / useObserver + enableStaticRendering', () => {
  it('enableStaticRendering 之后再 observer()：返回原组件，store 变化不调度 setState', () => {
    const store = observable({ count: 0 });
    let renders = 0;
    enableStaticRendering(true);
    const Comp = observer(() => {
      renders++;
      return <span data-testid="n">{store.count}</span>;
    });
    const html = renderToString(<Comp />);
    expect(html).toContain('0');
    const afterRender = renders;
    store.count++;
    expect(renders).toBe(afterRender);
  });

  it('先 observer() 再 enableStaticRendering：renderToString 期间读 store 不泄漏 reaction', () => {
    const store = observable({ count: 0 });
    let renders = 0;
    const Comp = observer(() => {
      renders++;
      return <span>{store.count}</span>;
    });
    enableStaticRendering(true);
    const html = renderToString(<Comp />);
    expect(html).toContain('0');
    const afterRender = renders;
    store.count++;
    expect(renders).toBe(afterRender);
  });

  it('useObserver 在静态渲染下直接执行 render 函数，不订阅后续写入', () => {
    const store = observable({ count: 0 });
    let renders = 0;
    enableStaticRendering(true);
    const Comp = () => {
      return useObserver(() => {
        renders++;
        return <span>{store.count}</span>;
      });
    };
    renderToString(<Comp />);
    const afterRender = renders;
    store.count++;
    expect(renders).toBe(afterRender);
  });
});

describe('useObserverService', () => {
  class CounterService extends Service {
    count = 0;
    increment() {
      this.count++;
    }
  }

  it('selector 读到的字段变化后组件重渲染，并返回同一 service 实例', async () => {
    const Comp = bindServices(() => {
      const [count, svc] = useObserverService(CounterService, s => s.count);
      return (
        <div>
          <span data-testid="count">{count}</span>
          <button onClick={() => svc.increment()}>inc</button>
        </div>
      );
    }, [CounterService]);

    render(<Comp />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    fireEvent.click(screen.getByText('inc'));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
  });
});

describe('useService / useContainer 未覆盖分支', () => {
  class NamedService extends Service {
    label = 'named';
  }

  it('非严格模式、无 Provider 时自动落到全局容器并解析服务', () => {
    const Comp = () => {
      const svc = useService(NamedService);
      return <span data-testid="label">{svc.label}</span>;
    };
    render(<Comp />);
    expect(screen.getByTestId('label')).toHaveTextContent('named');
  });

  it('RSStrict 下无 bindServices 调用 useService 抛错', () => {
    const Comp = () => {
      useService(NamedService);
      return <span>x</span>;
    };
    expect(() =>
      render(
        <RSStrict>
          <Comp />
        </RSStrict>
      )
    ).toThrow(/useService must be called within a bindServices/);
  });

  it('Transient scope 同一组件多次 render 复用同一实例', () => {
    const seen: NamedService[] = [];
    const Comp = bindServices(() => {
      const svc = useService(NamedService, { scope: ServiceScope.Transient });
      seen.push(svc);
      return <span data-testid="label">{svc.label}</span>;
    }, [NamedService]);
    const { rerender } = render(<Comp />);
    rerender(<Comp />);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[0]).toBe(seen[1]);
  });

  it('useContainer 返回当前 bindServices 的容器', () => {
    const Comp = bindServices(() => {
      const container = useContainer();
      return <span data-testid="name">{String(container.getName())}</span>;
    }, []);
    render(<Comp />);
    expect(screen.getByTestId('name').textContent).not.toBe('');
  });

  it('RSStrict 下 bindServices 不在 RSRoot 内抛 Strict mode must in Root Provider', () => {
    const Inner = bindServices(() => <span>inner</span>, []);
    expect(() =>
      render(
        <RSStrict>
          <Inner />
        </RSStrict>
      )
    ).toThrow(/Strict mode must in Root Provider/);
  });

  it('RSRoot + RSStrict 下 bindServices 正常渲染', () => {
    const Inner = bindServices(() => <span data-testid="ok">ok</span>, []);
    render(
      <RSRoot>
        <RSStrict>
          <Inner />
        </RSStrict>
      </RSRoot>
    );
    expect(screen.getByTestId('ok')).toHaveTextContent('ok');
  });
});

describe('view 类组件 shouldComponentUpdate', () => {
  it('props 键数量变化时重渲染', () => {
    const store = observable({ n: 0 });
    class Box extends Component<{ a?: number; b?: number }> {
      render() {
        return (
          <span data-testid="box">
            {store.n}:{this.props.a ?? '-'}:{this.props.b ?? '-'}
          </span>
        );
      }
    }
    const ViewBox = view(Box);
    const { rerender } = render(<ViewBox a={1} />);
    expect(screen.getByTestId('box')).toHaveTextContent('0:1:-');
    rerender(<ViewBox a={1} b={2} />);
    expect(screen.getByTestId('box')).toHaveTextContent('0:1:2');
  });

  // #198：响应式刷新必须到达 render。用户 SCU 只应拦截 props / 自身 state 更新。
  it('用户 shouldComponentUpdate 返回 false 不会吞掉 observable 触发的更新（#198）', () => {
    const store = observable({ n: 0 });
    class Frozen extends Component {
      shouldComponentUpdate() {
        return false;
      }
      render() {
        return <span data-testid="n">{store.n}</span>;
      }
    }
    const ViewFrozen = view(Frozen);
    render(<ViewFrozen />);
    expect(screen.getByTestId('n')).toHaveTextContent('0');
    act(() => {
      store.n = 1;
    });
    expect(screen.getByTestId('n')).toHaveTextContent('1');
  });

  it('用户 shouldComponentUpdate 返回 false 仍拦截 props 触发的更新（#198）', () => {
    const store = observable({ n: 0 });
    class Frozen extends Component<{ a: number }> {
      shouldComponentUpdate() {
        return false;
      }
      render() {
        return (
          <span data-testid="n">
            {store.n}:{this.props.a}
          </span>
        );
      }
    }
    const ViewFrozen = view(Frozen);
    const { rerender } = render(<ViewFrozen a={1} />);
    expect(screen.getByTestId('n')).toHaveTextContent('0:1');
    rerender(<ViewFrozen a={2} />);
    expect(screen.getByTestId('n')).toHaveTextContent('0:1');
    // observable 更新仍要到达 render；SCU 拦下的那次 render 被跳过，
    // 但 React 仍更新了实例的 this.props，forceUpdate 后显示新 props
    act(() => {
      store.n = 1;
    });
    expect(screen.getByTestId('n')).toHaveTextContent('1:2');
  });
});

describe('observer 旧版 contextTypes', () => {
  it('wrap 前设置的 contextTypes 会拷到内部 render，wrap 后再赋值会抛错', () => {
    function Base() {
      return <span>ctx</span>;
    }
    (Base as any).contextTypes = { foo: () => null };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const Observed = observer(Base as any);
    expect((Observed as any).contextTypes).toBeUndefined();
    expect(() => {
      (Observed as any).contextTypes = {};
    }).toThrow(/必须在应用 `observer` 之前设置/);
    warn.mockRestore();
  });
});

describe('debuggerReaction', () => {
  it('忽略 get/has/iterate/key-iterate，对其它 type 打日志', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    debuggerReaction({ target: {}, key: 'k', type: 'get' } as Operation);
    expect(log).not.toHaveBeenCalled();
    debuggerReaction({ target: {}, key: '', type: 'key-iterate' } as Operation);
    expect(log).not.toHaveBeenCalled();
    debuggerReaction({ target: {}, key: 'k', type: 'set', value: 1, oldValue: 0 } as Operation);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
