/*
 * 回归测试: set trap 的 Reflect.set 转发标记必须按 target 区分 (target 栈),
 * 不能用模块级布尔误伤转发期间对"其他" observable 的 Object.defineProperty。
 *
 * 背景 bug: base/shadow 两个 proxy handler 用模块级 isForwardingSet 布尔标记
 * "正在做 Reflect.set 转发"。若原型链 setter 内部对另一个 observable 调
 * Object.defineProperty, 该 defineProperty trap 会误判为转发而跳过通知,
 * 导致对方的 reaction 静默失效 (跨 target 误伤)。
 *
 * 同时必须防住两类既有行为 (修复不能引入回归):
 * - 场景A: 自有属性赋值单次通知 (defineProperty trap 不重复通知)
 * - 场景B: 原型链赋值 child.count=1 单次通知 (转发链上定义回 child 不重复通知)
 *   这正是"记录单个转发 target"方案翻车的地方, 必须用栈。
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

describe("set 转发标记按 target 区分 (base handler)", () => {
  test("场景A: 自有属性赋值只通知一次", () => {
    const obj = observable({ count: 0 });
    let calls = 0;
    observe(() => {
      void obj.count;
      calls++;
    });
    expect(calls).toBe(1);

    obj.count = 1;
    expect(calls).toBe(2); // delta = 1, 不是 3 (defineProperty trap 不得重复通知)
    expect(obj.count).toBe(1);
  });

  test("场景B: 原型链赋值只通知一次 (child = observable(Object.create(parent)))", () => {
    const parent = observable({ count: 0 });
    const child = observable(Object.create(parent) as { count: number });
    let calls = 0;
    observe(() => {
      void child.count;
      calls++;
    });
    expect(calls).toBe(1);

    child.count = 1;
    expect(calls).toBe(2); // delta = 1, 不得出现双通知
    expect(child.count).toBe(1);
    // 写入按规范落在 receiver (child) 上, parent 的原始对象不受影响
    expect(parent.count).toBe(0);
  });

  test("场景C: 原型链 setter 内对另一个 observable defineProperty, 对方 reaction 必须触发", () => {
    const other = observable({ x: 0 });
    const proto = observable({
      set flag(v: number) {
        defineValue(other, "x", v);
      },
    });
    const child = observable(
      Object.create(proto) as { flag: number }
    );
    let calls = 0;
    observe(() => {
      void other.x;
      calls++;
    });
    expect(calls).toBe(1);

    child.flag = 1;
    expect(other.x).toBe(1);
    expect(calls).toBe(2); // 布尔标记会把这次 defineProperty 误判为转发而丢失通知
  });

  test("场景C': 直接对带 setter 的 observable 赋值, setter 内对另一个 observable defineProperty 也必须通知", () => {
    const other = observable({ x: 0 });
    const obj = observable({
      set flag(v: number) {
        defineValue(other, "x", v);
      },
    });
    let calls = 0;
    observe(() => {
      void other.x;
      calls++;
    });
    expect(calls).toBe(1);

    obj.flag = 1;
    expect(other.x).toBe(1);
    expect(calls).toBe(2);
  });
});

describe("set 转发标记按 target 区分 (shadow handler)", () => {
  test("场景A: 自有属性赋值只通知一次", () => {
    const obj = shadowObservable({ count: 0 });
    let calls = 0;
    observe(() => {
      void obj.count;
      calls++;
    });
    expect(calls).toBe(1);

    obj.count = 1;
    expect(calls).toBe(2); // delta = 1
    expect(obj.count).toBe(1);
  });

  test("场景C: 原型链 setter 内对另一个 shadowObservable defineProperty, 对方 reaction 必须触发", () => {
    const other = shadowObservable({ x: 0 });
    const proto = shadowObservable({
      set flag(v: number) {
        defineValue(other, "x", v);
      },
    });
    const child = shadowObservable(
      Object.create(proto) as { flag: number }
    );
    let calls = 0;
    observe(() => {
      void other.x;
      calls++;
    });
    expect(calls).toBe(1);

    child.flag = 1;
    expect(other.x).toBe(1);
    expect(calls).toBe(2);
  });
});
