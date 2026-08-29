import vm from 'vm';
import { observable, observe, shadowObservable } from '../main';

/*
 * #7: Map/Set 子类此前被 constructor 精确匹配漏掉, 落到 base proxy handler,
 * 方法调用以 proxy 为 receiver 抛 "incompatible receiver"。
 * #9: 跨 realm 内置对象 (vm.runInNewContext, 模拟 RN 远程调试 / iframe)
 * 的 constructor 不等于本 realm 的全局构造函数, 内置检测失败被包装,
 * 抛 "this is not a Date object." 之类错误。
 *
 * 修复方向: 用 Object.prototype.toString 的 tag 做集合路由与内置黑名单判定
 * (子类继承 tag, 跨 realm tag 一致)。
 * */

describe('#7 Map/Set subclasses route to collection handlers', () => {
  test('Map subclass: set/get/has/delete/size/iteration are reactive', () => {
    class MyMap<K, V> extends Map<K, V> {}
    const raw = new MyMap<string, number>();
    raw.set('a', 1);
    const m = observable(raw);
    expect(m).not.toBe(raw);

    let dummy: number | undefined;
    observe(() => (dummy = m.get('a')));
    expect(dummy).toBe(1);

    expect(m.set('a', 2)).toBe(m);
    expect(dummy).toBe(2);
    expect(m.get('a')).toBe(2);
    expect(m.has('a')).toBe(true);
    expect(m.size).toBe(1);
    expect([...m.keys()]).toEqual(['a']);
    expect([...m.values()]).toEqual([2]);
    m.forEach(v => {
      expect(v).toBe(2);
    });
    expect(m.delete('a')).toBe(true);
    expect(dummy).toBe(undefined);
    expect(m.size).toBe(0);
  });

  test('Set subclass: add/has/delete/iteration are reactive', () => {
    class MySet<V> extends Set<V> {}
    const raw = new MySet<number>();
    const s = observable(raw);
    expect(s).not.toBe(raw);

    let dummy: number | undefined;
    observe(() => (dummy = s.has(1) ? 1 : undefined));
    expect(dummy).toBe(undefined);

    s.add(1);
    expect(dummy).toBe(1);
    expect(s.has(1)).toBe(true);
    expect(s.size).toBe(1);
    expect([...s]).toEqual([1]);
    s.delete(1);
    expect(dummy).toBe(undefined);
    expect(s.size).toBe(0);
  });

  test('Map subclass via shadowObservable works', () => {
    class MyMap<K, V> extends Map<K, V> {}
    const raw = new MyMap<string, number>();
    const m = shadowObservable(raw);
    let dummy: number | undefined;
    observe(() => (dummy = m.get('a')));
    expect(dummy).toBe(undefined);
    m.set('a', 5);
    expect(dummy).toBe(5);
    expect(m.delete('a')).toBe(true);
    expect(dummy).toBe(undefined);
  });

  test('WeakMap subclass via observable works', () => {
    class MyWeakMap<K extends object, V> extends WeakMap<K, V> {}
    const key = {};
    const raw = new MyWeakMap<object, number>();
    raw.set(key, 1);
    const m = observable(raw);
    expect(m).not.toBe(raw);
    let dummy: number | undefined;
    observe(() => (dummy = m.get(key)));
    expect(dummy).toBe(1);
    m.set(key, 2);
    expect(dummy).toBe(2);
    expect(m.has(key)).toBe(true);
    expect(m.delete(key)).toBe(true);
    expect(dummy).toBe(undefined);
  });
});

describe('#9 cross-realm built-ins (vm.runInNewContext)', () => {
  // 注意: 失败断言不要直接把 (被 base handler 包装的) 跨 realm 内置对象交给
  // matcher 序列化 —— pretty-format 会调用其内部槽位方法再次抛错, 连环炸掉
  // jest worker。这里统一用布尔比较隔离。
  test('cross-realm Date is not wrapped and stays usable', () => {
    const date = vm.runInNewContext('new Date(2020, 0, 2)');
    const obs = observable(date);
    expect(obs === date).toBe(true);
    expect(() => obs.getTime()).not.toThrow();
    expect(obs.getTime()).toBe(date.getTime());
  });

  test('cross-realm RegExp is not wrapped', () => {
    const re = vm.runInNewContext('/ab+c/');
    expect(observable(re) === re).toBe(true);
  });

  test('cross-realm Promise is not wrapped', () => {
    const p = vm.runInNewContext('Promise.resolve(1)');
    expect(observable(p) === p).toBe(true);
  });

  test('cross-realm plain object is still wrapped', () => {
    const obj = vm.runInNewContext('({ nested: { value: 1 } })');
    const obs = observable(obj);
    expect(obs).not.toBe(obj);
    let dummy: number | undefined;
    observe(() => (dummy = obs.nested.value));
    obs.nested.value = 2;
    expect(dummy).toBe(2);
  });

  test('cross-realm Map routes to collection handlers and works', () => {
    const raw = vm.runInNewContext("new Map([['a', 1]])");
    const m = observable(raw);
    expect(m).not.toBe(raw);

    let dummy: number | undefined;
    observe(() => (dummy = m.get('a')));
    expect(dummy).toBe(1);

    expect(m.set('a', 2)).toBe(m);
    expect(dummy).toBe(2);
    expect(m.get('a')).toBe(2);
    expect(m.has('a')).toBe(true);
    expect(m.size).toBe(1);
    m.delete('a');
    expect(dummy).toBe(undefined);
    expect(m.size).toBe(0);
  });

  test('cross-realm Set routes to collection handlers and works', () => {
    const raw = vm.runInNewContext('new Set([1])');
    const s = observable(raw);
    expect(s).not.toBe(raw);

    let dummy: number | undefined;
    observe(() => (dummy = s.has(1) ? 1 : undefined));
    expect(dummy).toBe(1);

    s.add(2);
    expect(dummy).toBe(1);
    expect(s.size).toBe(2);
    s.delete(1);
    expect(dummy).toBe(undefined);
    expect(s.size).toBe(1);
  });

  test('cross-realm Set.union 不以 proxy 为 this 抛错（#193）', () => {
    const raw = vm.runInNewContext('new Set([1, 2])') as Set<number>;
    const s = observable(raw) as Set<number> & {
      union(other: Set<unknown>): Set<number>;
    };
    expect(s).not.toBe(raw);
    const united = s.union(new Set([3]));
    expect(new Set(united)).toEqual(new Set([1, 2, 3]));
  });
});
