/*
 * 加固测试 (对抗审查 GG2 回归镜头): 显式 receiver 路由与混合 handler 链下,
 * 转发帧必须按 {target, key} 精确匹配, 不得吞掉 receiver 上的定义回通知。
 *
 * 这些场景在旧的模块级布尔方案下会退化为 "零通知" (defineProperty trap 被
 * 误判为转发而透传, 而 set trap 又因 receiver 不匹配提前返回不通知):
 * - Reflect.set(parentObs, key, v, childObs): 写入按规范落在 receiver(child) 的
 *   defineProperty trap 上, child 的 reaction 必须收到恰好一次通知;
 * - Symbol key 的原型链转发单次通知;
 * - shadow child -> base parent 混合链: 转发定义回走的是 receiver (shadow) 模块的
 *   defineProperty trap, 必须命中 shadow 模块栈中由 shadow set trap 压入的外层帧;
 * - null 原型对象首写走 Receiver.[[DefineOwnProperty]] 直达路径, 单次通知。
 */
import { observable, observe, shadowObservable } from '../main';

describe('转发帧按 {target,key} 匹配: receiver 路由与混合链', () => {
  test('Reflect.set(parent, key, v, child): 通知恰好落在 child 一次, parent 不通知', () => {
    const parent = observable({ count: 0 });
    const child = observable(Object.create(parent) as { count: number });
    let childCalls = 0;
    observe(() => {
      void child.count;
      childCalls++;
    });
    let parentCalls = 0;
    observe(() => {
      void parent.count;
      parentCalls++;
    });
    expect(childCalls).toBe(1);
    expect(parentCalls).toBe(1);

    const ok = Reflect.set(parent, 'count', 5, child);
    expect(ok).toBe(true);
    // 布尔方案下这里会是 childCalls=1 (通知被吞), 若 frame 误匹配则 3 (双通知)
    expect(childCalls).toBe(2);
    expect(parentCalls).toBe(1);
    expect(child.count).toBe(5);
    expect(parent.count).toBe(0);
  });

  test('Symbol key 原型链转发: 单次通知且值落在 receiver', () => {
    const sym = Symbol('tracked');
    const parent = observable({ [sym]: 0 });
    const child = observable(Object.create(parent));
    let calls = 0;
    observe(() => {
      void (child as Record<symbol, number>)[sym];
      calls++;
    });
    expect(calls).toBe(1);

    (child as Record<symbol, number>)[sym] = 1;
    expect(calls).toBe(2);
    expect((child as Record<symbol, number>)[sym]).toBe(1);
    expect((parent as Record<symbol, number>)[sym]).toBe(0);
  });

  test('shadow child -> base parent 混合链: 单次通知 (shadow 模块栈命中外层帧)', () => {
    const baseParent = observable({ v: 0 });
    const sChild = shadowObservable(Object.create(baseParent) as { v: number });
    let calls = 0;
    observe(() => {
      void sChild.v;
      calls++;
    });
    expect(calls).toBe(1);

    sChild.v = 9;
    expect(calls).toBe(2);
    expect(sChild.v).toBe(9);
    expect(baseParent.v).toBe(0);
  });

  test('null 原型对象首写 (Receiver.[[DefineOwnProperty]] 直达路径): 单次通知', () => {
    const obj = observable(Object.create(null)) as { x?: number };
    let calls = 0;
    observe(() => {
      void obj.x;
      calls++;
    });
    expect(calls).toBe(1);

    obj.x = 1;
    expect(calls).toBe(2);
    expect(obj.x).toBe(1);
  });
});
