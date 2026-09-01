/**
 * 本文件是 observable() 集合类型（Map / Set / WeakMap / WeakSet）的公开行为契约。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 契约按业务可依赖的行为组织：
 * - Map/Set 的 has/get/set/add/delete/size 建立依赖并在变更时通知
 * - 全部迭代入口（keys/values/entries/forEach/Symbol.iterator）的依赖与通知
 * - clear 一次性触发所有依赖（只断言"触发"，不断言 oldValue 内容——那是内部实现）
 * - key/value 的 proxy 解包：proxy 存 raw 查、双向身份一致（G5）
 * - Map/Set 子类可被正常包装且响应式可用（G7）
 * - NaN key 的 SameValueZero 语义；NaN/同值连写不通知
 * - WeakMap/WeakSet：可追踪但不可枚举（key 可 GC 的真实 GC 行为由
 *   weak-keys-gc.test.ts 覆盖，此处只做文档级断言）
 * - ES2024 Set 方法（union/intersection/difference 等）deep 模式返回原始成员
 *   （README「已知限制」条目，钉当前行为）
 *
 * 已知限制的用例钉"当前行为 + 出处"，升级时若行为改善，这些用例失败是预期的、
 * 是好事：改断言 + changeset 注明即可。
 */

import { observable, observe, unobserve, raw, isObservable } from '../../main';
import { resetGlobalConfig } from '../../configure';

afterEach(() => {
  resetGlobalConfig();
});

describe('契约: Map 基础读写与依赖', () => {
  test('observable(new Map()) 仍是合法 Map 实例，raw() 取回原始 Map 且身份一致', () => {
    const rawMap = new Map<string, number>();
    const map = observable(rawMap);
    expect(map).toBeInstanceOf(Map);
    expect(raw(map)).toBe(rawMap);
    expect(isObservable(map)).toBe(true);
  });

  test('observe 中 map.get(key) 建立依赖：同 key 写入新值、删除该 key 都会重新执行', () => {
    const map = observable(new Map<string, number>());
    const seen: Array<number | undefined> = [];
    const reaction = observe(() => {
      seen.push(map.get('k'));
    });
    expect(seen).toEqual([undefined]);
    map.set('k', 1);
    expect(seen).toEqual([undefined, 1]);
    map.set('k', 2);
    expect(seen).toEqual([undefined, 1, 2]);
    map.delete('k');
    expect(seen).toEqual([undefined, 1, 2, undefined]);
    unobserve(reaction);
  });

  test('map.set(key, value) 返回集合代理自身，可链式调用', () => {
    const map = observable(new Map<string, number>());
    expect(map.set('a', 1).set('b', 2)).toBe(map);
    expect(map.get('b')).toBe(2);
  });

  test('observe 中 map.has(key) 建立依赖：新增 / 删除该 key 都会重新执行', () => {
    const map = observable(new Map<string, number>());
    const seen: boolean[] = [];
    const reaction = observe(() => {
      seen.push(map.has('k'));
    });
    expect(seen).toEqual([false]);
    map.set('k', 1);
    expect(seen).toEqual([false, true]);
    map.delete('k');
    expect(seen).toEqual([false, true, false]);
    unobserve(reaction);
  });

  test('observe 中 map.size 建立依赖：增删成员都会重新执行', () => {
    const map = observable(new Map<string, number>());
    const sizes: number[] = [];
    const reaction = observe(() => {
      sizes.push(map.size);
    });
    expect(sizes).toEqual([0]);
    map.set('a', 1);
    expect(sizes).toEqual([0, 1]);
    map.delete('a');
    expect(sizes).toEqual([0, 1, 0]);
    unobserve(reaction);
  });
});

