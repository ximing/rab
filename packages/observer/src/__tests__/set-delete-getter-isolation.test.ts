/*
 * 回归测试 (G3 第 3 轮对抗审查 #1/#4): set / deleteProperty trap 与 getter 隔离
 *
 * 538b29e 已在 defineProperty trap 确立不变量「trap 不得调用自有 accessor 的
 * getter」, 但 set trap (入口 oldValue 捕获 + 2299f56 新增的落盘后 landedValue
 * 重读) 与 deleteProperty trap (oldValue 捕获) 原样保留同一缺陷类:
 *   - 抛错型 getter: 赋值/删除向调用方抛错且写入丢失 (原生语义下带 accessor
 *     的普通对象赋值从不调用 getter);
 *   - 副作用型 getter: 以 this=raw 被调用, 其对 raw 的变更绕过所有 trap,
 *     且一次赋值触发 getter 两次 (入口 + landedValue)。
 */
import { observable, observe, shadowObservable } from "../main";

/*
 * 场景一: 抛错型 getter + 落盘型 setter
 * 原生语义: obj.x = 20 调用 setter 落盘, 从不调用 getter, 不抛错。
 */
describe("#1/#4 set trap: 抛错型 getter 不得让赋值抛错或丢通知", () => {
  test("base: 落盘成功、赋值不抛、reaction 收到通知", () => {
    const raw: Record<string, unknown> = {};
    let stored = 0;
    Object.defineProperty(raw, "x", {
      get() {
        if (stored > 10) throw new Error("getter boom");
        return stored;
      },
      set(v: number) {
        stored = v;
      },
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { x: number };
    const seen: unknown[] = [];
    observe(() => {
      try {
        seen.push(obj.x);
      } catch (e) {
        seen.push(`err:${(e as Error).message}`);
      }
    });
    expect(seen).toEqual([0]);

    expect(() => {
      obj.x = 20;
    }).not.toThrow();
    // setter 已落盘
    expect(stored).toBe(20);
    // reaction 被通知 (重跑经 get trap 读到抛错型 getter, 属读取语义)
    expect(seen).toEqual([0, "err:getter boom"]);
  });

  test("shadow: 落盘成功、赋值不抛、reaction 收到通知", () => {
    const raw: Record<string, unknown> = {};
    let stored = 0;
    Object.defineProperty(raw, "x", {
      get() {
        if (stored > 10) throw new Error("getter boom");
        return stored;
      },
      set(v: number) {
        stored = v;
      },
      configurable: true,
      enumerable: true,
    });
    const obj = shadowObservable(raw) as { x: number };
    const seen: unknown[] = [];
    observe(() => {
      try {
        seen.push(obj.x);
      } catch (e) {
        seen.push(`err:${(e as Error).message}`);
      }
    });
    expect(seen).toEqual([0]);

    expect(() => {
      obj.x = 20;
    }).not.toThrow();
    expect(stored).toBe(20);
    expect(seen).toEqual([0, "err:getter boom"]);
  });

  test("base: getter 无条件抛错 → 赋值仍不抛、setter 已执行", () => {
    const raw: Record<string, unknown> = {};
    let stored = 0;
    Object.defineProperty(raw, "x", {
      get() {
        throw new Error("always boom");
      },
      set(v: number) {
        stored = v;
      },
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { x: number };

    expect(() => {
      obj.x = 5;
    }).not.toThrow();
    expect(stored).toBe(5);
  });

  test("shadow: getter 无条件抛错 → 赋值仍不抛、setter 已执行", () => {
    const raw: Record<string, unknown> = {};
    let stored = 0;
    Object.defineProperty(raw, "x", {
      get() {
        throw new Error("always boom");
      },
      set(v: number) {
        stored = v;
      },
      configurable: true,
      enumerable: true,
    });
    const obj = shadowObservable(raw) as { x: number };

    expect(() => {
      obj.x = 5;
    }).not.toThrow();
    expect(stored).toBe(5);
  });
});

/*
 * 场景二: 副作用型 getter
 * trap 内任何 target[key] 读取都会以 this=raw 调用 getter; 经 proxy 的合法
 * 读取 (get trap → Reflect.get(target, key, receiver)) 以 this=proxy 调用。
 * 断言: 一次赋值过程中 getter 不被以 this=raw 调用, 调用次数不因 trap 增加
 * (只有 reaction 重跑的那一次)。
 */
describe("#1/#4 set trap: 副作用型 getter 不得被 trap 以 this=raw 调用", () => {
  test("base: 赋值不增加 getter 调用 (除 reaction 重读), 无 this=raw 调用", () => {
    const raw: Record<string, unknown> = {};
    const proxyHolder: { proxy?: Record<string, unknown> } = {};
    let calls = 0;
    let rawThisCalls = 0;
    Object.defineProperty(raw, "x", {
      get() {
        calls++;
        if (this === raw) rawThisCalls++;
        return 1;
      },
      set(v: unknown) {
        // setter 忽略写入 (读取语义不变 → 不通知也可接受, 关键是 getter 隔离)
      },
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { x: number };
    proxyHolder.proxy = obj;
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);
    const callsBefore = calls;

    obj.x = 1;
    // trap 不得读 getter: 唯一允许的新调用是 reaction 通知后的重跑 (this=proxy)。
    // (若本用例的实现选择「不通知」: calls 增量为 0 同样满足 getter 隔离;
    //  断言写成 <= 1 以兼容两种正确策略, 但 rawThisCalls 必须为 0。)
    expect(calls - callsBefore).toBeLessThanOrEqual(1);
    expect(rawThisCalls).toBe(0);
  });

  test("shadow: 赋值不增加 getter 调用, 无 this=raw 调用", () => {
    const raw: Record<string, unknown> = {};
    let calls = 0;
    let rawThisCalls = 0;
    Object.defineProperty(raw, "x", {
      get() {
        calls++;
        if (this === raw) rawThisCalls++;
        return 1;
      },
      set(v: unknown) {},
      configurable: true,
      enumerable: true,
    });
    const obj = shadowObservable(raw) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);
    const callsBefore = calls;

    obj.x = 1;
    expect(calls - callsBefore).toBeLessThanOrEqual(1);
    expect(rawThisCalls).toBe(0);
  });
});

/*
 * 场景三: 观察者脏读 (one-shot 抛错型 getter)
 * 赋值点向调用方抛错时 reaction 永久停留在旧值; 修复后赋值不抛、通知到达,
 * 后续写入也不再在同一读取点抛错。
 */
describe("#1/#4 set trap: 观察者不得因 trap 读 getter 而脏读", () => {
  test("base: 连续两次写入均不抛, reaction 每次都收到通知", () => {
    const raw: Record<string, unknown> = {};
    let stored = 10;
    Object.defineProperty(raw, "x", {
      get() {
        if (stored > 10) throw new Error("boom");
        return stored;
      },
      set(v: number) {
        stored = v;
      },
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { x: number };
    const seen: unknown[] = [];
    observe(() => {
      try {
        seen.push(obj.x);
      } catch (e) {
        seen.push(`err:${(e as Error).message}`);
      }
    });
    expect(seen).toEqual([10]);

    expect(() => {
      obj.x = 20;
    }).not.toThrow();
    expect(seen).toEqual([10, "err:boom"]);

    // 第二次写入同样不得在 set trap 内抛错
    expect(() => {
      obj.x = 30;
    }).not.toThrow();
    expect(stored).toBe(30);
  });
});

/*
 * 场景四: deleteProperty trap 的 oldValue 捕获同样不得调用 getter
 */
describe("#1 deleteProperty trap: 不得调用自有 accessor getter", () => {
  test("base: getter 抛错 → delete 不抛、属性已删除、reaction 通知", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "z", {
      get() {
        throw new Error("delete boom");
      },
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { z?: unknown };
    const seen: unknown[] = [];
    observe(() => {
      seen.push("z" in obj ? "present" : "absent");
    });
    expect(seen).toEqual(["present"]);

    expect(() => {
      delete obj.z;
    }).not.toThrow();
    expect(Object.getOwnPropertyDescriptor(raw, "z")).toBeUndefined();
    expect(seen).toEqual(["present", "absent"]);
  });

  test("shadow: getter 抛错 → delete 不抛、属性已删除", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "z", {
      get() {
        throw new Error("delete boom");
      },
      configurable: true,
      enumerable: true,
    });
    const obj = shadowObservable(raw) as { z?: unknown };

    expect(() => {
      delete obj.z;
    }).not.toThrow();
    expect(Object.getOwnPropertyDescriptor(raw, "z")).toBeUndefined();
  });

  test("base: 副作用型 getter → delete 过程零 getter 调用", () => {
    const raw: Record<string, unknown> = {};
    let calls = 0;
    Object.defineProperty(raw, "z", {
      get() {
        calls++;
        return 1;
      },
      configurable: true,
      enumerable: true,
    });
    const obj = observable(raw) as { z?: unknown };

    delete obj.z;
    expect(calls).toBe(0);
    expect(Object.getOwnPropertyDescriptor(raw, "z")).toBeUndefined();
  });

  test("shadow: 副作用型 getter → delete 过程零 getter 调用", () => {
    const raw: Record<string, unknown> = {};
    let calls = 0;
    Object.defineProperty(raw, "z", {
      get() {
        calls++;
        return 1;
      },
      configurable: true,
      enumerable: true,
    });
    const obj = shadowObservable(raw) as { z?: unknown };

    delete obj.z;
    expect(calls).toBe(0);
  });

  test("base: 数据属性 delete 仍携带 oldValue (不回归)", () => {
    const obj = observable({ z: 7 }) as { z?: number };
    let notifiedOldValue: unknown;
    let sawDelete = false;
    observe(
      () => {
        void obj.z;
      },
      {
        // 通过 debugger 捕获 delete 通知的 oldValue (debuggerReaction 消费者)
        debugger: (op) => {
          if (op.type === "delete") {
            sawDelete = true;
            notifiedOldValue = op.oldValue;
          }
        },
      }
    );
    delete obj.z;
    expect(sawDelete).toBe(true);
    expect(notifiedOldValue).toBe(7);
  });
});
