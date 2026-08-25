/*
 * GG7 对抗审查第 3 轮 (针对 cd1774a) 的 RED 复现测试:
 *
 * 1/4. [high] shadow 模式 Set 的 ES2024 集合方法 (union/intersection/
 *      difference/symmetricDifference/isSubsetOf/isSupersetOf/isDisjointFrom)
 *      不在 shadowCollectionHandlers 中, 落入未知 key 分支后以 proxy 为
 *      receiver 调用, 内部槽位 brand-check 抛 "incompatible receiver"
 *      —— 基线 bbbfca5 上 bind(raw) 完全可用。deep 模式基线同样抛
 *      (既有问题), 一并修复。
 * 2.   [medium] '[object Error]' carve-out 用 constructor.name 判用户子类,
 *      跨 realm 原生 Error 子类 (TypeError/EvalError/AggregateError) 的
 *      constructor 不等于本 realm 全局构造函数, 被误判为用户子类放行包装,
 *      违反 #9 契约 (跨 realm 内置不被包装)。
 * 3.   [medium] clear() 经 isPlainMapOrSetTarget 裸读 target.constructor:
 *      带自有 throwing 'constructor' accessor 的 plain Map 一切可用唯独
 *      clear() 抛用户 getter 的异常。
 * 5.   [medium] 黑名单内置类型的子类 (Date/RegExp/Promise/boxed String)
 *      被黑名单整体拒绝包装, 自有属性静默失去响应式 —— 与 Error 子类的
 *      carve-out 论证相同 (子类自有数据属性是普通属性, base 包装可用),
 *      推广到其余黑名单 tag。
 * 6.   [low] 伪造 [Symbol.toStringTag]='Map' 且带 get/set/has 的普通类经
 *      duck-check 路由到 collection handler, 自有属性读写失去追踪 ——
 *      duck-check 追加原生方法判定 (真实跨 realm 集合的方法是原生函数,
 *      用户类的 get/set/has 不是)。
 * */
import vm from 'vm';
import { observable, observe, shadowObservable } from '../main';

/*
 * tsconfig 的 lib 未包含 ES2024 set-methods 类型, 用局部视图描述被测 API
 * (运行时 Node 22 已原生支持, 见 shadow-collection-unknown-key 回归背景)。
 * */
type SetWithES2024Methods<T> = Set<T> & {
  union(other: Set<unknown>): Set<T>;
  intersection(other: Set<unknown>): Set<T>;
  difference(other: Set<unknown>): Set<T>;
  symmetricDifference(other: Set<unknown>): Set<T>;
  isSubsetOf(other: Set<unknown>): boolean;
  isSupersetOf(other: Set<unknown>): boolean;
  isDisjointFrom(other: Set<unknown>): boolean;
};
const withSetMethods = <T>(s: Set<T>): SetWithES2024Methods<T> =>
  s as unknown as SetWithES2024Methods<T>;

