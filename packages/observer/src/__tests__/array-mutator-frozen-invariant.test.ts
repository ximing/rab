/**
 * Issue #251 回归: 数组变异方法的 batch 包装 (#93) 曾先于 Proxy get 不变式
 * 检查执行 —— 对「不可配置 + 不可写」的自有函数属性 (如冻结的自有 push),
 * get trap 返回包装后的新函数, 引擎抛
 *   TypeError: 'get' on proxy: property 'push' is a read-only and
 *   non-configurable data property
 * 修复: 不变式检查先于 wrapIfArrayMutator, 冻结自有属性原样返回 raw 值。
 * base 与 shadow 两个 handler 的 wrap 块是逐字重复的, 两处都修。
 */

import { observable, shadowObservable, isObservable } from '../main';

function freezeOwnPush(arr: unknown[]): { arr: unknown[]; frozenPush: Function } {
  const frozenPush = function (this: unknown, ...items: unknown[]) {
    return Array.prototype.push.apply(arr, items);
  };
  Object.defineProperty(arr, 'push', {
    value: frozenPush,
    writable: false,
    configurable: false,
  });
  return { arr, frozenPush };
}

describe('issue #251: 冻结自有数组变异方法 vs Proxy get 不变式', () => {
  test('deep: 冻结的自有 push 读取不抛错, 且返回同一个函数对象', () => {
    const { arr, frozenPush } = freezeOwnPush([1, 2, 3]);
    const obs = observable(arr);
    expect(() => obs.push).not.toThrow();
    expect(obs.push).toBe(frozenPush);
    expect(arr.push).toBe(frozenPush);
    expect(obs.push).toBe(arr.push);
  });

  test('shadow: 冻结的自有 push 读取不抛错, 且返回同一个函数对象', () => {
    const { arr, frozenPush } = freezeOwnPush([1, 2, 3]);
    const obs = shadowObservable(arr);
    expect(() => obs.push).not.toThrow();
    expect(obs.push).toBe(frozenPush);
    expect(obs.push).toBe(arr.push);
  });

  test('deep: 冻结的自有 splice (非 push 的其它变异名) 同样原样返回', () => {
    const arr = [1, 2, 3];
    const frozenSplice = function () {
      return Array.prototype.splice.apply(arr, [0, 0] as never);
    };
    Object.defineProperty(arr, 'splice', {
      value: frozenSplice,
      writable: false,
      configurable: false,
    });
    const obs = observable(arr);
    expect(obs.splice).toBe(frozenSplice);
  });

  test('普通数组的原型变异方法仍被 batch 包装 (pin #93 行为)', () => {
    const obs = observable([1, 2, 3]);
    // 包装函数, 不是原型上的原函数 —— 这是 #93 的有意行为, 本修复不改变它
    expect(obs.push).not.toBe(Array.prototype.push);
    // WeakMap 缓存: 每次读取返回同一个包装函数 (身份稳定)
    expect(obs.push).toBe(obs.push);
    expect(typeof obs.push).toBe('function');
    // 包装后的调用仍生效
    obs.push(4);
    expect(obs.length).toBe(4);
    expect(obs[3]).toBe(4);
  });

  test('冻结自有 push 不影响同数组其它属性的深度包装', () => {
    const nested = { v: 1 };
    const { arr, frozenPush } = freezeOwnPush([nested]);
    const obs = observable(arr) as unknown as { 0: object; push: Function };
    expect(obs.push).toBe(frozenPush);
    expect(isObservable(obs[0])).toBe(true);
  });
});
