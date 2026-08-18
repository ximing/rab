/*
 * 回归测试 (G3 第 1 轮对抗审查 #1/#2/#4): defineProperty trap 与 getter 隔离
 *
 * #1 部分 accessor 描述符重定义: 按 spec (CompletePropertyDescriptor),
 *    省略的 get/set 分量保持旧值。只重定义与旧属性相同的分量是 no-op,
 *    不得发幽灵通知 (身份比较必须用按旧描述符补全后的 effective 分量)。
 * #2/#4 trap 不得调用 getter:
 *    - 旧属性是 accessor 时, oldValue 捕获不得调用旧 getter
 *      (旧 getter 抛错时重定义必须照常生效, 与原生语义一致);
 *    - 落盘后不得以 this=raw 调用**新定义的** getter 计算 newValue
 *      (副作用型/lazy-memo getter 会被提前执行; 抛错型 getter 会让
 *      "已成功落盘的重定义"向用户抛 TypeError 且通知丢失)。
 */
import { observable, observe, shadowObservable } from "../main";

describe("#1 部分 accessor 描述符重定义: 相同分量补全后是 no-op, 不通知", () => {
  test("base: 只重定义相同的 get (省略 set, 旧 set 保留) 不通知", () => {
    const raw: Record<string, unknown> = {};
    const g1 = (): number => 1;
    const s1 = function (_v: number): void {};
    Object.defineProperty(raw, "x", {
      get: g1,
      set: s1,
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    // spec: 省略的 set 保持 s1, 属性完全没变 → no-op
    Object.defineProperty(obj, "x", { get: g1 });
    expect(seen).toEqual([1]);
  });

  test("base: 只重定义相同的 set (省略 get, 旧 get 保留) 不通知", () => {
    const raw: Record<string, unknown> = {};
    const g1 = (): number => 1;
    const s1 = function (_v: number): void {};
    Object.defineProperty(raw, "x", {
      get: g1,
      set: s1,
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, "x", { set: s1 });
    expect(seen).toEqual([1]);
  });

  test("shadow: 只重定义相同的 get 或相同的 set 均不通知", () => {
    const raw: Record<string, unknown> = {};
    const g1 = (): number => 1;
    const s1 = function (_v: number): void {};
    Object.defineProperty(raw, "x", {
      get: g1,
      set: s1,
      configurable: true,
      enumerable: true,
    });
    const obj = shadowObservable(raw) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, "x", { get: g1 });
    expect(seen).toEqual([1]);
    Object.defineProperty(obj, "x", { set: s1 });
    expect(seen).toEqual([1]);
  });

  test("对照: 部分 define 换成不同的 set 分量 (get 不变) 仍要通知", () => {
    const raw: Record<string, unknown> = {};
    const g1 = (): number => 1;
    const s1 = function (_v: number): void {};
    const s2 = function (_v: number): void {};
    Object.defineProperty(raw, "x", {
      get: g1,
      set: s1,
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, "x", { set: s2 });
    expect(seen).toEqual([1, 1]);
  });
});

describe("#4 trap 不得调用新定义的 getter", () => {
  test("base: defineProperty 后新 getter 调用次数为 0", () => {
    const obj = observable({ x: 1 }) as { x: number };
    let calls = 0;
    Object.defineProperty(obj, "x", {
      get() {
        calls++;
        return 999;
      },
      configurable: true,
    });
    expect(calls).toBe(0);
    expect(obj.x).toBe(999);
    expect(calls).toBe(1); // 只有显式读取这一次
  });

  test("shadow: defineProperty 后新 getter 调用次数为 0", () => {
    const obj = shadowObservable({ x: 1 }) as { x: number };
    let calls = 0;
    Object.defineProperty(obj, "x", {
      get() {
        calls++;
        return 999;
      },
      configurable: true,
    });
    expect(calls).toBe(0);
    expect(obj.x).toBe(999);
    expect(calls).toBe(1);
  });
});

describe("#2 trap 内 getter 抛错不得破坏重定义与通知", () => {
  test("base: 新 getter 抛错 → 重定义成功、不向 defineProperty 调用方抛错、reaction 仍被通知", () => {
    const obj = observable({ x: 1 }) as { x: number };
    const seen: unknown[] = [];
    observe(() => {
      try {
        seen.push(obj.x);
      } catch (e) {
        seen.push(`err:${(e as Error).message}`);
      }
    });
    expect(seen).toEqual([1]);

    expect(() => {
      Object.defineProperty(obj, "x", {
        get() {
          throw new Error("boom");
        },
        configurable: true,
      });
    }).not.toThrow();

    // 属性已翻转为 accessor, 且 reaction 收到了通知 (重跑读到抛错 getter)
    expect(typeof Object.getOwnPropertyDescriptor(obj, "x")?.get).toBe(
      "function"
    );
    expect(seen).toEqual([1, "err:boom"]);
  });

  test("shadow: 新 getter 抛错 → 重定义成功、reaction 仍被通知", () => {
    const obj = shadowObservable({ x: 1 }) as { x: number };
    const seen: unknown[] = [];
    observe(() => {
      try {
        seen.push(obj.x);
      } catch (e) {
        seen.push(`err:${(e as Error).message}`);
      }
    });
    expect(seen).toEqual([1]);

    expect(() => {
      Object.defineProperty(obj, "x", {
        get() {
          throw new Error("boom");
        },
        configurable: true,
      });
    }).not.toThrow();
    expect(seen).toEqual([1, "err:boom"]);
  });

  test("base: 旧 getter 抛错 → 重定义为数据属性照常生效, obj.x 可读", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "x", {
      get() {
        throw new Error("old-boom");
      },
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { x: number };

    expect(() => {
      Object.defineProperty(obj, "x", {
        value: 42,
        writable: true,
        configurable: true,
      });
    }).not.toThrow();
    expect(obj.x).toBe(42);
  });

  test("shadow: 旧 getter 抛错 → 重定义为数据属性照常生效", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "x", {
      get() {
        throw new Error("old-boom");
      },
      configurable: true,
      enumerable: true,
    });
    const obj = shadowObservable(raw) as { x: number };

    expect(() => {
      Object.defineProperty(obj, "x", {
        value: 42,
        writable: true,
        configurable: true,
      });
    }).not.toThrow();
    expect(obj.x).toBe(42);
  });
});