describe('GG7 round3: shadow/deep Set ES2024 set methods must stay usable', () => {
  test('shadow: union/intersection/difference/symmetricDifference work', () => {
    const s = withSetMethods(shadowObservable(new Set([1, 2, 3])));
    expect(new Set(s.union(new Set([2, 3, 4])))).toEqual(new Set([1, 2, 3, 4]));
    expect(new Set(s.intersection(new Set([2, 3, 4])))).toEqual(new Set([2, 3]));
    expect(new Set(s.difference(new Set([2])))).toEqual(new Set([1, 3]));
    expect(new Set(s.symmetricDifference(new Set([3, 4])))).toEqual(new Set([1, 2, 4]));
  });

  test('shadow: isSubsetOf/isSupersetOf/isDisjointFrom return correct booleans', () => {
    const s = withSetMethods(shadowObservable(new Set([1, 2])));
    expect(s.isSubsetOf(new Set([1, 2, 3]))).toBe(true);
    expect(s.isSubsetOf(new Set([1, 3]))).toBe(false);
    expect(s.isSupersetOf(new Set([1]))).toBe(true);
    expect(s.isDisjointFrom(new Set([9]))).toBe(true);
    expect(s.isDisjointFrom(new Set([2]))).toBe(false);
  });

  test('shadow: set methods accept observable-proxy arguments (raw unwrap)', () => {
    const s = withSetMethods(shadowObservable(new Set([1, 2, 3])));
    const other = shadowObservable(new Set([3, 4]));
    expect(new Set(s.union(other as unknown as Set<number>))).toEqual(new Set([1, 2, 3, 4]));
  });

  test('shadow: set methods register an iterate dependency on this', () => {
    const s = withSetMethods(shadowObservable(new Set([1, 2])));
    let size = 0;
    observe(() => {
      size = s.union(new Set([9])).size;
    });
    expect(size).toBe(3);
    s.add(3);
    expect(size).toBe(4);
  });

  test('deep: union/intersection work (baseline threw, fixed alongside)', () => {
    const s = withSetMethods(observable(new Set([1, 2, 3])));
    expect(new Set(s.union(new Set([3, 4])))).toEqual(new Set([1, 2, 3, 4]));
    expect(new Set(s.intersection(new Set([2, 3, 4])))).toEqual(new Set([2, 3]));
    expect(s.isSubsetOf(new Set([1, 2, 3, 4]))).toBe(true);
  });

  test('Set subclass: set methods via unknown-key branch stay usable (shadow)', () => {
    class MySetSub<V> extends Set<V> {}
    const s = withSetMethods(shadowObservable(new MySetSub([1, 2])));
    expect(new Set(s.difference(new Set([1])))).toEqual(new Set([2]));
  });

  test('subclass custom methods still go through instrumented traps (pin)', () => {
    class MyMap<K, V> extends Map<K, V> {
      putTwice(k: K, v: V) {
        this.set(k, v);
        this.set(k, v);
      }
    }
    const sm = shadowObservable(new MyMap<string, number>());
    let dummy: number | undefined;
    observe(() => (dummy = sm.get('a')));
    sm.putTwice('a', 1);
    expect(dummy).toBe(1);
  });

  test('map.constructor identity is preserved (pin)', () => {
    const s = shadowObservable(new Set([1]));
    expect(s.constructor).toBe(Set);
    const m = observable(new Map());
    expect(m.constructor).toBe(Map);
  });
});

describe('GG7 round3: cross-realm native Error subclasses must not be wrapped', () => {
  const cases: Array<[string, () => unknown]> = [
    ['TypeError', () => vm.runInNewContext("new TypeError('x')")],
    ['EvalError', () => vm.runInNewContext("new EvalError('x')")],
    ['RangeError', () => vm.runInNewContext("new RangeError('x')")],
    ['AggregateError', () => vm.runInNewContext("new AggregateError([1], 'x')")],
  ];

  for (const [name, make] of cases) {
    test(`cross-realm ${name} is returned raw (#9 contract)`, () => {
      const e = make() as object;
      expect(observable(e) === e).toBe(true);
    });
  }

  test('cross-realm Error (base class) is still returned raw (pin)', () => {
    const e = vm.runInNewContext("new Error('x')") as object;
    expect(observable(e) === e).toBe(true);
  });

  test('same-realm native error subclasses are still returned raw (pin)', () => {
    const t = new TypeError('x');
    expect(observable(t) === t).toBe(true);
  });

  test('user Error subclass is still wrapped and reactive (pin)', () => {
    class AppError extends Error {
      code = 1;
    }
    const err = new AppError('boom');
    const oe = observable(err);
    expect(oe).not.toBe(err);
    let dummy: number | undefined;
    observe(() => (dummy = (oe as AppError).code));
    expect(dummy).toBe(1);
    (oe as AppError).code = 3;
    expect(dummy).toBe(3);
  });
});

describe('GG7 round3: clear() must not read a throwing own constructor accessor', () => {
  const makeBoomyMap = (): Map<string, number> => {
    const raw = new Map<string, number>([['a', 1]]);
    Object.defineProperty(raw, 'constructor', {
      get() {
        throw new Error('boom: constructor getter');
      },
      configurable: true,
    });
    return raw;
  };

  test('deep: observable/get/set all work AND clear() clears + notifies', () => {
    const raw = makeBoomyMap();
    const m = observable(raw);
    let dummy: number | undefined;
    observe(() => (dummy = m.get('a')));
    expect(dummy).toBe(1);
    expect(() => m.clear()).not.toThrow();
    expect(m.size).toBe(0);
    expect(dummy).toBeUndefined();
  });

  test('shadow: clear() works with a throwing constructor accessor', () => {
    const raw = makeBoomyMap();
    const m = shadowObservable(raw);
    let dummy: number | undefined;
    observe(() => (dummy = m.get('a')));
    expect(dummy).toBe(1);
    expect(() => m.clear()).not.toThrow();
    expect(m.size).toBe(0);
    expect(dummy).toBeUndefined();
  });

  test('deep: debugger still receives the pre-clear content copy', () => {
    const raw = makeBoomyMap();
    const m = observable(raw);
    let received: unknown = 'unset';
    observe(() => m.get('a'), {
      debugger: op => {
        if (op.type === 'clear') received = op.oldValue;
      },
    });
    m.clear();
    expect(received).toEqual(new Map([['a', 1]]));
  });

  test('misleading own constructor value still clears safely (pin)', () => {
    const raw = new Map<string, number>([['a', 1]]);
    (raw as unknown as { constructor: unknown }).constructor = Object;
    const m = observable(raw);
    expect(() => m.clear()).not.toThrow();
    expect(m.size).toBe(0);
  });
});

