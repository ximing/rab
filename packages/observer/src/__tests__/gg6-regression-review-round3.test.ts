/**
 * GG6 第 3 轮对抗审查 (回归镜头) 加固测试: 审查 repro 实际攻击过、
 * 且既有 GG6 测试未覆盖的边界。全部为对当前正确行为的钉死 (GREEN pin),
 * 防止后续改动破坏以下语义:
 * - 对象型 scheduler (Set 批处理): flush 前 unobserve, 残留队列运行不重注册
 * - 共享 Set 的批内抛错隔离后, entry 清理仍精确到剩余依赖
 * - shadow 代理替换根属性通知 deep 侧嵌套 reader (共享连接表)
 * - deep 的自定义 proxyHandlers 只作用于 deep 代理自身 (per-proxy, 非 per-raw)
 * - entry 删空后由其他 reaction 重建, 旧 reaction 不复活、无分裂 Set
 */

import { observable } from '../observable';
import { shadowObservable } from '../shadow-observable';
import { observe, unobserve } from '../observer';
import { getConnectionsCount } from '../internals/reaction-track';
import { baseProxyHandler } from '../internals/handlers/base-proxy-handler';
import type { Reaction } from '../internals/types';

describe('GG6 review round 3 hardening', () => {
  test('对象型 scheduler: flush 前 unobserve, 残留队列运行不重注册、entry 归零', () => {
    const rawObj = { v: 1 };
    const o = observable(rawObj);
    const pending = new Set<Reaction>();
    let calls = 0;
    const r = observe(
      () => {
        o.v;
        calls++;
      },
      { scheduler: pending }
    );

    o.v = 2;
    o.v = 3; // Set 去重: 仍只有一个排队项
    expect(pending.size).toBe(1);

    unobserve(r);
    expect(getConnectionsCount(rawObj)).toBe(0);
    // unobserve 同时把 reaction 从对象型 scheduler 队列里摘除, 残留 flush 为空
    expect(pending.size).toBe(0);

    for (const run of [...pending]) {
      (run as unknown as () => void)();
    }
    expect(calls).toBe(1); // 摘除后无残留执行
    expect(getConnectionsCount(rawObj)).toBe(0);

    o.v = 4; // 不得复活
    expect(calls).toBe(1);
  });

  test('共享 Set 的批内抛错隔离: 剩余依赖 entry 保留, 逐个释放后归零', () => {
    const rawObj = { v: 1 };
    const o = observable(rawObj);
    let boom = false;
    let okCalls = 0;
    const bad = observe(() => {
      o.v;
      if (boom) throw new Error('boom');
    });
    const ok = observe(() => {
      o.v;
      okCalls++;
    });

    boom = true;
    expect(() => {
      o.v = 2;
    }).toThrow('boom'); // bad 抛错被隔离后 rethrow, ok 照常执行
    expect(okCalls).toBe(2);

    boom = false;
    o.v = 3;
    expect(okCalls).toBe(3); // bad 恢复后依赖仍有效

    unobserve(ok);
    expect(getConnectionsCount(rawObj)).toBe(1); // 只剩 bad
    unobserve(bad);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('shadow 替换根属性通知 deep 侧嵌套 reader (共享连接表, 根 key 变更)', () => {
    const root: { nested: { a: number } } = { nested: { a: 1 } };
    const s = shadowObservable(root);
    const o = observable(root);

    let deepCalls = 0;
    observe(() => {
      o.nested.a;
      deepCalls++;
    });
    expect(deepCalls).toBe(1);

    s.nested = { a: 2 }; // 根 key "nested" 变更经共享连接表通知 deep 依赖
    expect(deepCalls).toBe(2);
    expect(root.nested.a).toBe(2);
  });

  test('deep 的自定义 proxyHandlers 只作用于 deep 代理 (per-proxy 语义)', () => {
    const rawObj = { count: 0 };
    let setTrapCalls = 0;
    const o = observable(rawObj, {
      proxyHandlers: {
        ...baseProxyHandler,
        set(target: Record<string, number>, key: string | symbol, value: number, receiver: object) {
          setTrapCalls++;
          return Reflect.set(target, key, value, receiver);
        },
      },
    });
    const s = shadowObservable(rawObj);

    let calls = 0;
    observe(() => {
      s.count;
      calls++;
    });

    s.count = 1; // shadow 写入不经过 deep 的自定义 set trap
    o.count = 2; // deep 写入经过
    expect(setTrapCalls).toBe(1);
    expect(calls).toBe(3); // 但通知经共享连接表两侧都到达
  });

  test('entry 删空后由其他 reaction 重建: 旧 reaction 不复活、新依赖正常触发', () => {
    const rawObj: Record<string, number> = { a: 1 };
    const o = observable(rawObj);
    let c1 = 0;
    let c2 = 0;
    const r1 = observe(() => {
      o.a;
      c1++;
    });
    const r2 = observe(() => {
      o.a;
      c2++;
    });
    expect(getConnectionsCount(rawObj)).toBe(1);

    unobserve(r1);
    expect(getConnectionsCount(rawObj)).toBe(1); // r2 仍在, entry 保留
    unobserve(r2);
    expect(getConnectionsCount(rawObj)).toBe(0); // 空 → entry 删除

    let c3 = 0;
    const r3 = observe(() => {
      o.a;
      c3++;
    }); // 同 key 重建新 Set
    expect(getConnectionsCount(rawObj)).toBe(1);

    o.a = 2;
    expect(c1).toBe(1); // r1 不复活
    expect(c2).toBe(1); // r2 不复活
    expect(c3).toBe(2); // 新依赖正常触发

    unobserve(r3);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });
});
