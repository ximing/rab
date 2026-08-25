import { observable, observe, shadowObservable } from '../main';

/*
 * #10: clear() 此前无条件在通知前 new Map(target)/new Set(target) 做全量拷贝
 * 作为 operation.oldValue —— 热路径 O(n) 浪费。oldValue 的唯一消费者是
 * reaction.debugger (如 @rabjs/react 的 debuggerReaction)。
 *
 * 修复: 仅当本次 clear 的操作会到达某个 debugger 时才拷贝。
 * 语义不变: debugger 收到的 oldValue 仍是 clear 前的内容拷贝。
 *
 * "无 debugger 时不拷贝" 无法用 heap/性能断言可靠验证, 这里用实现路径验证:
 * 在 clear 期间替换 globalThis.Map/Set 为记录调用的 spy, 断言未发生以
 * target 为参数的拷贝构造 (正控制: 有 debugger 时确实发生)。
 * 注意 reaction 重注册会合法地 new Set(), 因此只看"带 target 参数"的构造。
 * */

describe('#10 clear oldValue is only copied when a debugger consumes it', () => {
  test('debugger receives a content copy of the pre-clear Map (deep)', () => {
    const raw = new Map<string, number>([['a', 1]]);
    const m = observable(raw);
    const clearOps: Array<{ oldValue?: unknown }> = [];
    observe(() => m.get('a'), {
      debugger: operation => {
        if (operation.type === 'clear') {
          clearOps.push({ oldValue: operation.oldValue });
        }
      },
    });

    const before = new Map(raw);
    m.clear();
    expect(clearOps).toHaveLength(1);
    expect(clearOps[0].oldValue).toEqual(before);
    expect((clearOps[0].oldValue as Map<string, number>).get('a')).toBe(1);
  });

  test('debugger receives a content copy of the pre-clear Set (shadow path)', () => {
    const raw = new Set<number>([1, 2]);
    const s = shadowObservable(raw);
    const clearOps: Array<{ oldValue?: unknown }> = [];
    observe(() => s.has(1), {
      debugger: operation => {
        if (operation.type === 'clear') {
          clearOps.push({ oldValue: operation.oldValue });
        }
      },
    });

    s.clear();
    expect(clearOps).toHaveLength(1);
    expect(clearOps[0].oldValue).toEqual(new Set([1, 2]));
  });

  test('without a debugger consumer, Map clear performs no copy construction', () => {
    const raw = new Map<string, number>([
      ['a', 1],
      ['b', 2],
    ]);
    const m = observable(raw);
    let dummy: number | undefined;
    observe(() => (dummy = m.get('a')));
    expect(dummy).toBe(1);

    const RealMap = globalThis.Map;
    const ctorCalls: Array<Array<unknown>> = [];
    const SpyMap = function (this: unknown, iterable?: unknown) {
      ctorCalls.push([iterable]);
      return iterable === undefined
        ? new RealMap()
        : new RealMap(iterable as Iterable<readonly [unknown, unknown]>);
    } as unknown as MapConstructor;
    Object.defineProperty(SpyMap, 'prototype', { value: RealMap.prototype });
    (globalThis as { Map: MapConstructor }).Map = SpyMap;
    try {
      m.clear();
    } finally {
      (globalThis as { Map: MapConstructor }).Map = RealMap;
    }

    // reaction 正常触发, 集合被清空
    expect(dummy).toBe(undefined);
    expect(m.size).toBe(0);
    // 但没有以 target 为参数的 new Map(target) 拷贝发生
    expect(ctorCalls.some(([arg]) => arg === raw)).toBe(false);
  });

  test('positive control: with a debugger consumer, Map clear does copy', () => {
    const raw = new Map<string, number>([['a', 1]]);
    const m = observable(raw);
    observe(() => m.get('a'), {
      debugger: () => {
        /* debugger 消费者存在 */
      },
    });

    const RealMap = globalThis.Map;
    const ctorCalls: Array<Array<unknown>> = [];
    const SpyMap = function (this: unknown, iterable?: unknown) {
      ctorCalls.push([iterable]);
      return iterable === undefined
        ? new RealMap()
        : new RealMap(iterable as Iterable<readonly [unknown, unknown]>);
    } as unknown as MapConstructor;
    Object.defineProperty(SpyMap, 'prototype', { value: RealMap.prototype });
    (globalThis as { Map: MapConstructor }).Map = SpyMap;
    try {
      m.clear();
    } finally {
      (globalThis as { Map: MapConstructor }).Map = RealMap;
    }

    expect(m.size).toBe(0);
    // 以 target 为参数的拷贝构造恰好发生一次
    expect(ctorCalls.filter(([arg]) => arg === raw)).toHaveLength(1);
  });

  test('Set clear without debugger also skips the copy', () => {
    const raw = new Set<number>([1, 2, 3]);
    const s = observable(raw);
    let dummy: number | undefined;
    observe(() => (dummy = s.has(1) ? 1 : undefined));
    expect(dummy).toBe(1);

    const RealSet = globalThis.Set;
    const ctorCalls: Array<Array<unknown>> = [];
    const SpySet = function (this: unknown, iterable?: unknown) {
      ctorCalls.push([iterable]);
      return iterable === undefined ? new RealSet() : new RealSet(iterable as Iterable<unknown>);
    } as unknown as SetConstructor;
    Object.defineProperty(SpySet, 'prototype', { value: RealSet.prototype });
    (globalThis as { Set: SetConstructor }).Set = SpySet;
    try {
      s.clear();
    } finally {
      (globalThis as { Set: SetConstructor }).Set = RealSet;
    }

    expect(dummy).toBe(undefined);
    expect(s.size).toBe(0);
    expect(ctorCalls.some(([arg]) => arg === raw)).toBe(false);
  });
});
