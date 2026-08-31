/**
 * bindServices 卸载销毁测试
 *
 * README 承诺「卸载时销毁」容器。实现依赖 FinalizationRegistry 兜底
 * （时序不确定，空闲页面可能长期不触发），unmount 后 destroy 不会
 * 同步发生（#218）。
 */
import { act, render, screen } from '@testing-library/react';
import React, { Activity, useState } from 'react';
import { Service } from '@rabjs/service';
import { bindServices } from '../domain/bind';
import { useService } from '../domain/use-service';
import { RSRoot } from '../domain/root-context';
import { RSStrict } from '../domain/strict-context';

/** destroy 在 effect cleanup 里以 microtask 调度，以兼容 StrictMode 假卸载 */
async function flushUnmountDestroy() {
  await Promise.resolve();
}

describe('bindServices 卸载销毁（#218）', () => {
  it('unmount 后容器被显式销毁（不依赖 GC）', async () => {
    const destroyOrder: string[] = [];

    class LeafService extends Service {
      destroy() {
        destroyOrder.push('leaf');
        super.destroy();
      }
    }

    // 容器只销毁已实例化的服务：组件内解析触发实例化
    const Inner = () => {
      const svc = useService(LeafService);
      return <span>{svc ? 'ok' : 'no'}</span>;
    };
    const Comp = bindServices(Inner, [LeafService]);
    const { unmount } = render(<Comp />);

    // 挂载时容器创建，服务已实例化但未销毁
    expect(destroyOrder).toEqual([]);

    unmount();
    await flushUnmountDestroy();

    // unmount 后应销毁容器（不依赖 GC）
    expect(destroyOrder).toEqual(['leaf']);
  });

  it('未解析的服务不会被实例化或 destroy', async () => {
    let constructed = 0;
    let destroyed = 0;
    class LazyService extends Service {
      constructor(...args: any[]) {
        super(...(args as []));
        constructed++;
      }
      destroy() {
        destroyed++;
        super.destroy();
      }
    }

    const Comp = bindServices(() => <span>hi</span>, [LazyService]);
    const { unmount } = render(<Comp />);
    expect(constructed).toBe(0);
    unmount();
    await flushUnmountDestroy();
    expect(constructed).toBe(0);
    expect(destroyed).toBe(0);
  });

  it('嵌套 bindServices 先销毁子容器再销毁父容器', async () => {
    const order: string[] = [];
    class ParentService extends Service {
      destroy() {
        order.push('parent');
        super.destroy();
      }
    }
    class ChildService extends Service {
      destroy() {
        order.push('child');
        super.destroy();
      }
    }
    const ChildInner = () => {
      useService(ChildService);
      return <span>c</span>;
    };
    const Child = bindServices(ChildInner, [ChildService]);
    const ParentInner = () => {
      useService(ParentService);
      return <Child />;
    };
    const Parent = bindServices(ParentInner, [ParentService]);
    const { unmount } = render(<Parent />);
    unmount();
    await flushUnmountDestroy();
    expect(order).toEqual(['child', 'parent']);
  });

  it('重复挂载/卸载各自销毁，新实例可用', async () => {
    const events: string[] = [];
    class CountingService extends Service {
      constructor(...args: any[]) {
        super(...(args as []));
        events.push('ctor');
      }
      destroy() {
        events.push('destroy');
        super.destroy();
      }
    }

    const Inner = () => {
      const svc = useService(CountingService);
      return <span data-testid="ok">{svc ? 'ok' : 'no'}</span>;
    };
    const Bound = bindServices(Inner, [CountingService]);
    function Host() {
      const [show, setShow] = useState(true);
      return (
        <div>
          <button data-testid="toggle" onClick={() => setShow(s => !s)}>
            t
          </button>
          {show ? <Bound /> : null}
        </div>
      );
    }

    render(<Host />);
    expect(screen.getByTestId('ok')).toHaveTextContent('ok');
    expect(events).toEqual(['ctor']);

    act(() => {
      screen.getByTestId('toggle').click();
    });
    await flushUnmountDestroy();
    expect(events).toEqual(['ctor', 'destroy']);

    act(() => {
      screen.getByTestId('toggle').click();
    });
    expect(screen.getByTestId('ok')).toHaveTextContent('ok');
    expect(events).toEqual(['ctor', 'destroy', 'ctor']);
  });

  it('React.StrictMode 挂载后服务仍可用', async () => {
    class ProbeService extends Service {
      tag = 'alive';
    }
    const Inner = () => {
      const svc = useService(ProbeService);
      return <span data-testid="tag">{svc.tag}</span>;
    };
    const Comp = bindServices(Inner, [ProbeService]);
    const { unmount } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    );
    expect(screen.getByTestId('tag')).toHaveTextContent('alive');
    unmount();
    await flushUnmountDestroy();
  });

  it('React.StrictMode 真正卸载后所有已实例化服务都被 destroy', async () => {
    let constructed = 0;
    let destroyed = 0;
    class ProbeService extends Service {
      tag = 'alive';
      constructor(...args: any[]) {
        super(...(args as []));
        constructed++;
      }
      destroy() {
        destroyed++;
        super.destroy();
      }
    }
    const Inner = () => {
      const svc = useService(ProbeService);
      return <span data-testid="tag">{svc.tag}</span>;
    };
    const Comp = bindServices(Inner, [ProbeService]);
    const { unmount } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    );
    expect(screen.getByTestId('tag')).toHaveTextContent('alive');
    expect(constructed).toBeGreaterThan(0);
    // StrictMode 假卸载的 microtask 不得拆掉还在用的容器
    await flushUnmountDestroy();
    expect(screen.getByTestId('tag')).toHaveTextContent('alive');
    expect(destroyed).toBe(0);
    unmount();
    await flushUnmountDestroy();
    expect(destroyed).toBe(constructed);
  });

  it('<Activity> 隐藏→显示（跨 commit）后容器被销毁并在 render 时重建，服务可解析', async () => {
    const events: string[] = [];
    class ProbeService extends Service {
      tag = 'alive';
      constructor(...args: any[]) {
        super(...(args as []));
        events.push('ctor');
      }
      destroy() {
        events.push('destroy');
        super.destroy();
      }
    }
    const Inner = () => {
      const svc = useService(ProbeService);
      return <span data-testid="tag">{svc.tag}</span>;
    };
    const Bound = bindServices(Inner, [ProbeService]);

    // committed + microtask 的销毁只能取消 StrictMode 同帧重挂载；
    // <Activity> 隐藏→显示是两次独立 commit，microtask 在中间已执行销毁。
    // 修复前：reveal 时 useRef 保留的 adm 让 createADM 不再执行，
    // DomainContext 提供 null 容器，子组件解析服务直接抛错。
    // （React 19 中 Suspense 重新隐藏不拆除 useEffect，不触发该路径；
    // Activity 的隐藏会销毁 effect，是本测试覆盖的场景。）
    let setMode: (m: 'hidden' | 'visible') => void = () => {};
    function Host() {
      const [mode, setM] = useState<'hidden' | 'visible'>('visible');
      setMode = setM;
      return (
        <Activity mode={mode}>
          <Bound />
        </Activity>
      );
    }

    const { unmount } = render(<Host />);
    expect(screen.getByTestId('tag')).toHaveTextContent('alive');
    expect(events).toEqual(['ctor']);

    // 隐藏：effect cleanup → microtask 销毁容器
    await act(async () => {
      setMode('hidden');
    });
    await act(async () => {
      await flushUnmountDestroy();
    });
    expect(events).toEqual(['ctor', 'destroy']);

    // 显示：render 路径重建容器，子树拿到可用容器
    await act(async () => {
      setMode('visible');
    });
    expect(screen.getByTestId('tag')).toHaveTextContent('alive');
    expect(events).toEqual(['ctor', 'destroy', 'ctor']);

    // 重建后的容器在真正卸载时仍会被销毁
    unmount();
    await flushUnmountDestroy();
    expect(events).toEqual(['ctor', 'destroy', 'ctor', 'destroy']);
  });

  it('无 queueMicrotask 的环境（旧 RN JSC/Hermes）也能完成延迟销毁', async () => {
    const events: string[] = [];
    class ProbeService extends Service {
      destroy() {
        events.push('destroy');
        super.destroy();
      }
    }
    const Inner = () => {
      useService(ProbeService);
      return <span>ok</span>;
    };
    const Comp = bindServices(Inner, [ProbeService]);
    const { unmount } = render(<Comp />);

    // 包内 FinalizationRegistry/WeakRef 均为旧 RN 环境做了降级，
    // queueMicrotask 同样需要：缺失时 cleanup 直接抛 ReferenceError，
    // 容器永不销毁
    const original = (globalThis as any).queueMicrotask;
    (globalThis as any).queueMicrotask = undefined;
    try {
      unmount();
      await flushUnmountDestroy();
      expect(events).toEqual(['destroy']);
    } finally {
      (globalThis as any).queueMicrotask = original;
    }
  });

  it('React.StrictMode + RSRoot/RSStrict 下 bindServices 可挂载并在卸载时销毁', async () => {
    let constructed = 0;
    let destroyed = 0;
    class PageService extends Service {
      tag = 'page';
      constructor(...args: any[]) {
        super(...(args as []));
        constructed++;
      }
      destroy() {
        destroyed++;
        super.destroy();
      }
    }
    const PageInner = () => {
      const svc = useService(PageService);
      return <span data-testid="tag">{svc.tag}</span>;
    };
    const Page = bindServices(PageInner, [PageService]);
    const { unmount } = render(
      <React.StrictMode>
        <RSRoot>
          <RSStrict>
            <Page />
          </RSStrict>
        </RSRoot>
      </React.StrictMode>
    );
    expect(screen.getByTestId('tag')).toHaveTextContent('page');
    unmount();
    await flushUnmountDestroy();
    expect(destroyed).toBe(constructed);
    expect(destroyed).toBeGreaterThan(0);
  });
});
