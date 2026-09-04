/**
 * react 侧内存浸泡测试
 *
 * 确定性断言（不等 GC）：组件 mount/unmount 循环后，store / service
 * 上的订阅连接必须回到基线。残留连接 = 死组件的 reaction 仍会被
 * 后续写入唤醒（僵尸 forceUpdate），并钉住组件闭包 —— 这是本分支
 * 修复的 view-aborted-render-leak 一族问题的常驻回归网。
 */
import React from 'react';
import { render } from '@testing-library/react';
import { observable, raw } from '@rabjs/observer';
import { Service, Memo } from '@rabjs/service';
import { getConnectionsCount } from '../../../observer/src/internals/reaction-track';
import { view } from '../view';
import { observer } from '../observer';
import { bindServices } from '../domain/bind';
import { useService } from '../domain';

/** 手动应用 @Memo（本包 tsconfig 未开 experimentalDecorators） */
function memoize(proto: object, key: string): void {
  const desc = Object.getOwnPropertyDescriptor(proto, key)!;
  Object.defineProperty(proto, key, Memo()(proto, key, desc)!);
}

describe('内存浸泡：组件订阅归还', () => {
  it('view 类组件 mount/unmount 循环不积累连接', () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      render() {
        return <span>{store.count}</span>;
      }
    }
    const Reactive = view(ClassComp);

    const baseline = getConnectionsCount(raw(store));
    for (let i = 0; i < 30; i++) {
      const { unmount } = render(<Reactive />);
      unmount();
    }
    expect(getConnectionsCount(raw(store))).toBe(baseline);
  });

  it('observer 函数组件 mount/unmount 循环不积累连接', () => {
    const store = observable({ count: 0 });

    const FuncComp = observer(() => <span>{store.count}</span>);

    const baseline = getConnectionsCount(raw(store));
    for (let i = 0; i < 30; i++) {
      const { unmount } = render(<FuncComp />);
      unmount();
    }
    expect(getConnectionsCount(raw(store))).toBe(baseline);
  });

  it('StrictMode 下 view 组件循环挂载（双 effect + 模拟重挂载）不积累连接', () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      render() {
        return <span>{store.count}</span>;
      }
    }
    const Reactive = view(ClassComp);

    const baseline = getConnectionsCount(raw(store));
    for (let i = 0; i < 20; i++) {
      const { unmount } = render(
        <React.StrictMode>
          <Reactive />
        </React.StrictMode>
      );
      unmount();
    }
    expect(getConnectionsCount(raw(store))).toBe(baseline);
  });

  it('cDM 写 store 的组件（快照 + forceUpdate 路径）循环后不积累连接', () => {
    const store = observable({ count: 0 });

    class ClassComp extends React.Component {
      componentDidMount() {
        store.count++;
      }

      render() {
        return <span>{store.count}</span>;
      }
    }
    const Reactive = view(ClassComp);

    const baseline = getConnectionsCount(raw(store));
    for (let i = 0; i < 20; i++) {
      const { unmount } = render(<Reactive />);
      unmount();
    }
    expect(getConnectionsCount(raw(store))).toBe(baseline);
  });

  it('bindServices + @Memo 服务：卸载销毁后 service 上的订阅清零', async () => {
    class CounterService extends Service {
      count = 1;

      get doubled() {
        return this.count * 2;
      }
    }
    memoize(CounterService.prototype, 'doubled');

    const instances: CounterService[] = [];
    const Inner = () => {
      const svc = useService(CounterService);
      instances.push(svc);
      return <span>{svc.doubled}</span>;
    };
    const Bound = bindServices(Inner, [CounterService]);

    for (let i = 0; i < 10; i++) {
      const { unmount } = render(<Bound />);
      unmount();
      // 卸载销毁是 microtask 延迟的（StrictMode 取消窗口），冲刷后再断言
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }

    expect(instances.length).toBeGreaterThanOrEqual(10);
    for (const svc of instances) {
      // destroy 路径：cleanupAllMemos 必须 unobserve memo reaction ——
      // 残留意味着已销毁 service 的字段仍被订阅，后续写入唤醒死缓存
      expect(getConnectionsCount(raw(svc) as object)).toBe(0);
    }
  });
});
