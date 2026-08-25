/**
 * GG6 对抗审查加固测试: 锁定 #6 (rawToProxy 分桶) 与 #12 (空 entry 清理)
 * 组合出行为时的边界不变量 —— 均为审查 repro 实际攻击过的场景。
 */

import { observable } from '../observable';
import { shadowObservable } from '../shadow-observable';
import { observe, unobserve } from '../observer';
import { isObservable, raw } from '../internals/utils';
import { getConnectionsCount } from '../internals/reaction-track';
import type { Reaction } from '../internals/types';

describe('GG6 hardening: 模式分桶 + entry 清理的组合边界', () => {
  test('deep 子代理身份跨访问路径稳定; shadow 暴露 raw 嵌套对象', () => {
    const root: any = { nested: { a: 1 } };
    const s = shadowObservable(root);
    const o = observable(root);

    const childViaParent = o.nested;
    const childDirect = observable(root.nested);
    expect(childViaParent).toBe(childDirect);
    expect(raw(childViaParent)).toBe(root.nested);
    expect(s.nested).toBe(root.nested);
    expect(isObservable(childViaParent)).toBe(true);

    // 代理入参直接透传, 不跨模式转换
    expect(shadowObservable(childViaParent)).toBe(childViaParent);
    expect(observable(s)).toBe(s);
  });

  test('同一 raw 的 Map 在 deep/shadow 两个代理上: 单次写入两侧各触发一次', () => {
    const rawMap = new Map<any, any>();
    const s = shadowObservable(rawMap);
    const m = observable(rawMap);
    const k = { id: 1 };

    let shadowCalls = 0;
    let deepCalls = 0;
    observe(() => {
      s.get(k);
      shadowCalls++;
    });
    observe(() => {
      m.get(k);
      deepCalls++;
    });

    m.set(k, 1);
    expect(shadowCalls).toBe(2);
    expect(deepCalls).toBe(2);

    s.set(k, 2);
    expect(shadowCalls).toBe(3);
    expect(deepCalls).toBe(3);
  });

  test('reaction 重跑切换依赖后旧 entry 清除且新依赖仍被触发 (无 stale/漏通知)', () => {
    const rawObj: any = { ctl: 0 };
    const obj = observable(rawObj);
    let idx = 0;
    let calls = 0;
    const r = observe(() => {
      obj.ctl;
      obj['k' + idx];
      calls++;
    });

    for (let round = 0; round < 20; round++) {
      idx = round;
      rawObj['k' + round] = round; // raw 写入不通知, 依赖在下次运行时刷新
      obj.ctl = round + 1; // 变更 -> 触发 r 重跑, 重新注册到 k{round}
    }
    expect(calls).toBe(21);
    expect(getConnectionsCount(rawObj)).toBe(2); // ctl + k19

    obj.ctl = 99;
    expect(calls).toBe(22);

    unobserve(r);
    expect(getConnectionsCount(rawObj)).toBe(0);
    obj.ctl = 100;
    expect(calls).toBe(22);
  });

  test('async scheduler: unobserve 后 entry 归零, 手动运行残留队列不产生幻影注册', () => {
    const rawObj = { v: 1 };
    const obj = observable(rawObj);
    const pending: Reaction[] = [];
    const r = observe(() => void obj.v, {
      scheduler: rr => pending.push(rr),
    });

    obj.v = 2;
    unobserve(r);
    expect(getConnectionsCount(rawObj)).toBe(0);

    // runAsReaction 对已 unobserve 的 reaction 只执行 fn, 不建立依赖
    (pending.shift() as unknown as () => void)();
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('嵌套 mutation 重入: 栈上 reaction 自跳过, 栈外 reaction 正常触发', () => {
    const rawObj: any = { a: 0 };
    const obj = observable(rawObj);
    let innerCalls = 0;
    const inner = observe(() => {
      obj.a;
      innerCalls++;
    });
    let outerCalls = 0;
    const outer = observe(() => {
      obj.a;
      outerCalls++;
      if (outerCalls === 1) {
        obj.a = 1; // outer 在栈上: 自身跳过, inner 不在栈上要触发
      }
    });

    expect(innerCalls).toBe(2);
    expect(outerCalls).toBe(1);

    unobserve(inner);
    unobserve(outer);
    obj.a = 5;
    expect(innerCalls).toBe(2);
    expect(outerCalls).toBe(1);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('options 首次写死: 缓存命中后第二次传入的 options 不替换已有 handlers', () => {
    const rawObj = { count: 0 };
    const o1 = observable(rawObj, {
      reactionHandlers: { transformReactions: () => [] },
    });
    const o2 = observable(rawObj, {
      reactionHandlers: { transformReactions: (_t, _k, arr) => arr },
    });
    expect(o1).toBe(o2);

    let calls = 0;
    observe(() => {
      o1.count;
      calls++;
    });
    o1.count = 1;
    expect(calls).toBe(1); // 第一次的过滤 handler 仍然生效
  });

  test('deep options 的 transformReactions 对同一 raw 的 shadow 写入同样生效 (共享连接表语义)', () => {
    const rawObj = { count: 0 };
    const o = observable(rawObj, {
      reactionHandlers: { transformReactions: () => [] },
    });
    const s = shadowObservable(rawObj);

    let calls = 0;
    observe(() => {
      s.count;
      calls++;
    });
    s.count = 1;
    expect(calls).toBe(1); // 被 deep 侧 options 过滤
    o.count = 2;
    expect(calls).toBe(1);
  });

  // 第 1 轮审查 issue #1 场景 M (shadow-first 创建顺序), 钉死为**有意的
  // per-raw options 语义**: connectionStore 按 raw+key 共享, 通知期的
  // transformReactions 过滤器无法 (也不应) 区分写入走的是哪个代理 ——
  // shadowObservable 不接收 options, 用户如需隔离请用不同的 raw 对象。
  // 详见 shadowObservable / observable 的 JSDoc。
  test('per-raw options 语义 (shadow-first 顺序): deep 的 transformReactions 同样治理 shadow 侧通知', () => {
    const rawObj = { count: 0 };
    const s = shadowObservable(rawObj);
    const o = observable(rawObj, {
      reactionHandlers: { transformReactions: () => [] },
    });

    let sCalls = 0;
    let dCalls = 0;
    observe(() => {
      s.count;
      sCalls++;
    });
    observe(() => {
      o.count;
      dCalls++;
    });

    s.count = 1;
    expect(sCalls).toBe(1); // shadow 写入的通知也被 deep 侧 options 过滤
    expect(dCalls).toBe(1);
    o.count = 2;
    expect(sCalls).toBe(1);
    expect(dCalls).toBe(1);
  });
});
