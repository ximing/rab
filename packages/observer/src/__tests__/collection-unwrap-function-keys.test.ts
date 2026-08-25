/**
 * GG5 第 1 轮对抗审查 follow-up：函数型 observable 的集合 key/value 解包
 *
 * 函数在本系统中是一等 observable（observable(fn) 返回 function proxy，
 * observableChild / shouldInstrument 均显式支持函数）。toRawIfProxy 之前用
 * isObject()（typeof === "object"）做守卫，函数（typeof === "function"）被
 * 跳过 —— proxy/raw 身份分裂对函数集合 key/value 依然存在：
 * 存 proxy 取 raw 失灵、依赖注册与通知落在不同身份上永久漏通知。
 */

import { observable, shadowObservable, observe, unobserve, raw } from '../main';

describe('function observable unwrapping in collections (GG5 review round 2)', () => {
  test('前置事实：函数是一等 observable', () => {
    const fn = function handler(): void {};
    const fnProxy = observable(fn);
    expect(typeof fnProxy).toBe('function');
    expect(fnProxy).not.toBe(fn);
    expect(raw(fnProxy)).toBe(fn);
  });

  describe('observable Map, 函数 key', () => {
    test('set 用 proxy，get/has/delete 用 raw 正常', () => {
      const fn = function handlerA(): void {};
      const fnProxy = observable(fn);
      const m = observable(new Map());
      m.set(fnProxy, 'x');
      expect(m.get(fn)).toBe('x');
      expect(m.has(fn)).toBe(true);
      expect(m.delete(fn)).toBe(true);
      expect(m.has(fn)).toBe(false);
    });

    test('set 用 raw，get/has/delete 用 proxy 正常', () => {
      const fn = function handlerB(): void {};
      const fnProxy = observable(fn);
      const m = observable(new Map());
      m.set(fn, 'v');
      expect(m.get(fnProxy)).toBe('v');
      expect(m.has(fnProxy)).toBe(true);
      expect(m.delete(fnProxy)).toBe(true);
      expect(m.size).toBe(0);
    });

    test('依赖对齐：observe get(rawFn) 后用 proxy set 新值必须触发（永久漏通知用例）', () => {
      const fn = function handlerC(): void {};
      const fnProxy = observable(fn);
      const m = observable(new Map());
      m.set(fn, 'a');
      const seen: unknown[] = [];
      const reaction = observe(() => {
        seen.push(m.get(fn));
      });
      expect(seen).toEqual(['a']);
      m.set(fnProxy, 'b');
      expect(seen).toEqual(['a', 'b']);
      unobserve(reaction);
    });
  });

  describe('observable Map/Set, 函数 value', () => {
    test("Map.set('k', fnProxy) 内部存 raw fn", () => {
      const fn = function handlerD(): void {};
      const fnProxy = observable(fn);
      const m = observable(new Map());
      m.set('cb', fnProxy);
      expect(raw(m).get('cb')).toBe(fn);
    });

    test('Set.add(fnProxy) 后 has/delete 用 raw 正常', () => {
      const fn = function handlerE(): void {};
      const fnProxy = observable(fn);
      const s = observable(new Set());
      s.add(fnProxy);
      expect(s.has(fn)).toBe(true);
      expect(s.delete(fn)).toBe(true);
      expect(s.has(fn)).toBe(false);
    });

    test('Set 依赖对齐：observe has(rawFn) 后 add(fnProxy) 必须触发', () => {
      const fn = function handlerF(): void {};
      const fnProxy = observable(fn);
      const s = observable(new Set());
      const seen: boolean[] = [];
      const reaction = observe(() => {
        seen.push(s.has(fn));
      });
      expect(seen).toEqual([false]);
      s.add(fnProxy);
      expect(seen).toEqual([false, true]);
      unobserve(reaction);
    });
  });

  describe('observable WeakMap, 函数 key', () => {
    test('set 用 proxy，get/has/delete 用 raw 正常', () => {
      const fn = function handlerG(): void {};
      const fnProxy = observable(fn);
      const wm = observable(new WeakMap());
      wm.set(fnProxy, 7);
      expect(wm.get(fn)).toBe(7);
      expect(wm.has(fn)).toBe(true);
      expect(wm.delete(fn)).toBe(true);
      expect(wm.has(fn)).toBe(false);
    });
  });

  describe('shadowObservable 集合, 函数 key/value', () => {
    test('shadow Map set 用 proxy，get/has/delete 用 raw 正常', () => {
      const fn = function handlerH(): void {};
      const fnProxy = observable(fn);
      const m = shadowObservable(new Map());
      m.set(fnProxy, 'x');
      expect(m.get(fn)).toBe('x');
      expect(m.has(fn)).toBe(true);
      expect(m.delete(fn)).toBe(true);
      expect(m.size).toBe(0);
    });

    test('shadow Map 依赖对齐：observe get(rawFn) 后用 proxy set 必须触发', () => {
      const fn = function handlerI(): void {};
      const fnProxy = observable(fn);
      const m = shadowObservable(new Map());
      m.set(fn, 'a');
      const seen: unknown[] = [];
      const reaction = observe(() => {
        seen.push(m.get(fn));
      });
      expect(seen).toEqual(['a']);
      m.set(fnProxy, 'b');
      expect(seen).toEqual(['a', 'b']);
      unobserve(reaction);
    });

    test("shadow Map.set('k', fnProxy) 内部存 raw fn", () => {
      const fn = function handlerJ(): void {};
      const fnProxy = observable(fn);
      const m = shadowObservable(new Map());
      m.set('cb', fnProxy);
      expect(raw(m).get('cb')).toBe(fn);
    });

    test('shadow Set.add(fnProxy) 后 has/delete 用 raw 正常', () => {
      const fn = function handlerK(): void {};
      const fnProxy = observable(fn);
      const s = shadowObservable(new Set());
      s.add(fnProxy);
      expect(s.has(fn)).toBe(true);
      expect(s.delete(fn)).toBe(true);
      expect(s.has(fn)).toBe(false);
    });
  });

  test('非 proxy 函数与原始值不受解包影响', () => {
    const plainFn = function plain(): number {
      return 1;
    };
    const m = observable(new Map());
    m.set(plainFn, 'p');
    expect(m.get(plainFn)).toBe('p');
    m.set('s', 1);
    expect(m.get('s')).toBe(1);
    m.set('n', null);
    expect(m.get('n')).toBeNull();
  });
});
