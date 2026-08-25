/*
 * 加固测试 (对抗审查 GG2): set 转发 target 栈的重入/异常/混合 handler 语义。
 * 全部断言当前正确行为, 防止后续改动回归:
 * - setter 抛异常后栈必须被 finally 清空, 通知机制立即恢复;
 * - 三层原型链赋值仍单次通知且值落在最外层 receiver;
 * - base/shadow 混合原型链下, shadow setter 内对 base observable 的
 *   defineProperty 通知不受另一 handler 模块栈的干扰;
 * - 转发窗口内对另一 observable 的普通赋值 (set trap 路径) 单次通知。
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

describe('set 转发 target 栈: 重入与异常安全', () => {
  test('setter 抛异常后, defineProperty 通知与普通赋值立即恢复 (栈不残留)', () => {
    const obj = observable({ x: 0 });
    const proto = observable({
      set boom(v: number) {
        throw new Error('setter boom');
      },
    });
    const child = observable(Object.create(proto) as { boom: number });
    expect(() => {
      child.boom = 1;
    }).toThrow('setter boom');

    // 异常后正常 defineProperty 通知 (若栈残留会误判为转发而静默)
    let calls = 0;
    observe(() => {
      void obj.x;
      calls++;
    });
    defineValue(obj, 'x', 5);
    expect(calls).toBe(2);

    // 异常后普通赋值仍单次通知
    const o2 = observable({ a: 0 });
    let calls2 = 0;
    observe(() => {
      void o2.a;
      calls2++;
    });
    o2.a = 1;
    expect(calls2).toBe(2);
  });

  test('三层原型链赋值仍单次通知, 值落在最外层 receiver', () => {
    const gp = observable({ v: 0 });
    const p = observable(Object.create(gp) as { v: number });
    const c = observable(Object.create(p) as { v: number });
    let calls = 0;
    observe(() => {
      void c.v;
      calls++;
    });
    c.v = 1;
    expect(calls).toBe(2);
    expect(c.v).toBe(1);
    expect(p.v).toBe(0);
    expect(gp.v).toBe(0);
  });

  test('shadow setter 内对 base observable defineProperty: 两模块栈互不干扰', () => {
    const baseOther = observable({ x: 0 });
    const sproto = shadowObservable({
      set flag(v: number) {
        defineValue(baseOther, 'x', v);
      },
    });
    const schild = shadowObservable(Object.create(sproto) as { flag: number });
    let calls = 0;
    observe(() => {
      void baseOther.x;
      calls++;
    });
    schild.flag = 1;
    expect(baseOther.x).toBe(1);
    expect(calls).toBe(2);
  });

  test('转发窗口内对另一 observable 普通赋值 (set trap 路径) 单次通知', () => {
    const other = observable({ x: 0 });
    const proto = observable({
      set flag(v: number) {
        other.x = v;
      },
    });
    const child = observable(Object.create(proto) as { flag: number });
    let calls = 0;
    observe(() => {
      void other.x;
      calls++;
    });
    child.flag = 1;
    expect(other.x).toBe(1);
    expect(calls).toBe(2);
  });
});
