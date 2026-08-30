/**
 * bindServices 卸载销毁测试
 *
 * README 承诺「卸载时销毁」容器。实现依赖 FinalizationRegistry 兜底
 * （时序不确定，空闲页面可能长期不触发），unmount 后 destroy 不会
 * 同步发生（#218）。
 */
import { act, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
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
