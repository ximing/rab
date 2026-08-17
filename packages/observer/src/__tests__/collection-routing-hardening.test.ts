import vm from "vm";
import { observable, observe, shadowObservable } from "../main";

/*
 * GG7 加固测试 (对抗审查轮次补充, 全部 pin 当前绿色行为):
 * - 跨 realm WeakMap/WeakSet 路由 (deep + shadow)
 * - 跨 realm 内置对象嵌套在 observable 对象内 (经 observableChild → observable
 *   → shouldInstrument 委托, 黑名单同样生效)
 * - self-clear: reaction 运行中清空自身依赖的集合 —— 不得自通知/死循环,
 *   且 debugger 不收到该次 clear (reaction 在栈上, 与修复前语义一致)
 * - 双重 clear: 第二次 (空集合) 不产生 debugger 事件
 * */

describe("GG7 hardening: cross-realm collection routing edges", () => {
  test("cross-realm WeakMap routes to collection handlers (deep)", () => {
    const wm = vm.runInNewContext("new WeakMap()") as WeakMap<object, number>;
    const key = {};
    const m = observable(wm);
    expect(m).not.toBe(wm);
    let dummy: number | undefined;
    observe(() => (dummy = m.get(key)));
    expect(dummy).toBe(undefined);
    m.set(key, 1);
    expect(dummy).toBe(1);
    expect(m.has(key)).toBe(true);
    expect(m.delete(key)).toBe(true);
    expect(dummy).toBe(undefined);
  });

  test("cross-realm WeakSet routes to collection handlers (shadow)", () => {
    const ws = vm.runInNewContext("new WeakSet()") as WeakSet<object>;
    const s = shadowObservable(ws);
    expect(s).not.toBe(ws);
    const key = {};
    let seen: boolean | undefined;
    observe(() => (seen = s.has(key)));
    expect(seen).toBe(false);
    s.add(key);
    expect(seen).toBe(true);
    s.delete(key);
    expect(seen).toBe(false);
  });

  test("cross-realm Map via shadowObservable is reactive", () => {
    const rm = vm.runInNewContext("new Map([['a', 1]])") as Map<
      string,
      number
    >;
    const sh = shadowObservable(rm);
    expect(sh).not.toBe(rm);
    let dummy: number | undefined;
    observe(() => (dummy = sh.get("a")));
    expect(dummy).toBe(1);
    sh.set("a", 2);
    expect(dummy).toBe(2);
    sh.clear();
    expect(dummy).toBe(undefined);
    expect(sh.size).toBe(0);
  });
});

describe("GG7 hardening: nested cross-realm built-ins", () => {
  test("cross-realm Date nested in an observable object stays raw and usable", () => {
    const d = vm.runInNewContext("new Date(2020, 0, 2)") as Date;
    const state = observable({ when: d });
    // 经 observableChild → observable → shouldInstrument 委托, 黑名单同样生效
    expect(state.when).toBe(d);
    expect(() => state.when.getTime()).not.toThrow();
  });

  test("cross-realm Map nested in an observable object is deeply reactive", () => {
    const cm = vm.runInNewContext("new Map([['a', 1]])") as Map<
      string,
      number
    >;
    const state = observable({ m: cm });
    expect(state.m).not.toBe(cm);
    let dummy: number | undefined;
    observe(() => (dummy = state.m.get("a")));
    expect(dummy).toBe(1);
    state.m.set("a", 2);
    expect(dummy).toBe(2);
  });
});

describe("GG7 hardening: clear self-notification edges", () => {
  test("clear issued inside the reaction's own run does not self-notify or loop", () => {
    const c = observable(new Map([["c", 1]]));
    const clearOps: string[] = [];
    let ran = 0;
    let dummy: number | undefined;
    observe(
      () => {
        dummy = c.get("c");
        ran++;
        if (ran === 1) {
          c.clear();
        }
      },
      {
        debugger: (op) => {
          if (op.type === "clear") clearOps.push("clear");
        },
      }
    );
    // 无死循环、无自通知; reaction 在栈上, 该次 clear 不进 debugger
    expect(ran).toBe(1);
    expect(dummy).toBe(1);
    expect(clearOps).toHaveLength(0);
    expect(c.size).toBe(0);
  });

  test("second clear on an already-empty Map emits no debugger event", () => {
    const m = observable(new Map([["a", 1]]));
    const ops: unknown[] = [];
    observe(() => m.get("a"), {
      debugger: (op) => {
        if (op.type === "clear") ops.push(op.oldValue);
      },
    });
    m.clear();
    m.clear();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual(new Map([["a", 1]]));
  });
});
