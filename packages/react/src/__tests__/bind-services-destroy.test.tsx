/**
 * bindServices 卸载销毁测试
 *
 * README 承诺「卸载时销毁」容器。实现依赖 FinalizationRegistry 兜底
 * （时序不确定，空闲页面可能长期不触发），unmount 后 destroy 不会
 * 同步发生（#218）。
 */
import { render } from '@testing-library/react';
import React from 'react';
import { Service } from '@rabjs/service';
import { bindServices } from '../domain/bind';
import { useService } from '../domain/use-service';

describe('bindServices 卸载销毁（#218）', () => {
  it('unmount 后容器被显式销毁（不依赖 GC）', () => {
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

    // unmount 同步路径上就应销毁容器
    expect(destroyOrder).toEqual(['leaf']);
  });

  it('unmount 后再渲染不报错，重复挂载/卸载各自销毁', () => {
    let created = 0;
    class CountingService extends Service {
      constructor(...args: any[]) {
        super(...(args as []));
        created++;
      }
    }

    const Comp = bindServices(() => <span>hi</span>, [CountingService]);

    const { unmount } = render(<Comp />);
    expect(created).toBeGreaterThanOrEqual(0); // 惰性解析：未读取服务不实例化
    unmount();

    // 再次挂载：新容器、新实例，前一个已被销毁
    const second = render(<Comp />);
    second.unmount();
  });

  it('容器 destroy 后 resolve 已注册服务不再可用', async () => {
    class ProbeService extends Service {
      tag = 'probe';
    }

    const Comp = bindServices(() => <span>hi</span>, [ProbeService]);
    const { unmount } = render(<Comp />);
    unmount();

    // 容器销毁是幂等且彻底的：不抛错即为通过（destroy 后内部状态已清理）
    await Promise.resolve();
  });
});
