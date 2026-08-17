/*
 * 转发窗口边界语义的 characterization 测试 (GG2 对抗审查第 1/3 轮)。
 *
 * 第 1 轮 #1 与第 3 轮 #1b/#1c 原为 **pin 丢通知行为** 的限制测试,
 * 根因在 set trap 的"赋值值 vs 旧值"比较策略与 defineProperty trap 的
 * `descriptor.value !== undefined` 守卫。G3 值比较修复已落地:
 * set trap 通知前重读落盘后的 target[key] 实际值参与比较 (自有路径与
 * 转发 walk 中间层路径), defineProperty trap 改用 `'value' in descriptor`
 * 判定数据描述符 —— 这些断言已翻转为正确行为。
 *
 * 原第 1 轮 #2 (defineProperty trap oldValue 捕获触发的 getter 副作用
 * 绕过 trap, 归 G3/G7) 已随 G3 对抗审查 #2/#4 修复 (trap 不再调用
 * accessor getter), 见文件末尾 describe。
 */
import { observable, observe, shadowObservable } from "../main";

function defineValue(obj: object, key: string, value: number) {
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/*
 * 第 1 轮 issue #1 / #3 (base + shadow handler), 原为 pin 丢通知的限制:
 * 转发窗口内, setter 对"正在设置的同一 {target,key}"调 Object.defineProperty
 * 落盘变换值, set trap 的"赋值值 vs 旧值"比较可能误判无变化。
 *
 * 机理: set trap push {raw, key} 帧 → Reflect.set 命中自有 accessor →
 * setter 内 defineProperty(proxy, key) 进 defineProperty trap, 命中帧被当
 * 引擎路由回的 [[DefineOwnProperty]] 透传 (只透传不通知, 防双通知所必需);
 * {target,key} 匹配无法进一步收窄: OrdinarySetWithOwnDescriptor 路由回的
 * key 必然等于正在写的 key, trap 边界无法区分引擎内部路由与用户同 key define。
 *
 * 修复 (G3 值比较): set trap 通知前重读落盘后的 target[key] 实际值参与
 * 变化比较, 通知携带实际落盘值 —— 引擎路由回 receiver 的普通赋值
 * landed === value, 行为不变; setter 变换落盘的场景不再丢通知。
 */
describe("转发窗口修复: setter 同 key defineProperty 变换落盘值参与比较 (landed-value)", () => {
  test("base: setter 同 key defineProperty 翻倍落盘, 赋值值恰等于旧值 → 落盘值变化仍通知", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "x", {
      configurable: true,
      enumerable: true,
      get() {
        return 10;
      },
      set(v: number) {
        // this 是 proxy (receiver), defineProperty 进 trap, 命中转发帧被透传
        defineValue(this, "x", v * 2);
      },
    });
    const obj = observable(raw) as { x: number };

    let calls = 0;
    let seen: number | undefined;
    observe(() => {
      seen = obj.x;
      calls++;
    });
    expect(calls).toBe(1);
    expect(seen).toBe(10);

    obj.x = 10; // 赋值值 10 === 旧 getter 值 10, 但 setter 落盘 20
    expect(obj.x).toBe(20);
    expect(calls).toBe(2);
    expect(seen).toBe(20);
  });

  test("shadow: shadow handler 上同场景同样通知", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "x", {
      configurable: true,
      enumerable: true,
      get() {
        return 10;
      },
      set(v: number) {
        defineValue(this, "x", v * 2);
      },
    });
    const obj = shadowObservable(raw) as { x: number };

    let calls = 0;
    let seen: number | undefined;
    observe(() => {
      seen = obj.x;
      calls++;
    });
    obj.x = 10;
    expect(obj.x).toBe(20);
    expect(calls).toBe(2);
    expect(seen).toBe(20);
  });

  test("对照: 后续赋值按落盘值比较, 连续变换赋值逐次通知", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "x", {
      configurable: true,
      enumerable: true,
      get() {
        return 1;
      },
      set(v: number) {
        defineValue(this, "x", v * 10);
      },
    });
    const obj = observable(raw) as { x: number };

    let calls = 0;
    let seen: number | undefined;
    observe(() => {
      seen = obj.x;
      calls++;
    });
    obj.x = 1; // 赋值值 1 === 旧 getter 值 1, 但落盘 10 → 通知
    expect(obj.x).toBe(10);
    expect(calls).toBe(2);
    expect(seen).toBe(10);
    obj.x = 2; // 赋值值 2 !== 旧值 10 → 正常通知 (x 已是 data 属性, 直接落盘 2)
    expect(calls).toBe(3);
    expect(seen).toBe(2);
  });

  test("gg2-attack2 C1 形态: _v 支撑的 flag setter 同 key defineProperty v*10", () => {
    const obj: any = observable({
      _v: 1,
      get flag() {
        return this._v;
      },
      set flag(v: number) {
        defineValue(obj, "flag", v * 10);
      },
    });
    let reads = 0;
    observe(() => {
      void obj.flag;
      reads++;
    });
    obj.flag = 1; // oldValue(经 getter)=1 === 赋值值 1, 但落盘 10 → 通知
    expect(reads).toBe(2);
    expect(obj.flag).toBe(10);
  });

  test("变换型 accessor 写回值恰等于旧观察值 → 观察值未变, 不通知 (landed 比较语义)", () => {
    let stored = 4;
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "x", {
      configurable: true,
      enumerable: true,
      get() {
        return stored;
      },
      set(v: number) {
        stored = v * 2;
      },
    });
    const obj = observable(raw) as { x: number };

    let calls = 0;
    let seen: number | undefined;
    observe(() => {
      seen = obj.x;
      calls++;
    });
    expect(calls).toBe(1);
    expect(seen).toBe(4);
    obj.x = 2; // stored: 4 → 4, 观察值不变 → 不通知
    expect(obj.x).toBe(4);
    expect(calls).toBe(1);
    expect(seen).toBe(4);
    obj.x = 3; // stored: 4 → 6 → 通知
    expect(obj.x).toBe(6);
    expect(calls).toBe(2);
    expect(seen).toBe(6);
  });
});

