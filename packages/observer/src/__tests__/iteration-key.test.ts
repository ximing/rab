/*
 * 回归测试: 数组迭代依赖的注册/通知 key 必须对称
 *
 * 背景 bug (两个症状，同一根因):
 * 1. registerReactionForOperation 注册 iterate 依赖时永远用 ITERATION_KEY symbol,
 *    而 getReactionsForOperation 通知时对数组用 "length" —— 两者永不相交,
 *    导致 Object.keys(arr) / for...in / 展开等枚举依赖在 push/delete 时失灵。
 * 2. arr.length = N (收缩) 时, 读 arr[i] 的 reaction 依赖在 index key 上,
 *    只有 key="length" 的依赖被通知 —— 直接索引读取的 reaction 读到脏数据。
 */
import { observable, observe } from '../main';

describe('数组迭代依赖 key 对称性', () => {
  test('Object.keys(arr) 依赖应在 push 时触发', () => {
    const arr = observable([1, 2]);
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(arr).length);
    });
    expect(seen).toEqual([2]);
    arr.push(3);
    expect(seen).toEqual([2, 3]);
  });

  test('Object.keys(arr) 依赖应在 delete 时触发', () => {
    const arr = observable([1, 2, 3]);
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(arr).length);
    });
    expect(seen).toEqual([3]);
    delete (arr as unknown as Record<number, number>)[1];
    expect(seen).toEqual([3, 2]);
  });

  test('for...in 依赖应在 push 时触发', () => {
    const arr = observable(['a']);
    let runs = 0;
    observe(() => {
      let count = 0;
      // eslint-disable-next-line no-restricted-syntax
      for (const key in arr) {
        count += typeof key === 'string' ? 1 : 0;
      }
      runs = count;
    });
    expect(runs).toBe(1);
    arr.push('b');
    expect(runs).toBe(2);
  });

  test('length 收缩时应通知被删除索引的依赖 (arr.length = 0)', () => {
    const arr = observable([1, 2, 3, 4, 5]);
    const seen: unknown[] = [];
    observe(() => {
      seen.push(arr[4]);
    });
    expect(seen).toEqual([5]);
    arr.length = 0;
    expect(seen).toEqual([5, undefined]);
    expect(arr[4]).toBeUndefined();
  });

  test('length 收缩到中间值时应通知越界索引的依赖 (arr.length = 3)', () => {
    const arr = observable([1, 2, 3, 4, 5]);
    const seen: unknown[] = [];
    observe(() => {
      seen.push(arr[3]);
    });
    expect(seen).toEqual([4]);
    arr.length = 3;
    expect(seen).toEqual([4, undefined]);
  });

  test('length 增长不应错误通知现有索引依赖', () => {
    const arr = observable([1, 2]);
    const seen: unknown[] = [];
    observe(() => {
      seen.push(arr[0]);
    });
    expect(seen).toEqual([1]);
    arr.length = 10;
    expect(seen).toEqual([1]);
  });
});

describe('普通对象迭代依赖 (回归保护)', () => {
  test('Object.keys(obj) 依赖应在新增属性时触发', () => {
    const obj = observable({ a: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(obj).length);
    });
    expect(seen).toEqual([1]);
    (obj as unknown as Record<string, number>).b = 2;
    expect(seen).toEqual([1, 2]);
  });

  test('Object.keys(obj) 依赖应在删除属性时触发', () => {
    const obj = observable<{ a?: number; b?: number }>({ a: 1, b: 2 });
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(obj).length);
    });
    expect(seen).toEqual([2]);
    delete obj.b;
    expect(seen).toEqual([2, 1]);
  });
});
