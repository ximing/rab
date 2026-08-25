/*
 * 回归测试: Object.defineProperty 对 observable 的修改必须触发 reactions
 *
 * 背景 bug: handlers 里没有 defineProperty trap, defineProperty 的默认转发
 * 直接把属性写到 raw target 上, 完全绕过 set trap 的通知逻辑,
 * 已注册的 reaction 不会被触发 (静默失效)。
 */
import { observable, observe } from '../main';

describe('Object.defineProperty 触发通知', () => {
  test('defineProperty 定义新属性应通知 get 依赖', () => {
    const obj = observable<{ prop?: number }>({});
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.prop);
    });
    expect(seen).toEqual([undefined]);

    Object.defineProperty(obj, 'prop', {
      value: 42,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    expect(obj.prop).toBe(42);
    expect(seen).toEqual([undefined, 42]);
  });

  test('defineProperty 修改已有属性值应通知 get 依赖', () => {
    const obj = observable({ prop: 1 });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.prop);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'prop', {
      value: 2,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    expect(seen).toEqual([1, 2]);
  });

  test('defineProperty 新增属性应通知迭代依赖', () => {
    const obj = observable<{ a?: number; b?: number }>({ a: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(obj).length);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'b', {
      value: 2,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    expect(seen).toEqual([1, 2]);
  });

  test('defineProperty 定义的 getter 应保持响应式读取', () => {
    const obj = observable<{ base: number; doubled?: number }>({
      base: 1,
    });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.doubled);
    });
    expect(seen).toEqual([undefined]);

    Object.defineProperty(obj, 'doubled', {
      get() {
        return obj.base * 2;
      },
      enumerable: true,
      configurable: true,
    });

    expect(seen).toEqual([undefined, 2]);
  });

  test('defineProperty 返回值与透传行为不变', () => {
    const obj = observable<{ prop?: number }>({});
    const result = Object.defineProperty(obj, 'prop', {
      value: 7,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    expect(result).toBe(obj);
    expect(Object.getOwnPropertyDescriptor(obj, 'prop')?.value).toBe(7);
  });
});
