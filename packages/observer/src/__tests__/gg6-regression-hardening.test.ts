/**
 * GG6 回归镜头加固测试: #6 (rawToProxy 分桶) + #12 (空 entry 清理)
 * 与既有 hardening 测试互补, 锁定以下未被覆盖的回归边界:
 * - 跨模式 (shadow/deep) 的 add/delete 通知 ITERATION_KEY 依赖
 * - 数组 length 收缩后截断索引依赖的 entry 清理
 * - 同步自定义 scheduler 在批内重入时的依赖正确性
 * - 重复 unobserve 的幂等性
 */

import { observable } from '../observable';
import { shadowObservable } from '../shadow-observable';
import { observe, unobserve } from '../observer';
import { getConnectionsCount } from '../internals/reaction-track';
import type { Reaction } from '../internals/types';

describe('GG6 regression hardening', () => {
  test('shadow 代理上新增属性通知 deep 代理注册的迭代依赖 (共享连接表)', () => {
    const rawObj = { x: 1 };
    const s = shadowObservable(rawObj);
    const d = observable(rawObj);

    let iterations = 0;
    observe(() => {
      Object.keys(d);
      iterations++;
    });
    expect(iterations).toBe(1);

    // 通过 shadow 代理 add: 必须通知 deep 侧的 ITERATION_KEY 依赖
    (s as Record<string, unknown>).y = 2;
    expect(iterations).toBe(2);
    expect(getConnectionsCount(rawObj)).toBe(1);
  });

  test('数组 length 收缩通知截断索引依赖, unobserve 后 entry 归零', () => {
    const rawArr = [0, 1, 2, 3, 4];
    const a = observable(rawArr);

    let calls = 0;
    const r = observe(() => {
      a[4];
      calls++;
    });
    expect(calls).toBe(1);

    a.length = 2;
    expect(calls).toBe(2);

    unobserve(r);
    expect(getConnectionsCount(rawArr)).toBe(0);
  });

  test('同步 scheduler 批内重入: 自身清理/重注册不破坏同批其它 reaction', () => {
    const rawObj: Record<string, number> = { k: 0 };
    const o = observable(rawObj);

    const order: string[] = [];
    const rA = observe(
      () => {
        o.k;
      },
      {
        scheduler: (r: Reaction) => {
          order.push('sched-A');
          r(); // 同步重入: 立即清理并重注册 A 的依赖
        },
      }
    );
    observe(() => {
      o.k;
      order.push('run-B:' + o.k);
    });

    o.k = 1;
    // A 调度一次 (同步跑完), B 恰好以新值跑一次
    expect(order.filter(x => x === 'sched-A')).toHaveLength(1);
    expect(order.filter(x => x === 'run-B:1')).toHaveLength(1);

    o.k = 2;
    expect(order.filter(x => x === 'run-B:2')).toHaveLength(1);
    expect(getConnectionsCount(rawObj)).toBe(1);

    unobserve(rA);
  });

  test('重复 unobserve 同一 reaction 是幂等的, 之后同 key 重注册正常', () => {
    const rawObj = { v: 1 };
    const o = observable(rawObj);

    const r = observe(() => {
      o.v;
    });
    unobserve(r);
    unobserve(r);
    expect(getConnectionsCount(rawObj)).toBe(0);

    let calls = 0;
    const r2 = observe(() => {
      o.v;
      calls++;
    });
    o.v = 2;
    expect(calls).toBe(2);
    unobserve(r2);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });
});
