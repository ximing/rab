/*
 * 加固测试 (GG3 对抗审查轮): 值比较与通知守卫的边界行为
 *
 * 覆盖本轮对抗审查实际验证过的点:
 * - sealed / preventExtensions 下的失败写入与同值写入
 * - getter-only accessor 写入: spec 下 Reflect.set 返回 false, 不得有幽灵通知
 * - Symbol key 的 NaN 静默与 accessor 翻转通知
 * - Map undefined 同值静默 / Set 的 +0/-0 SameValueZero 语义
 * - 超大数组索引新增通知迭代依赖
 *
 * 以及一个已确认的回归 (test.failing 固定, 修复后请翻转为普通断言):
 * - accessor 属性写入 undefined 时完全静默 —— set trap 的落盘值比较退化为
 *   Object.is(value, undefined), value 为 undefined 时与 accessor 旧值
 *   (恒为 undefined) 相等, 真实变化 (getter 语义/背域值变化) 被吞掉。
 *   master 上该场景会通知 (oldValue 经 getter 读到真实旧值)。
 */
import { observable, observe, shadowObservable } from '../main';

describe('GG3 加固: 失败/同值写入守卫', () => {
  test('sealed 对象: 同值写入静默, 真实变化通知, 新增失败无幽灵通知', () => {
    const o = observable({ a: 1 });
    const seen: number[] = [];
    observe(() => seen.push(o.a));
    Object.seal(o);

    expect(Reflect.set(o, 'b', 2)).toBe(false);
    expect(Reflect.set(o, 'a', 1)).toBe(true); // 同值写入成功但无变化
    expect(seen).toEqual([1]);

    expect(Reflect.set(o, 'a', 9)).toBe(true); // sealed 仍 writable, 真实变化
    expect(seen).toEqual([1, 9]);
    expect(o.a).toBe(9);
  });

  test('preventExtensions + defineProperty 新增失败: 无幽灵 add 通知', () => {
    const o = observable<{ a: number; b?: number }>({ a: 1 });
    const seen: unknown[] = [];
    observe(() => seen.push(o.b));
    Object.preventExtensions(o);

    expect(
      Reflect.defineProperty(o, 'b', {
        value: 2,
        configurable: true,
        enumerable: true,
        writable: true,
      })
    ).toBe(false);
    expect(seen).toEqual([undefined]);
    expect(o.b).toBeUndefined();
  });

  test('getter-only accessor 写入: Reflect.set 返回 false, 无幽灵通知, 值不变', () => {
    const raw: Record<PropertyKey, unknown> = {};
    Object.defineProperty(raw, 'x', {
      get() {
        return 7;
      },
      configurable: true,
      enumerable: true,
    });
    const o = observable(raw);
    const seen: unknown[] = [];
    observe(() => seen.push(o.x));
    expect(seen).toEqual([7]);

    // spec OrdinarySetWithOwnDescriptor: accessor 无 setter -> [[Set]] 返回 false
    expect(Reflect.set(o, 'x', 100)).toBe(false);
    expect(seen).toEqual([7]);
    expect(o.x).toBe(7);
  });
});

describe('GG3 加固: Object.is / SameValueZero 边界', () => {
  test('Symbol key: NaN 连写静默, accessor 翻转通知', () => {
    const sym = Symbol('gg3');
    const o = observable({ [sym]: 1 });
    const seen: unknown[] = [];
    observe(() => seen.push(o[sym]));

    Object.defineProperty(o, sym, {
      get() {
        return 999;
      },
      configurable: true,
      enumerable: true,
    });
    expect(seen).toEqual([1, 999]);

    Object.defineProperty(o, sym, {
      value: NaN,
      configurable: true,
      writable: true,
      enumerable: true,
    });
    const len = seen.length;
    o[sym] = NaN;
    expect(seen.length).toBe(len);
  });

  test('map.set: undefined 同值静默, undefined -> 1 通知', () => {
    const m = observable(new Map<string, unknown>());
    const seen: unknown[] = [];
    observe(() => seen.push(m.get('k')));

    m.set('k', undefined); // add
    m.set('k', undefined); // Object.is(undefined, undefined) -> 静默
    expect(seen).toStrictEqual([undefined, undefined]);

    m.set('k', 1);
    expect(seen).toStrictEqual([undefined, undefined, 1]);
  });

  test('set.add: +0 与 -0 是同一成员 (SameValueZero), 重复添加不通知', () => {
    const s = observable(new Set<number>());
    let sizeRuns = 0;
    observe(() => {
      sizeRuns++;
      void s.size;
    });

    s.add(0);
    s.add(-0);
    expect(sizeRuns).toBe(2); // 初始 + 一次 add
  });

  test('超大 canonical 索引新增通知迭代依赖', () => {
    const arr = observable([1, 2]);
    let keysRuns = 0;
    observe(() => {
      keysRuns++;
      void Object.keys(arr);
    });
    arr[4294967294] = 5;
    expect(keysRuns).toBe(2);
  });
});

describe('GG3 已确认回归: accessor 属性写入 undefined 完全静默', () => {
  const setup = (make: () => Record<PropertyKey, unknown>) => {
    const o = make();
    const seen: unknown[] = [];
    observe(() => seen.push(o.x));
    return { o, seen };
  };

  // 修复 set trap 的落盘值比较后, 这些用例应翻转为普通 test 并全部通过:
  // 落盘后仍是 accessor 时, 不能用赋入值与 undefined 比较来判定"无变化"。
  test.failing('base: setter 更新背域值, 写入 undefined 必须通知', () => {
    const raw: Record<PropertyKey, unknown> = {};
    let backing: unknown = 1;
    Object.defineProperty(raw, 'x', {
      get: () => backing,
      set: (v: unknown) => {
        backing = v;
      },
      configurable: true,
      enumerable: true,
    });
    const { o, seen } = setup(() => observable(raw) as Record<PropertyKey, unknown>);
    expect(seen).toEqual([1]);

    o.x = undefined; // o.x 读取值 1 -> undefined, 真实变化
    expect(seen).toStrictEqual([1, undefined]); // toEqual 会忽略尾部的 undefined 元素
    expect(o.x).toBeUndefined();
  });

  test.failing('shadow: setter 更新背域值, 写入 undefined 必须通知', () => {
    const raw: Record<PropertyKey, unknown> = {};
    let backing: unknown = 1;
    Object.defineProperty(raw, 'x', {
      get: () => backing,
      set: (v: unknown) => {
        backing = v;
      },
      configurable: true,
      enumerable: true,
    });
    const { o, seen } = setup(() => shadowObservable(raw) as Record<PropertyKey, unknown>);
    o.x = undefined;
    expect(seen).toStrictEqual([1, undefined]);
    expect(o.x).toBeUndefined();
  });

  test.failing('setter 落盘 data:undefined (种类翻转), 写入必须通知', () => {
    const raw: Record<PropertyKey, unknown> = {};
    Object.defineProperty(raw, 'x', {
      get() {
        return 42;
      },
      set(v: unknown) {
        Object.defineProperty(raw, 'x', {
          value: v,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      },
      configurable: true,
      enumerable: true,
    });
    const { o, seen } = setup(() => observable(raw) as Record<PropertyKey, unknown>);
    expect(seen).toEqual([42]);

    o.x = undefined; // 读取语义 42 -> undefined, 且 accessor -> data 翻转
    expect(seen).toStrictEqual([42, undefined]);
    expect(o.x).toBeUndefined();
  });
});
