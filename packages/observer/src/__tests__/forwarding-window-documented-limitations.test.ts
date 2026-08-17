/*
 * 已知限制的 characterization 测试 (GG2 对抗审查第 1 轮 issue #1/#2/#3)。
 *
 * 这些测试 **pin 当前行为**, 不是正确行为的断言:
 * 下面每个场景都存在真实的丢通知路径, 但两轮独立对抗审查一致判定
 * 不属于 GG2 转发帧栈批次修复 (旧布尔实现吞得更多 / master 上同样丢),
 * 根因在 set trap 的"赋值值 vs 旧值"比较策略, 归 G3 (值比较与通知守卫)
 * 与 G3/G7 (oldValue 捕获副作用) 批次处理。
 *
 * G3/G7 落地值比较重做 (例如 set trap 通知前重读落盘后的 target[key]
 * 实际值参与比较) 时, 应当翻转这些断言并删掉对应限制注释。
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
 * 已知限制 #1 / #3 (base + shadow handler):
 * 转发窗口内, setter 对"正在设置的同一 {target,key}"调 Object.defineProperty
 * 且变换后落盘值恰好使 set trap 的 value === oldValue 比较相等时, 通知丢失。
 *
 * 机理: set trap push {raw, key} 帧 → Reflect.set 命中自有 accessor →
 * setter 内 defineProperty(proxy, key) 进 defineProperty trap, 命中帧被当
 * 引擎路由回的 [[DefineOwnProperty]] 透传 (只透传不通知, 防双通知所必需);
 * Reflect.set 返回后 set trap 走 hadKey 分支, value === oldValue → 也不通知。
 * {target,key} 匹配无法进一步收窄: OrdinarySetWithOwnDescriptor 路由回的
 * key 必然等于正在写的 key, trap 边界无法区分引擎内部路由与用户同 key define。
 *
 * 同场景在 master (无 defineProperty trap) 与旧布尔实现上输出一致,
 * 非本次 GG2 帧栈方案的回归。正确修法在 set trap 侧: 通知前重读落盘后
 * 的 target[key] 实际值参与变化比较 (见 G3 批次)。
 */
describe("转发窗口已知限制: 同 {target,key} 的用户 defineProperty 不可区分 (G3)", () => {
  test("LIMITATION(base): setter 同 key defineProperty 翻倍落盘, 赋值值恰等于旧值 → 丢通知", () => {
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
    // documented limitation: 值已变 20, reaction 未被通知 (仍停留在 10)
    expect(obj.x).toBe(20);
    expect(calls).toBe(1);
    expect(seen).toBe(10);
  });

  test("LIMITATION(shadow): shadow handler 上同场景同样丢通知", () => {
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
    expect(calls).toBe(1); // documented limitation: 丢通知
    expect(seen).toBe(10);
  });

  test("对照: 后续赋值值不同于旧值时正常通知 (value !== oldValue 路径)", () => {
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
    obj.x = 1; // 赋值值 1 === 旧 getter 值 1 → 同上丢通知, x 已是 data 属性 10
    expect(obj.x).toBe(10);
    expect(calls).toBe(1);
    obj.x = 2; // 赋值值 2 !== 旧值 10 → set trap 正常通知 (x 已是 data 属性, 直接落盘 2)
    expect(calls).toBe(2);
    expect(seen).toBe(2);
  });

  test("LIMITATION(gg2-attack2 C1 形态): _v 支撑的 flag setter 同 key defineProperty v*10", () => {
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
    obj.flag = 1; // oldValue(经 getter)=1 === 赋值值 1 → 不通知; defineProperty 被帧吞
    expect(reads).toBe(1); // documented limitation: 丢通知
    expect(obj.flag).toBe(10);
  });
});

/*
 * 已知限制 #1b / #1c (GG2 对抗审查第 3 轮发现, 归 G3 值比较批次):
 *
 * #1b: 转发链中间层 observable 的同 {target,key} defineProperty 同样被帧吞。
 * 文档限制 #1 只 pin 了"正在被写的 observable 自身"; 实际上转发 walk 链上
 * 每一层 set trap 都压了帧 (child → middle → grandparent), setter 对**链上
 * 任何一层**的同 key defineProperty 都会命中该层自己的帧被透传, 且该层
 * set trap 因 receiver 不匹配提前返回不通知 → 中间层 reaction 丢通知。
 * master (无 defineProperty trap) 同场景同样丢通知, 非帧栈方案的回归。
 *
 * #1c: defineProperty trap 的通知守卫用 `descriptor.value !== undefined` 判定
 * "是数据描述符且值参与比较", 显式 `{ value: undefined }` 被当成"无值写入"
 * 跳过通知: 5 → undefined 的实际变化静默丢失 (对照: 普通赋值 obj.x = undefined
 * 走 set trap 的 value !== oldValue 比较会正常通知)。正确的判定是
 * `'value' in descriptor`。归 G3 值比较批次处理。
 */
describe("转发窗口已知限制: 链上中间层同 key define 与显式 undefined 值 (G3)", () => {
  test("LIMITATION(#1b): grandparent setter 对链上 middle 同 key defineProperty, middle reaction 丢通知", () => {
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
    // middle 的值确实变了 (k 从 undefined -> 5)...
    expect((middle as Record<string, unknown>).k).toBe(5);
    // ...但 middle 的 defineProperty 命中自身转发帧被透传, middle 的 set trap
    // 因 receiver 是 child 不通知 → documented limitation: middle reaction 丢通知
    expect(midCalls).toBe(1);
    // child 侧 (写入发起者) 仍单次通知
    expect(childCalls).toBe(2);
  });

  test("LIMITATION(#1c): Object.defineProperty 显式 { value: undefined } 覆盖旧值不通知 (对照 set trap 正常)", () => {
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
    // documented limitation: 值已从 5 变为 undefined, 通知被
    // `descriptor.value !== undefined` 守卫跳过
    expect(obj.x).toBeUndefined();
    expect(calls).toBe(1);
    expect(seen).toBe(5);

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
});

/*
 * 已知限制 #2 (转交 G3/G7): defineProperty trap 捕获 oldValue 时以
 * this=raw 调用 getter, 副作用型 getter 内对 this (raw) 的
 * Object.defineProperty 直接改 raw 对象、完全绕过 proxy trap,
 * 转发窗口内外都丢通知。与 GG2 帧栈无关 (窗口外同样发生)。
 * 建议 G3/G7: oldValue 捕获仅对 data descriptor 读旧值,
 * accessor 情况标记 unknown 强制通知。
 */
describe("已知限制: defineProperty trap oldValue 捕获的 getter 副作用绕过 trap (G3/G7)", () => {
  test("LIMITATION: 武装的 lazy getter 在 oldValue 读取时 defineProperty(raw) → 窗口外丢通知", () => {
    let armed = false;
    const obj: any = observable({});
    Object.defineProperty(obj, "lazy", {
      configurable: true,
      enumerable: true,
      get() {
        if (armed) {
          // this 是 raw (oldValue 捕获路径) 或 proxy (正常 get 路径):
          // oldValue 捕获时 this=raw, defineProperty 落在 raw 上不经过 trap
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
    // documented limitation: 值已变 777, reaction 未被通知
    expect(calls).toBe(1);
    expect(seen).toBe(1);
  });
});