describe('契约: Map/Set 同值写入不通知', () => {
  test('Map.set 写入与旧值相同的值（Object.is 相等）不触发 reaction', () => {
    const map = observable(new Map<string, number>());
    map.set('k', 1);
    const spy = jest.fn(() => map.get('k'));
    observe(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    map.set('k', 1);
    expect(spy).toHaveBeenCalledTimes(1);
    map.set('k', 2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('Map.set 连续写 NaN 值不触发 reaction（Object.is(NaN, NaN) 为 true）', () => {
    const map = observable(new Map<string, number>());
    map.set('k', NaN);
    const spy = jest.fn(() => map.get('k'));
    observe(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    map.set('k', NaN);
    expect(spy).toHaveBeenCalledTimes(1);
    map.set('k', 0);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('Map.delete 不存在的 key、Set.add 已有成员、clear 空集合都不触发 reaction', () => {
    const map = observable(new Map<string, number>());
    const mapSpy = jest.fn(() => map.get('k'));
    observe(mapSpy);
    map.delete('k');
    map.clear();
    expect(mapSpy).toHaveBeenCalledTimes(1);

    const set = observable(new Set<string>());
    const setSpy = jest.fn(() => set.has('v'));
    observe(setSpy);
    set.add('v');
    expect(setSpy).toHaveBeenCalledTimes(2);
    set.add('v');
    expect(setSpy).toHaveBeenCalledTimes(2);
    set.delete('v');
    set.delete('v');
    set.clear();
    expect(setSpy).toHaveBeenCalledTimes(3);
  });
});

describe('契约: NaN key 的 SameValueZero 语义', () => {
  test('NaN 作为 Map key：set 后 get/has/delete 均按 SameValueZero 命中，且依赖正常', () => {
    const map = observable(new Map<number, string>());
    const seen: Array<string | undefined> = [];
    const reaction = observe(() => {
      seen.push(map.get(NaN));
    });
    expect(seen).toEqual([undefined]);
    map.set(NaN, 'nan-value');
    expect(seen).toEqual([undefined, 'nan-value']);
    expect(map.has(NaN)).toBe(true);
    expect(map.delete(NaN)).toBe(true);
    expect(seen).toEqual([undefined, 'nan-value', undefined]);
    expect(map.has(NaN)).toBe(false);
    unobserve(reaction);
  });
});

describe('契约: Set 基础读写与依赖', () => {
  test('observable(new Set()) 仍是合法 Set 实例，raw() 取回原始 Set', () => {
    const rawSet = new Set<number>();
    const set = observable(rawSet);
    expect(set).toBeInstanceOf(Set);
    expect(raw(set)).toBe(rawSet);
  });

  test('observe 中 set.has(v) 建立依赖：add / delete 该成员都会重新执行', () => {
    const set = observable(new Set<string>());
    const seen: boolean[] = [];
    const reaction = observe(() => {
      seen.push(set.has('v'));
    });
    expect(seen).toEqual([false]);
    set.add('v');
    expect(seen).toEqual([false, true]);
    set.delete('v');
    expect(seen).toEqual([false, true, false]);
    unobserve(reaction);
  });

  test('observe 中 set.size 建立依赖：add / delete / clear 都会重新执行', () => {
    const set = observable(new Set<string>());
    const sizes: number[] = [];
    const reaction = observe(() => {
      sizes.push(set.size);
    });
    expect(sizes).toEqual([0]);
    set.add('a');
    expect(sizes).toEqual([0, 1]);
    set.delete('a');
    expect(sizes).toEqual([0, 1, 0]);
    set.add('b');
    set.clear();
    expect(sizes).toEqual([0, 1, 0, 1, 0]);
    unobserve(reaction);
  });

  test('set.add 返回集合代理自身，可链式调用', () => {
    const set = observable(new Set<number>());
    expect(set.add(1).add(2)).toBe(set);
    expect(set.has(2)).toBe(true);
  });
});

describe('契约: 迭代的依赖与通知', () => {
  test('for...of（Symbol.iterator）依赖：新增成员、删除成员、clear 都重新执行', () => {
    const map = observable(new Map<string, number>());
    const totals: number[] = [];
    const reaction = observe(() => {
      let sum = 0;
      for (const [, num] of map) {
        sum += num;
      }
      totals.push(sum);
    });
    expect(totals).toEqual([0]);
    map.set('a', 1);
    expect(totals).toEqual([0, 1]);
    map.set('b', 2);
    expect(totals).toEqual([0, 1, 3]);
    map.delete('a');
    expect(totals).toEqual([0, 1, 3, 2]);
    map.clear();
    expect(totals).toEqual([0, 1, 3, 2, 0]);
    unobserve(reaction);
  });

  test('keys() / values() / entries() / forEach 每个迭代入口都独立建立依赖并在成员增删时通知', () => {
    const map = observable(new Map<string, number>());
    const runs = { keys: 0, values: 0, entries: 0, forEach: 0 };
    const reactions = [
      observe(() => {
        for (const key of map.keys()) void key;
        runs.keys += 1;
      }),
      observe(() => {
        for (const num of map.values()) void num;
        runs.values += 1;
      }),
      observe(() => {
        for (const entry of map.entries()) void entry;
        runs.entries += 1;
      }),
      observe(() => {
        map.forEach(() => undefined);
        runs.forEach += 1;
      }),
    ];
    expect(runs).toEqual({ keys: 1, values: 1, entries: 1, forEach: 1 });
    map.set('a', 1);
    expect(runs).toEqual({ keys: 2, values: 2, entries: 2, forEach: 2 });
    map.delete('a');
    expect(runs).toEqual({ keys: 3, values: 3, entries: 3, forEach: 3 });
    reactions.forEach(unobserve);
  });

  test('Set 的 for...of / values() / keys() / entries() / forEach 迭代依赖在 add / delete / clear 时通知', () => {
    const set = observable(new Set<number>());
    const sizes: number[] = [];
    const reaction = observe(() => {
      let count = 0;
      for (const v of set) void v;
      for (const v of set.values()) void v;
      for (const v of set.keys()) void v;
      for (const e of set.entries()) void e;
      set.forEach(() => {
        count += 1;
      });
      sizes.push(count);
    });
    expect(sizes).toEqual([0]);
    set.add(1);
    expect(sizes).toEqual([0, 1]);
    set.clear();
    expect(sizes).toEqual([0, 1, 0]);
    unobserve(reaction);
  });

  test('已有 key 的值覆盖触发值侧迭代依赖，但不触发 Map.keys()（与 Vue 3 语义一致，#211）', () => {
    const map = observable(new Map<string, number>());
    map.set('k', 1);
    const iterateSpy = jest.fn(() => {
      map.forEach(() => undefined);
    });
    observe(iterateSpy);
    expect(iterateSpy).toHaveBeenCalledTimes(1);
    map.set('k', 2);
    // 值序列变了：值侧迭代依赖（forEach/values/entries）重跑
    expect(iterateSpy).toHaveBeenCalledTimes(2);
    const getSpy = jest.fn(() => map.get('k'));
    observe(getSpy);
    expect(getSpy).toHaveBeenCalledTimes(1);
    map.set('k', 3);
    expect(getSpy).toHaveBeenCalledTimes(2);
    // key 侧迭代不被值覆盖误触发
    const keysSpy = jest.fn(() => {
      void map.keys();
    });
    observe(keysSpy);
    expect(keysSpy).toHaveBeenCalledTimes(1);
    map.set('k', 4);
    expect(keysSpy).toHaveBeenCalledTimes(1);
    map.set('k2', 1);
    expect(keysSpy).toHaveBeenCalledTimes(2);
  });
});

describe('契约: clear 一次性触发所有依赖', () => {
  test('Map.clear() 同时触发 get / has / size / 迭代依赖（只断言触发，不断言 oldValue 内容）', () => {
    const map = observable(new Map<string, number>());
    map.set('a', 1);
    map.set('b', 2);
    const seen = { get: 0, has: 0, size: 0, iterate: 0 };
    const reactions = [
      observe(() => {
        void map.get('a');
        seen.get += 1;
      }),
      observe(() => {
        void map.has('b');
        seen.has += 1;
      }),
      observe(() => {
        void map.size;
        seen.size += 1;
      }),
      observe(() => {
        map.forEach(() => undefined);
        seen.iterate += 1;
      }),
    ];
    expect(seen).toEqual({ get: 1, has: 1, size: 1, iterate: 1 });
    map.clear();
    expect(seen).toEqual({ get: 2, has: 2, size: 2, iterate: 2 });
    expect(map.size).toBe(0);
    reactions.forEach(unobserve);
  });

  test('Set.clear() 同时触发 has / size / 迭代依赖', () => {
    const set = observable(new Set<string>());
    set.add('v');
    const seen = { has: 0, size: 0, iterate: 0 };
    const reactions = [
      observe(() => {
        void set.has('v');
        seen.has += 1;
      }),
      observe(() => {
        void set.size;
        seen.size += 1;
      }),
      observe(() => {
        set.forEach(() => undefined);
        seen.iterate += 1;
      }),
    ];
    set.clear();
    expect(seen).toEqual({ has: 2, size: 2, iterate: 2 });
    reactions.forEach(unobserve);
  });
});

describe('契约: key/value 的 proxy 解包与双向身份一致（G5）', () => {
  test('Map：用 proxy key 写入后，可用 raw key 读取 / 判断 / 删除（proxy 存 raw 查）', () => {
    const keyObj = { id: 1 };
    const proxyKey = observable(keyObj);
    const map = observable(new Map<object, number>());
    map.set(proxyKey, 42);
    expect(map.get(keyObj)).toBe(42);
    expect(map.has(keyObj)).toBe(true);
    expect(map.delete(keyObj)).toBe(true);
    expect(map.has(keyObj)).toBe(false);
  });

  test('Map：用 raw key 写入后，可用 proxy key 读取 / 删除（raw 存 proxy 查）', () => {
    const keyObj = { id: 2 };
    const proxyKey = observable(keyObj);
    const map = observable(new Map<object, string>());
    map.set(keyObj, 'v');
    expect(map.get(proxyKey)).toBe('v');
    expect(map.has(proxyKey)).toBe(true);
    expect(map.delete(proxyKey)).toBe(true);
    expect(map.size).toBe(0);
  });

  test('Map：依赖注册与通知落在同一身份上——观察 raw key 后用 proxy key 写入新值必须触发', () => {
    const keyObj = { id: 3 };
    const proxyKey = observable(keyObj);
    const map = observable(new Map<object, number>());
    map.set(keyObj, 1);
    const seen: number[] = [];
    const reaction = observe(() => {
      seen.push(map.get(keyObj) as number);
    });
    expect(seen).toEqual([1]);
    map.set(proxyKey, 2);
    expect(seen).toEqual([1, 2]);
    map.delete(proxyKey);
    expect(seen).toEqual([1, 2, undefined]);
    unobserve(reaction);
  });

  test('Set：add 传 proxy 后 has/delete 用 raw 正常，且观察 raw 成员后 add proxy 必须触发', () => {
    const item = { id: 4 };
    const itemProxy = observable(item);
    const set = observable(new Set<object>());
    const seen: boolean[] = [];
    const reaction = observe(() => {
      seen.push(set.has(item));
    });
    expect(seen).toEqual([false]);
    set.add(itemProxy);
    expect(seen).toEqual([false, true]);
    expect(set.has(item)).toBe(true);
    expect(set.delete(item)).toBe(true);
    expect(seen).toEqual([false, true, false]);
    unobserve(reaction);
  });

  test('Map 的 value 以 raw 落盘、读取返回稳定的 observable 包装（两次 get 身份一致）', () => {
    const valueObj = { deep: true };
    const valueProxy = observable(valueObj);
    const map = observable(new Map<string, object>());
    map.set('k', valueProxy);
    // 内部存储是 raw 对象
    expect(raw(map).get('k')).toBe(valueObj);
    // 读取返回 observable 包装，且走缓存——身份稳定
    expect(isObservable(map.get('k'))).toBe(true);
    expect(map.get('k')).toBe(map.get('k'));
    expect(map.get('k')).toEqual(valueObj);
  });

  test('Map 迭代 key 侧不包装（返回 raw）而 value 侧包装为 observable（当前行为，G5 审查留档）', () => {
    const keyObj = { flag: 0 };
    const valueObj = { v: 0 };
    const map = observable(new Map<object, object>());
    map.set(keyObj, valueObj);

    const iterKeys = [...map.keys()];
    expect(iterKeys[0]).toBe(keyObj);
    expect(isObservable(iterKeys[0])).toBe(false);

    const iterValues = [...map.values()];
    expect(isObservable(iterValues[0])).toBe(true);

    const [entryKey, entryValue] = [...map.entries()][0];
    expect(entryKey).toBe(keyObj);
    expect(isObservable(entryKey)).toBe(false);
    expect(isObservable(entryValue)).toBe(true);

    const [forOfKey, forOfValue] = [...map][0];
    expect(forOfKey).toBe(keyObj);
    expect(isObservable(forOfValue)).toBe(true);
  });

  test('Map 迭代返回的 raw key 上读属性不被追踪（当前行为，G5 留档的推论）：观察 key 属性请持有该 key 的 observable', () => {
    const keyObj = { flag: 0 };
    const keyProxy = observable(keyObj);
    const map = observable(new Map<object, number>());
    map.set(keyObj, 1);
    const spy = jest.fn(() => {
      const k = [...map.keys()][0] as { flag: number };
      void k.flag;
    });
    observe(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    keyProxy.flag = 1;
    // keys() 返回 raw，key 半边不在响应式图内——不触发是当前已知行为
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('Set keys/values/entries/iterator 成员身份一致且均包装（#192）', () => {
    const item = { id: 1 };
    const s = observable(new Set([item]));
    const fromKeys = [...s.keys()][0];
    const fromValues = [...s.values()][0];
    const [entryKey, entryValue] = [...s.entries()][0];
    const fromIter = [...s][0];

    expect(fromKeys).toBe(fromValues);
    expect(entryKey).toBe(entryValue);
    expect(fromKeys).toBe(fromIter);
    expect(fromKeys).toBe(entryKey);
    expect(isObservable(fromKeys)).toBe(true);
    expect(raw(fromKeys as object)).toBe(item);
  });

  test('经 Set.keys() 拿到的成员写入会通知（#192）', () => {
    const item = { id: 1 };
    const s = observable(new Set([item]));
    const seen: number[] = [];
    const reaction = observe(() => {
      seen.push(([...s.keys()][0] as { id: number }).id);
    });
    expect(seen).toEqual([1]);
    ([...s.keys()][0] as { id: number }).id = 2;
    expect(seen).toEqual([1, 2]);
    unobserve(reaction);
  });

  test('Set.forEach 的 value 与 key 是同一包装（#192）', () => {
    const item = { id: 1 };
    const s = observable(new Set([item]));
    let pairs = 0;
    s.forEach((value, key) => {
      expect(value).toBe(key);
      expect(isObservable(value)).toBe(true);
      expect(raw(value as object)).toBe(item);
      pairs++;
    });
    expect(pairs).toBe(1);
  });
});

describe('契约: deep Set 的 keys()/entries() 键是 proxy（#192/#256，钉当前行为）', () => {
  // #192 为恢复原生 Set 的 keys === values 身份，deep 模式 Set.keys()/
  // entries() 的键侧返回与 values 相同的 observable 包装。代价是与原始
  // 集合互操作时 proxy 键不能直接用（rawSet.has(proxyKey) === false）。
  // 决议（#256 option 1）是钉住当前行为而非改回 raw 键；逃生舱是
  // raw() 解包。若未来改回 raw 键，本组用例失败是预期的——
  // 改断言 + changeset 注明。
  test('Set.keys() 返回 proxy 键，与 values() 身份一致（#192）', () => {
    const keyObj = { id: 1 };
    const s = observable(new Set([keyObj]));
    const keys = [...s.keys()];
    const values = [...s.values()];
    expect(isObservable(keys[0])).toBe(true);
    expect(keys[0]).toBe(values[0]);
    expect(keys[0]).not.toBe(keyObj);
  });

  test('Set.entries() 两侧是同一 proxy（k === v）', () => {
    const keyObj = { id: 1 };
    const s = observable(new Set([keyObj]));
    const [entry] = [...s.entries()];
    expect(isObservable(entry[0])).toBe(true);
    expect(entry[0]).toBe(entry[1]);
  });

  test('逃生舱：raw() 可解包迭代返回的 proxy 键（raw(key) === 原始成员）', () => {
    const keyObj = { id: 1 };
    const s = observable(new Set([keyObj]));
    expect(raw([...s.keys()][0] as object)).toBe(keyObj);
    const [entry] = [...s.entries()];
    expect(raw(entry[0] as object)).toBe(keyObj);
    expect(raw(entry[1] as object)).toBe(keyObj);
  });

  test('proxy 键不能直接与原始集合互操作：raw(set).has(proxyKey) 为 false（已知互操作限制）', () => {
    const keyObj = { id: 1 };
    const s = observable(new Set([keyObj]));
    const proxyKey = [...s.keys()][0];
    // 原始集合内部按 raw 身份存储，proxy 是另一个对象身份。
    // 需要互操作时先 raw() 解包（见上条），或用代理自身的 has
    // （trap 入口自动解包入参）。
    const rawSet = raw(s) as Set<unknown>;
    expect(rawSet.has(proxyKey)).toBe(false);
    expect(rawSet.has(raw(proxyKey as object))).toBe(true);
    expect(s.has(proxyKey)).toBe(true);
  });
});

describe('契约: forEach 回调 thisArg 与第三参是 proxy（#191）', () => {
  test('Map.forEach 把 thisArg 作为 callback 的 this，第三参是 observable proxy', () => {
    const m = observable(new Map([['a', 1]]));
    const ctx = { tag: 1 };
    let gotThis: unknown;
    let third: unknown;
    m.forEach(function (this: unknown, _v, _k, map) {
      gotThis = this;
      third = map;
    }, ctx);
    expect(gotThis).toBe(ctx);
    expect(third).toBe(m);
    expect(isObservable(third)).toBe(true);
  });

  test('经 Map.forEach 第三参写入走 trap，依赖该 key 的 reaction 被通知', () => {
    const m = observable(new Map([['a', 1]]));
    const seen: number[] = [];
    const reaction = observe(() => {
      seen.push(m.get('a') as number);
    });
    expect(seen).toEqual([1]);
    m.forEach((_v, k, map) => {
      map.set(k, 99);
    });
    expect(m.get('a')).toBe(99);
    expect(seen).toEqual([1, 99]);
    unobserve(reaction);
  });

  test('Set.forEach 同样保留 thisArg，第三参是 proxy，经第三参 add 会通知', () => {
    const s = observable(new Set([1]));
    const ctx = { tag: 2 };
    let gotThis: unknown;
    let third: unknown;
    const seen: number[] = [];
    const reaction = observe(() => {
      seen.push(s.size);
    });
    expect(seen).toEqual([1]);
    s.forEach(function (this: unknown, _v, _k, set) {
      gotThis = this;
      third = set;
      set.add(2);
    }, ctx);
    expect(gotThis).toBe(ctx);
    expect(third).toBe(s);
    expect(s.has(2)).toBe(true);
    expect(seen).toEqual([1, 2]);
    unobserve(reaction);
  });

  test('thisArg 缺省时 callback 的 this 为 undefined（严格模式，对齐原生）', () => {
    const m = observable(new Map([['a', 1]]));
    let gotThis: unknown = 'unset';
    m.forEach(function (this: unknown) {
      gotThis = this;
    });
    expect(gotThis).toBeUndefined();
  });
});

describe('契约: Map/Set 子类可用（G7）', () => {
  test('extends Map 的子类实例被 observable() 包装后，全部集合操作响应式可用且不抛错', () => {
    class MyMap<K, V> extends Map<K, V> {}
    const map = observable(new MyMap<string, number>());
    expect(map).toBeInstanceOf(MyMap);
    const seen: Array<number | undefined> = [];
    const reaction = observe(() => {
      seen.push(map.get('a'));
    });
    expect(seen).toEqual([undefined]);
    expect(map.set('a', 1)).toBe(map);
    expect(seen).toEqual([undefined, 1]);
    expect(map.has('a')).toBe(true);
    expect(map.size).toBe(1);
    expect([...map.keys()]).toEqual(['a']);
    expect([...map.values()]).toEqual([1]);
    map.forEach(v => expect(v).toBe(1));
    expect(map.delete('a')).toBe(true);
    expect(seen).toEqual([undefined, 1, undefined]);
    unobserve(reaction);
  });

  test('extends Set 的子类实例被 observable() 包装后，add/has/delete/迭代响应式可用', () => {
    class MySet<V> extends Set<V> {}
    const set = observable(new MySet<number>());
    const seen: boolean[] = [];
    const reaction = observe(() => {
      seen.push(set.has(1));
    });
    expect(seen).toEqual([false]);
    set.add(1);
    expect(seen).toEqual([false, true]);
    expect([...set]).toEqual([1]);
    expect(set.size).toBe(1);
    set.delete(1);
    expect(seen).toEqual([false, true, false]);
    unobserve(reaction);
  });

  test('子类自定义方法仍被响应式拦截：内部 this.set 走代理路径并触发通知', () => {
    class MyMap<K, V> extends Map<K, V> {
      put(k: K, v: V) {
        this.set(k, v);
      }
    }
    const map = observable(new MyMap<string, number>());
    const seen: Array<number | undefined> = [];
    const reaction = observe(() => {
      seen.push(map.get('a'));
    });
    map.put('a', 7);
    expect(seen).toEqual([undefined, 7]);
    unobserve(reaction);
  });
});

describe('契约: WeakMap / WeakSet 可追踪但不可枚举', () => {
  test('WeakMap：observe 中 get/has 建立依赖，set 新值 / delete 都触发通知', () => {
    const key = { id: 1 };
    const wm = observable(new WeakMap<object, number>());
    const seen: Array<number | undefined> = [];
    const reaction = observe(() => {
      seen.push(wm.get(key));
    });
    expect(seen).toEqual([undefined]);
    wm.set(key, 1);
    expect(seen).toEqual([undefined, 1]);
    wm.set(key, 2);
    expect(seen).toEqual([undefined, 1, 2]);
    expect(wm.delete(key)).toBe(true);
    expect(seen).toEqual([undefined, 1, 2, undefined]);
    unobserve(reaction);
  });

  test('WeakSet：observe 中 has 建立依赖，add / delete 触发通知', () => {
    const item = { id: 2 };
    const ws = observable(new WeakSet<object>());
    const seen: boolean[] = [];
    const reaction = observe(() => {
      seen.push(ws.has(item));
    });
    expect(seen).toEqual([false]);
    ws.add(item);
    expect(seen).toEqual([false, true]);
    ws.delete(item);
    expect(seen).toEqual([false, true, false]);
    unobserve(reaction);
  });

  test('WeakMap 的对象 value 在 deep 模式下读取返回 observable 包装', () => {
    const key = { id: 3 };
    const wm = observable(new WeakMap<object, object>());
    wm.set(key, { a: 1 });
    expect(isObservable(wm.get(key))).toBe(true);
  });

  test('WeakMap/WeakSet 保持 Weak 语义：无法枚举内容、非对象 key 抛 TypeError（文档级断言）', () => {
    const wm = observable(new WeakMap<object, number>());
    const ws = observable(new WeakSet<object>());
    // 不可枚举：迭代不产出任何条目
    expect([...(wm as unknown as Iterable<unknown>)]).toEqual([]);
    expect([...(ws as unknown as Iterable<unknown>)]).toEqual([]);
    // 语言层面的 Weak 约束保持：非对象 key 抛错
    expect(() => (wm as unknown as Map<string, number>).set('str', 1)).toThrow(TypeError);
    expect(() => (ws as unknown as Set<string>).add('str')).toThrow(TypeError);
    // key 不阻止 GC 的真实 GC 行为由 weak-keys-gc.test.ts 覆盖，此处不重复
  });

  test('WeakMap/WeakSet 的 key 解包与 Map/Set 一致：set/add 用 proxy，get/has/delete 用 raw 正常', () => {
    const keyObj = { id: 4 };
    const proxyKey = observable(keyObj);
    const wm = observable(new WeakMap<object, number>());
    wm.set(proxyKey, 42);
    expect(wm.get(keyObj)).toBe(42);
    expect(wm.has(keyObj)).toBe(true);
    expect(wm.delete(keyObj)).toBe(true);
    expect(wm.has(keyObj)).toBe(false);

    const item = { id: 5 };
    const itemProxy = observable(item);
    const ws = observable(new WeakSet<object>());
    ws.add(itemProxy);
    expect(ws.has(item)).toBe(true);
    expect(ws.delete(item)).toBe(true);
    expect(ws.has(item)).toBe(false);
  });
});

describe('契约: ES2024 Set 方法（union/intersection/difference 等）', () => {
  type SetWithES2024<T> = Set<T> & {
    union(other: Set<unknown>): Set<T>;
    intersection(other: Set<unknown>): Set<T>;
    difference(other: Set<unknown>): Set<T>;
    isSubsetOf(other: Set<unknown>): boolean;
  };
  const withMethods = <T>(s: Set<T>): SetWithES2024<T> => s as unknown as SetWithES2024<T>;

  test('deep 模式下 ES2024 Set 方法可正常调用且结果正确', () => {
    const set = withMethods(observable(new Set([1, 2, 3])));
    expect(new Set(set.union(new Set([3, 4])))).toEqual(new Set([1, 2, 3, 4]));
    expect(new Set(set.intersection(new Set([2, 3, 4])))).toEqual(new Set([2, 3]));
    expect(new Set(set.difference(new Set([1])))).toEqual(new Set([2, 3]));
  });

  test('deep 模式下 ES2024 Set 方法返回原始成员而非 observable 包装（当前行为，README「已知限制」）', () => {
    const item = { id: 1 };
    const set = withMethods(observable(new Set([item])));
    const unionMembers = [...set.union(new Set([{ id: 2 }]))];
    // README 已知限制：union/intersection/difference 等新方法的结果集合中
    // 元素不经深度包装（与 values()/迭代器的深度语义不对称）。升级时若此
    // 行为被修正为返回包装成员，本用例失败是预期的——改断言 + changeset 注明。
    unionMembers.forEach(member => {
      expect(isObservable(member)).toBe(false);
    });
    expect(unionMembers[0]).toBe(item);
    // 对照组：values() 路径仍返回包装成员
    expect(isObservable([...set.values()][0])).toBe(true);
  });

  test('isSubsetOf 追踪 other 操作数：other 变更必须重跑（#193）', () => {
    const s1 = withMethods(observable(new Set([1, 2])));
    const s2 = withMethods(observable(new Set([1, 2, 3])));
    const seen: boolean[] = [];
    const reaction = observe(() => {
      seen.push(s1.isSubsetOf(s2));
    });
    expect(seen).toEqual([true]);
    s2.delete(1);
    expect(s1.isSubsetOf(s2)).toBe(false);
    expect(seen).toEqual([true, false]);
    unobserve(reaction);
  });
});

describe('契约: 集合 Object.prototype 方法不被当成内置集合方法转发（#193）', () => {
  test('Map.valueOf() 返回代理自身，constructor 保持 Map', () => {
    const m = observable(new Map([['a', 1]]));
    expect(m.valueOf()).toBe(m);
    expect(m.constructor).toBe(Map);
    expect(String(m)).toBe('[object Map]');
  });

  test('observe(String(map)) 不因 map.set 重跑（toString 不注册 iterate）', () => {
    const m = observable(new Map([['a', 1]]));
    let runs = 0;
    const reaction = observe(() => {
      void String(m);
      runs++;
    });
    expect(runs).toBe(1);
    m.set('b', 2);
    expect(runs).toBe(1);
    unobserve(reaction);
  });
});