/*
 * 第 3 轮 issue #1b / #1c, 原为 pin 丢通知的限制, 已随 G3 值比较修复翻转:
 *
 * #1b: 转发链中间层 observable 的同 {target,key} defineProperty 曾被帧吞。
 * 转发 walk 链上每一层 set trap 都压了帧 (child → middle → grandparent),
 * setter 对链上任何一层的同 key defineProperty 都会命中该层自己的帧被透传,
 * 且该层 set trap 因 receiver 不匹配提前返回不通知 → 中间层 reaction 丢通知。
 * 修复: set trap 在 receiver 不匹配的提前返回路径上重读本层落盘后的
 * target[key] 实际值, 若本层 raw 在转发窗口内被实际改写则照常通知。
 *
 * #1c: defineProperty trap 的通知守卫曾用 `descriptor.value !== undefined`
 * 判定"是数据描述符且值参与比较", 显式 `{ value: undefined }` 被当成
 * "无值写入"跳过通知。修复: 改用 `'value' in descriptor` 判定数据描述符
 * (accessor descriptor 仍按现行设计跳过)。
 */
describe("转发窗口修复: 链上中间层同 key define 与显式 undefined 值", () => {
  test("#1b: grandparent setter 对链上 middle 同 key defineProperty, middle reaction 收到通知", () => {
    const middle = observable({ side: 0 });
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
    const child = observable(Object.create(middle) as { k?: number });

    let midCalls = 0;
    observe(() => {
      void (middle as Record<string, unknown>).k;
      midCalls++;
    });
    let childCalls = 0;
    observe(() => {
      void child.k;
      childCalls++;
    });
    expect(midCalls).toBe(1);
    expect(childCalls).toBe(1);

    child.k = 5;
    // middle 的值确实变了 (k 从 undefined -> 5) → middle reaction 单次通知
    expect((middle as Record<string, unknown>).k).toBe(5);
    expect(midCalls).toBe(2);
    // child 侧 (写入发起者) 仍单次通知
    expect(childCalls).toBe(2);
  });

  test("#1c: Object.defineProperty 显式 { value: undefined } 覆盖旧值通知 (对照 set trap 行为一致)", () => {
    const obj = observable({ x: 5 }) as { x: number | undefined };
    let calls = 0;
    let seen: number | undefined;
    observe(() => {
      seen = obj.x;
      calls++;
    });
    expect(calls).toBe(1);

    Object.defineProperty(obj, "x", {
      value: undefined,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    expect(obj.x).toBeUndefined();
    expect(calls).toBe(2);
    expect(seen).toBeUndefined();

    // 对照: 普通赋值 undefined 走 set trap 正常通知
    const obj2 = observable({ x: 5 }) as { x: number | undefined };
    let calls2 = 0;
    observe(() => {
      void obj2.x;
      calls2++;
    });
    obj2.x = undefined;
    expect(obj2.x).toBeUndefined();
    expect(calls2).toBe(2);
  });

  test("#1c(shadow): shadow handler 上显式 { value: undefined } 覆盖旧值同样通知", () => {
    const obj = shadowObservable({ x: 5 }) as { x: number | undefined };
    let calls = 0;
    let seen: number | undefined;
    observe(() => {
      seen = obj.x;
      calls++;
    });
    expect(calls).toBe(1);
    Object.defineProperty(obj, "x", {
      value: undefined,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    expect(obj.x).toBeUndefined();
    expect(calls).toBe(2);
    expect(seen).toBeUndefined();
  });

  test("#1c(对照): accessor descriptor 与无 value 的部分 define 仍不触发数据值通知", () => {
    const obj = observable({ x: 5 }) as { x: number };
    let calls = 0;
    observe(() => {
      void obj.x;
      calls++;
    });
    expect(calls).toBe(1);
    // 部分 define (仅改 enumerable), 无 value 无 accessor → 值未变, 不通知
    Object.defineProperty(obj, "x", { enumerable: false });
    expect(obj.x).toBe(5);
    expect(calls).toBe(1);
    // accessor descriptor → 按现行设计跳过数据值通知
    Object.defineProperty(obj, "y", {
      get() {
        return 1;
      },
      configurable: true,
    });
    expect(calls).toBe(1);
  });
});

/*
 * 原已知限制 #2 (G3/G7): defineProperty trap 捕获 oldValue 时以
 * this=raw 调用 getter, 副作用型 getter 内对 this (raw) 的
 * Object.defineProperty 直接改 raw 对象、完全绕过 proxy trap,
 * 转发窗口内外都丢通知。
 *
 * 已随 G3 对抗审查 #2/#4 修复: defineProperty trap 对旧 accessor 属性
 * 不再读取 oldValue (getter 从不在 trap 内被调用)。下列断言已从
 * "pin 丢通知的限制" 翻转为正确行为。
 */
describe("已修复: defineProperty trap 不再调用旧 getter (oldValue 捕获隔离)", () => {
  test("武装的 lazy getter 正常读取时 defineProperty(proxy) → reaction 收到通知", () => {
    let armed = false;
    const obj: any = observable({});
    Object.defineProperty(obj, "lazy", {
      configurable: true,
      enumerable: true,
      get() {
        if (armed) {
          // 正常 get 路径 this 是 proxy, defineProperty 经 trap 通知
          Object.defineProperty(this, "lazy", {
            value: 777,
            writable: true,
            configurable: true,
            enumerable: true,
          });
          return 777;
        }
        return 1;
      },
    });
    let calls = 0;
    let seen: unknown;
    observe(() => {
      seen = obj.lazy;
      calls++;
    });
    expect(calls).toBe(1);
    expect(seen).toBe(1);

    armed = true;
    const v = obj.lazy; // 普通读, 无任何转发窗口
    expect(v).toBe(777);
    // getter 内 defineProperty(proxy) 经 trap 正常通知
    expect(calls).toBe(2);
    expect(seen).toBe(777);
  });

  test("defineProperty 重定义旧 accessor 期间旧 getter 不被调用 (副作用隔离)", () => {
    let oldGetterCalls = 0;
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "x", {
      configurable: true,
      enumerable: true,
      get() {
        oldGetterCalls++;
        return 1;
      },
    });
    const obj = observable(raw) as { x: number };
    expect(obj.x).toBe(1);
    expect(oldGetterCalls).toBe(1);

    // 重定义为数据属性: trap 不得为捕获 oldValue 而调用旧 getter
    Object.defineProperty(obj, "x", {
      value: 2,
      writable: true,
      configurable: true,
    });
    expect(oldGetterCalls).toBe(1);
    expect(obj.x).toBe(2);
  });
});
