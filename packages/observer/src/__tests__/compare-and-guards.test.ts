/*
 * 回归测试 (G3): 值比较语义与写入失败守卫
 *
 * 1. 【#2 NaN/±0】所有 "值变化" 判断必须用 Object.is 而不是 !==:
 *    - NaN 连写不误通知 (NaN !== NaN 为 true, 但 Object.is(NaN, NaN) 为 true);
 *    - +0 → -0 是真实变化, 必须通知 (=== 视为同值, Object.is 区分)。
 * 2. 【#3 accessor 重定义静默】defineProperty 把数据属性重定义为 accessor
 *    (或反向), 以及 accessor 的 get/set 变化, 都不得静默, 必须以 type "set" 通知。
 * 3. 【NEW-B 幽灵通知】Reflect.set / Reflect.deleteProperty 返回 false
 *    (frozen / non-extensible 等写入未生效) 时不得入队通知。
 */
import { observable, observe, shadowObservable } from '../main';

describe('#2 NaN/±0: Object.is 变更判断', () => {
  test('对象属性连写 NaN 不误通知 (base)', () => {
    const obj = observable({ x: NaN });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([NaN]);

    obj.x = NaN; // Object.is(NaN, NaN) === true → 无变化, 不得通知
    expect(seen.length).toBe(1);

    obj.x = 1; // 真实变化要通知
    expect(seen).toEqual([NaN, 1]);
  });

  test('对象属性连写 NaN 不误通知 (shadow)', () => {
    const obj = shadowObservable({ x: NaN });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([NaN]);

    obj.x = NaN;
    expect(seen.length).toBe(1);

    obj.x = 1;
    expect(seen).toEqual([NaN, 1]);
  });

  test('+0 → +0 不通知, +0 → -0 要通知 (Object.is 语义)', () => {
    const obj = observable({ x: 0 });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([0]);

    obj.x = 0; // 同值不通知
    expect(seen.length).toBe(1);

    obj.x = -0; // Object.is(-0, +0) === false → 真实变化, 必须通知
    expect(seen.length).toBe(2);
    expect(Object.is(seen[1], -0)).toBe(true);
  });

  test('map.set 连写 NaN 不误通知 (base collection)', () => {
    const map = observable(new Map([['k', NaN]]));
    const seen: unknown[] = [];
    observe(() => {
      seen.push(map.get('k'));
    });
    expect(seen).toEqual([NaN]);

    map.set('k', NaN);
    expect(seen.length).toBe(1);

    map.set('k', 3);
    expect(seen).toEqual([NaN, 3]);
  });

  test('map.set 连写 NaN 不误通知 (shadow collection)', () => {
    const map = shadowObservable(new Map([['k', NaN]]));
    const seen: unknown[] = [];
    observe(() => {
      seen.push(map.get('k'));
    });
    expect(seen).toEqual([NaN]);

    map.set('k', NaN);
    expect(seen.length).toBe(1);

    map.set('k', 3);
    expect(seen).toEqual([NaN, 3]);
  });

  test('map.set +0 → -0 要通知 (Object.is 语义)', () => {
    const map = observable(new Map([['k', 0]]));
    const seen: unknown[] = [];
    observe(() => {
      seen.push(map.get('k'));
    });
    expect(seen).toEqual([0]);

    map.set('k', -0);
    expect(seen.length).toBe(2);
    expect(Object.is(seen[1], -0)).toBe(true);
  });
});

describe('#3 accessor 重定义不得静默', () => {
  test('数据属性重定义为 getter 后, 读取 reaction 必须触发 (base)', () => {
    const obj = observable({ x: 1 });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'x', {
      get() {
        return 999;
      },
      enumerable: true,
      configurable: true,
    });

    expect(seen).toEqual([1, 999]);
  });

  test('数据属性重定义为 getter 后, 读取 reaction 必须触发 (shadow)', () => {
    const obj = shadowObservable({ x: 1 });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'x', {
      get() {
        return 999;
      },
      enumerable: true,
      configurable: true,
    });

    expect(seen).toEqual([1, 999]);
  });

  test('accessor 重定义为数据属性 (值相同) 也要通知', () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, 'x', {
      get() {
        return 5;
      },
      enumerable: true,
      configurable: true,
    });
    const obj = observable(raw);
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([5]);

    Object.defineProperty(obj, 'x', {
      value: 5,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    expect(seen.length).toBe(2);
    expect(seen).toEqual([5, 5]);
  });

  test('getter 替换为不同的 getter 要通知', () => {
    const obj = observable({ y: 2 });
    const fn1 = (): number => 1;
    const fn2 = (): number => 2;
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.y);
    });
    expect(seen).toEqual([2]);

    Object.defineProperty(obj, 'y', {
      get: fn1,
      enumerable: true,
      configurable: true,
    });
    expect(seen).toEqual([2, 1]);

    Object.defineProperty(obj, 'y', {
      get: fn2,
      enumerable: true,
      configurable: true,
    });
    expect(seen).toEqual([2, 1, 2]);
  });

  test('重定义为相同的 getter 不通知 (防过度通知)', () => {
    const obj = observable({ y: 2 });
    const fn = (): number => 1;
    Object.defineProperty(obj, 'y', {
      get: fn,
      enumerable: true,
      configurable: true,
    });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.y);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'y', {
      get: fn,
      enumerable: true,
      configurable: true,
    });
    expect(seen.length).toBe(1);
  });
});

describe('NEW-B 写入失败不得发幽灵通知', () => {
  test('frozen 对象删除失败不通知, 值不变 (base)', () => {
    const obj = observable({ a: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.a);
    });
    expect(seen).toEqual([1]);

    Object.freeze(obj);
    expect(Reflect.deleteProperty(obj, 'a')).toBe(false);

    expect(seen).toEqual([1]);
    expect(obj.a).toBe(1);
  });

  test('frozen 对象删除失败不通知, 值不变 (shadow)', () => {
    const obj = shadowObservable({ a: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.a);
    });
    expect(seen).toEqual([1]);

    Object.freeze(obj);
    expect(Reflect.deleteProperty(obj, 'a')).toBe(false);

    expect(seen).toEqual([1]);
    expect(obj.a).toBe(1);
  });

  test('frozen 对象写入失败不通知, 值不变', () => {
    const obj = observable({ a: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.a);
    });
    expect(seen).toEqual([1]);

    Object.freeze(obj);
    expect(Reflect.set(obj, 'a', 5)).toBe(false);

    expect(seen).toEqual([1]);
    expect(obj.a).toBe(1);
  });

  test('non-extensible 对象新增属性失败不通知', () => {
    const obj = observable<{ a: number; b?: number }>({ a: 1 });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.b);
    });
    expect(seen).toEqual([undefined]);

    Object.preventExtensions(obj);
    expect(Reflect.set(obj, 'b', 2)).toBe(false);

    expect(seen).toEqual([undefined]);
    expect(obj.b).toBeUndefined();
  });
});
