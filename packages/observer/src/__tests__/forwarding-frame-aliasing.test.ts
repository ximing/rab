/*
 * 回归测试: 转发帧的 covered 标记与跨 handler 链 (对抗审查 G2 轮 3 的两个 high)
 *
 * 1. covered 只按 key 名匹配会跨 target 误伤: setter 内一条**无关**原型链的
 *    嵌套写入 (恰好同名 key) 触发中层通知时, 把外层链的帧误标 covered,
 *    外层 receiver 的兜底 add 被吞 —— 被观察值真的变了, reaction 却丢通知。
 *    修复: covered 标记锚定 receiver (只标 target === proxyToRaw.get(receiver)
 *    的帧, 即本转发链的根帧)。
 *
 * 2. base 与 shadow handler 各持独立的模块级转发帧栈: 混合 handler 原型链
 *    (base child → shadow middle → base gp) 上, 中层在 shadow 栈上标记 covered,
 *    外层 receiver 的帧却在 base 栈上 —— 兜底 add 不被抑制, 链上 reaction 双通知。
 *    修复: 帧栈抽为两个 handler 共享的模块。
 */
import { observable, observe, shadowObservable } from "../main";

describe("转发帧 covered 标记的跨 target 误伤", () => {
  test("setter 内无关链的同名 key 嵌套写入不得吞掉外层的兜底 add", () => {
    // 无关链 (chain2), 与外层仅 key 同名 'count'
    const middle2: Record<PropertyKey, unknown> = observable({ side: 0 });
    const gp2Raw: Record<string, unknown> = {};
    Object.defineProperty(gp2Raw, "count", {
      configurable: true,
      set(this: unknown, v: number) {
        Object.defineProperty(middle2, "count", {
          value: v,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      },
    });
    const gp2 = observable(gp2Raw);
    Object.setPrototypeOf(middle2, gp2);
    const child2 = observable(Object.create(middle2));

    // 外层链: proto 的 setter 里做一次无关嵌套写入
    let backing = 0;
    const proto = {
      get count() {
        return backing;
      },
      set count(v: number) {
        backing = v * 2;
        // 无关嵌套写入, key 恰好同名
        void (child2 as Record<PropertyKey, unknown>).count;
        (child2 as unknown as Record<PropertyKey, unknown>).count = 5;
      },
    };
    const obj = observable(Object.create(proto));

    let calls = 0;
    let seen: number | undefined;
    observe(() => {
      seen = obj.count;
      calls++;
    });
    expect(calls).toBe(1);
    expect(seen).toBe(0);

    (obj as unknown as Record<PropertyKey, unknown>).count = 5; // backing: 0 -> 10
    expect(obj.count).toBe(10);
    expect(calls).toBe(2);
    expect(seen).toBe(10);
  });
});

describe("base/shadow 混合 handler 链的转发帧栈共享", () => {
  test("shadow 中层通知后, base 外层的兜底 add 必须被抑制 (不得双通知)", () => {
    const middle: Record<PropertyKey, unknown> = shadowObservable({ side: 0 });
    const gpRaw: Record<string, unknown> = {};
    Object.defineProperty(gpRaw, "k", {
      configurable: true,
      set(this: unknown, v: number) {
        Object.defineProperty(middle, "k", {
          value: v,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      },
    });
    const gp = observable(gpRaw);
    Object.setPrototypeOf(middle, gp);
    // base child, 原型是 shadow middle
    const child = observable(Object.create(middle));

    let midCalls = 0;
    observe(() => {
      void middle.k;
      midCalls++;
    });
    let childCalls = 0;
    observe(() => {
      void child.k;
      childCalls++;
    });
    expect(midCalls).toBe(1);
    expect(childCalls).toBe(1);

    (child as unknown as Record<PropertyKey, unknown>).k = 5;
    expect(middle.k).toBe(5);
    expect(midCalls).toBe(2);
    expect(childCalls).toBe(2);
  });

  test("对称: base 中层通知后, shadow 外层的兜底 add 也必须被抑制", () => {
    const middle: Record<PropertyKey, unknown> = observable({ side: 0 });
    const gpRaw: Record<string, unknown> = {};
    Object.defineProperty(gpRaw, "k", {
      configurable: true,
      set(this: unknown, v: number) {
        Object.defineProperty(middle, "k", {
          value: v,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      },
    });
    const gp = observable(gpRaw);
    Object.setPrototypeOf(middle, gp);
    const child = shadowObservable(Object.create(middle));

    let midCalls = 0;
    observe(() => {
      void middle.k;
      midCalls++;
    });
    let childCalls = 0;
    observe(() => {
      void child.k;
      childCalls++;
    });
    expect(midCalls).toBe(1);
    expect(childCalls).toBe(1);

    (child as unknown as Record<PropertyKey, unknown>).k = 5;
    expect(middle.k).toBe(5);
    expect(midCalls).toBe(2);
    expect(childCalls).toBe(2);
  });
});
