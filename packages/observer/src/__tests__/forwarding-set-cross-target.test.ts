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
import { observable, observe, shadowObservable } from '../main';

function defineValue(obj: object, key: string, value: number) {
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

describe('set 转发标记按 target 区分 (base handler)', () => {
  test('场景A: 自有属性赋值只通知一次', () => {
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

  test('场景B: 原型链赋值只通知一次 (child = observable(Object.create(parent)))', () => {
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

  test('场景C: 原型链 setter 内对另一个 observable defineProperty, 对方 reaction 必须触发', () => {
    const other = observable({ x: 0 });
    const proto = observable({
      set flag(v: number) {
        defineValue(other, 'x', v);
      },
    });
    const child = observable(Object.create(proto) as { flag: number });
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
        defineValue(other, 'x', v);
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

describe('转发检测必须按 {target, key} 匹配, 不得按裸 target 吞掉同 target 异 key 的 defineProperty (base handler)', () => {
  // 第 1 轮对抗审查发现: target 栈方案下, 转发窗口内对"栈中 target"的无关 key
  // defineProperty 仍被静默吞掉 (值已变、reaction 未通知)。
  // Reflect.set 路由回的 defineProperty 必然携带 set 帧正在写的同一个 key,
  // 因此栈元素必须是 {target, key} 对, 而不是裸 target。

  test('自有 setter 内对同 target 另一个 key defineProperty: 被观察 key 必须通知', () => {
    const obj = observable({
      cache: 0,
      set flag(v: number) {
        defineValue(obj, 'cache', v);
      },
    });
    let calls = 0;
    observe(() => {
      void obj.cache;
      calls++;
    });
    expect(calls).toBe(1);

    obj.flag = 42;
    expect(obj.cache).toBe(42);
    expect(calls).toBe(2); // 裸 target 栈会误判为转发而丢通知 (calls 停在 1)
  });

  test('三层链 setter 内对中间层 observable 的异 key defineProperty: 必须通知', () => {
    const middle = observable({ side: 0 });
    const parent = observable({
      set flag(v: number) {
        defineValue(middle, 'side', v);
      },
    });
    Object.setPrototypeOf(middle, parent);
    const child = observable(Object.create(middle) as { flag: number });
    let sideCalls = 0;
    observe(() => {
      void middle.side;
      sideCalls++;
    });
    expect(sideCalls).toBe(1);

    child.flag = 7;
    expect(middle.side).toBe(7);
    expect(sideCalls).toBe(2); // middle 的 target 因写入链路过而在栈中, 但 key 不同, 不得吞掉
  });

  test('自有 setter 内对自身另一个 key defineProperty: 必须通知', () => {
    const parent = observable({
      side: 0,
      set flag(v: number) {
        defineValue(parent, 'side', v);
      },
    });
    let calls = 0;
    observe(() => {
      void parent.side;
      calls++;
    });
    expect(calls).toBe(1);

    parent.flag = 9;
    expect(parent.side).toBe(9);
    expect(calls).toBe(2);
  });

  test('child 的 set 帧在栈中时, setter 内对 child 自身异 key defineProperty: 必须通知', () => {
    const child2 = observable({ a: 0 }) as {
      a: number;
      b?: number;
      flag?: number;
    };
    const proto2 = observable({
      set flag(v: number) {
        defineValue(child2, 'b', v);
      },
    });
    Object.setPrototypeOf(child2, proto2);
    let calls = 0;
    observe(() => {
      void child2.b;
      calls++;
    });
    expect(calls).toBe(1);

    child2.flag = 1;
    expect(child2.b).toBe(1);
    expect(calls).toBe(2);
  });
});

describe('set 转发标记按 target 区分 (shadow handler)', () => {
  test('场景A: 自有属性赋值只通知一次', () => {
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

  test('场景C: 原型链 setter 内对另一个 shadowObservable defineProperty, 对方 reaction 必须触发', () => {
    const other = shadowObservable({ x: 0 });
    const proto = shadowObservable({
      set flag(v: number) {
        defineValue(other, 'x', v);
      },
    });
    const child = shadowObservable(Object.create(proto) as { flag: number });
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

  test('场景B: 原型链赋值只通知一次 (child = shadowObservable(Object.create(parent)))', () => {
    const parent = shadowObservable({ count: 0 });
    const child = shadowObservable(Object.create(parent) as { count: number });
    let calls = 0;
    observe(() => {
      void child.count;
      calls++;
    });
    expect(calls).toBe(1);

    child.count = 1;
    expect(calls).toBe(2); // delta = 1, 不得出现双通知
    expect(child.count).toBe(1);
    expect(parent.count).toBe(0);
  });

  test('自有 setter 内对同 target 另一个 key defineProperty: 被观察 key 必须通知', () => {
    const obj = shadowObservable({
      cache: 0,
      set flag(v: number) {
        defineValue(obj, 'cache', v);
      },
    });
    let calls = 0;
    observe(() => {
      void obj.cache;
      calls++;
    });
    expect(calls).toBe(1);

    obj.flag = 42;
    expect(obj.cache).toBe(42);
    expect(calls).toBe(2); // 裸 target 栈会误判为转发而丢通知 (calls 停在 1)
  });

  test('child 的 set 帧在栈中时, setter 内对 child 自身异 key defineProperty: 必须通知', () => {
    const child2 = shadowObservable({ a: 0 }) as {
      a: number;
      b?: number;
      flag?: number;
    };
    const proto2 = shadowObservable({
      set flag(v: number) {
        defineValue(child2, 'b', v);
      },
    });
    Object.setPrototypeOf(child2, proto2);
    let calls = 0;
    observe(() => {
      void child2.b;
      calls++;
    });
    expect(calls).toBe(1);

    child2.flag = 1;
    expect(child2.b).toBe(1);
    expect(calls).toBe(2);
  });
});