describe('GG7 round3: user subclasses of other blacklisted built-ins keep base reactivity', () => {
  class MyDate extends Date {
    constructor(public label = 'x') {
      super(1000);
    }
  }
  class MyRegExp extends RegExp {
    constructor(public label = 'x') {
      super('a');
    }
  }
  class MyPromise extends Promise<unknown> {
    constructor(public label = 'x') {
      super(() => {});
    }
  }
  class MyString extends String {
    constructor(public label = 'x') {
      super('s');
    }
  }

  test.each([
    ['MyDate', () => new MyDate()],
    ['MyRegExp', () => new MyRegExp()],
    ['MyPromise', () => new MyPromise()],
    ['MyString', () => new MyString()],
  ])('%s subclass: wrapped and own properties reactive', (_name, make) => {
    const raw = make();
    const obs = observable(raw);
    expect(obs).not.toBe(raw);
    let dummy: string | undefined;
    observe(() => {
      dummy = (obs as unknown as { label: string }).label;
    });
    expect(dummy).toBe('x');
    (obs as unknown as { label: string }).label = 'changed';
    expect(dummy).toBe('changed');
    expect((raw as unknown as { label: string }).label).toBe('changed');
  });

  test('same-realm plain Date/RegExp/Promise stay raw (pin)', () => {
    const d = new Date();
    expect(observable(d) === d).toBe(true);
    const re = /a/;
    expect(observable(re) === re).toBe(true);
    const p = Promise.resolve(1);
    expect(observable(p) === p).toBe(true);
  });

  test('cross-realm Date stays raw after the carve-out generalization (pin)', () => {
    const d = vm.runInNewContext('new Date()') as object;
    expect(observable(d) === d).toBe(true);
  });

  test('user subclass of a native error subclass (extends TypeError) is wrapped', () => {
    class AppTypeError extends TypeError {
      code = 1;
    }
    const err = new AppTypeError('boom');
    const oe = observable(err);
    expect(oe).not.toBe(err);
    let dummy: number | undefined;
    observe(() => (dummy = (oe as AppTypeError).code));
    (oe as AppTypeError).code = 3;
    expect(dummy).toBe(3);
  });
});

describe('GG7 round3: forged-tag class with user get/set/has falls back to base handler', () => {
  class MyDict {
    store = new Map<string, number>();
    label = 'hello';
    get(k: string) {
      return this.store.get(k);
    }
    set(k: string, v: number) {
      this.store.set(k, v);
      return this;
    }
    has(k: string) {
      return this.store.has(k);
    }
  }
  (MyDict.prototype as unknown as { [Symbol.toStringTag]: string })[Symbol.toStringTag] = 'Map';

  test('own properties are reactive through the base handler', () => {
    const raw = new MyDict();
    const obs = observable(raw);
    expect(obs).not.toBe(raw);
    let dummy: string | undefined;
    observe(() => {
      dummy = (obs as unknown as { label: string }).label;
    });
    expect(dummy).toBe('hello');
    (obs as unknown as { label: string }).label = 'changed';
    expect(dummy).toBe('changed');
    expect(raw.label).toBe('changed');
  });

  test('duck-typed methods still work through the proxy', () => {
    const obs = observable(new MyDict());
    (obs as unknown as { set(k: string, v: number): unknown }).set('k', 1);
    expect((obs as unknown as { get(k: string): number | undefined }).get('k')).toBe(1);
  });

  test('cross-realm real Map still routes to collection handlers (pin)', () => {
    const rm = vm.runInNewContext("new Map([['a', 1]])") as Map<string, number>;
    const m = observable(rm);
    expect(m).not.toBe(rm);
    let dummy: number | undefined;
    observe(() => (dummy = m.get('a')));
    expect(dummy).toBe(1);
    m.set('a', 2);
    expect(dummy).toBe(2);
  });
});
