/**
 * 覆盖率扫尾：对着未覆盖分支写行为断言。
 * 失败 = 真实契约缺口，不是为了刷行号。
 */
import {
  observable,
  shadowObservable,
  observe,
  batch,
  isObservable,
  resetGlobalConfig,
  type Reaction,
} from '../main';

afterEach(() => {
  resetGlobalConfig();
});

describe('未覆盖分支：公开/半公开行为', () => {
  test('shadowObservable() 无参返回可观察空对象，根级写入可通知', () => {
    const state = shadowObservable() as { n?: number };
    expect(isObservable(state)).toBe(true);
    const seen: Array<number | undefined> = [];
    observe(() => {
      seen.push(state.n);
    });
    state.n = 1;
    expect(seen).toEqual([undefined, 1]);
  });

  test('reaction 在自身执行栈上再次调用自身：不递归，返回 undefined', () => {
    let r: Reaction | undefined;
    let runs = 0;
    r = observe(
      () => {
        runs++;
        const nested = r!();
        expect(nested).toBeUndefined();
      },
      { lazy: true }
    );
    r!();
    expect(runs).toBe(1);
  });

  test('flush 期间内层 batch 写入另一个 reaction 的依赖，外层 flush 结束后后者仍被唤醒', () => {
    const state = observable({ n: 0, m: 0 });
    const log: string[] = [];
    observe(() => {
      log.push(`a:${state.n}`);
      if (state.n === 1) {
        batch(() => {
          state.m = 1;
        });
      }
    });
    observe(() => {
      log.push(`b:${state.m}`);
    });
    expect(log).toEqual(['a:0', 'b:0']);

    batch(() => {
      state.n = 1;
    });
    expect(log).toContain('b:1');
    expect(state.m).toBe(1);
  });

  test('new 一个被 observable 包装的构造函数：实例是 observable，字段可追踪', () => {
    function Ctor(this: { n: number }, n: number) {
      this.n = n;
    }
    const ProxyCtor = observable(Ctor);
    const inst = new (ProxyCtor as unknown as new (n: number) => { n: number })(3);
    expect(isObservable(inst)).toBe(true);
    const seen: number[] = [];
    observe(() => {
      seen.push(inst.n);
    });
    inst.n = 4;
    expect(seen).toEqual([3, 4]);
  });

  test('new 被 observable 包装的 class 时 instanceof 仍认原始类，实例可追踪', () => {
    class Animal {
      kind = 'animal';
    }
    const ProxyAnimal = observable(Animal);
    const inst = new ProxyAnimal();
    expect(inst instanceof Animal).toBe(true);
    expect(isObservable(inst)).toBe(true);
    const seen: string[] = [];
    observe(() => {
      seen.push(inst.kind);
    });
    inst.kind = 'bird';
    expect(seen).toEqual(['animal', 'bird']);
  });

  test('new observable(class) 的实例 instanceof 包装后的类仍为 true', () => {
    class Animal {
      kind = 'animal';
    }
    const ProxyAnimal = observable(Animal);
    const inst = new ProxyAnimal();
    expect(inst instanceof ProxyAnimal).toBe(true);
  });

  test('shadow Map 抽出 set 绑到非集合 this：不抛错，返回 this', () => {
    const map = shadowObservable(new Map<string, number>());
    const extracted = map.set;
    const other = {} as { set: typeof map.set };
    expect(extracted.call(other as unknown as typeof map, 'a', 1)).toBe(other);
    expect(map.has('a')).toBe(false);
  });

  test('shadow Set 抽出 delete 绑到非集合 this：返回 false', () => {
    const set = shadowObservable(new Set(['a']));
    expect(set.delete.call({} as Set<string>, 'a')).toBe(false);
    expect(set.has('a')).toBe(true);
  });

  test('伪造 [object Set] 且 Function.prototype.toString 抛错时仍可作普通对象包装', () => {
    const orig = Function.prototype.toString;
    Function.prototype.toString = function () {
      throw new Error('toString boom');
    };
    try {
      const fake = {
        [Symbol.toStringTag]: 'Set',
        add() {
          return this;
        },
        has() {
          return false;
        },
        delete() {
          return false;
        },
        n: 0,
      };
      const state = observable(fake);
      expect(isObservable(state)).toBe(true);
      const seen: number[] = [];
      observe(() => {
        seen.push(state.n);
      });
      state.n = 1;
      expect(seen).toEqual([0, 1]);
    } finally {
      Function.prototype.toString = orig;
    }
  });

  test('从 Map 代理上抽出 set 绑到非集合 this 上：不抛错，返回 this', () => {
    const map = observable(new Map<string, number>());
    const extracted = map.set;
    const other = {} as { set: typeof map.set };
    expect(() => extracted.call(other as unknown as typeof map, 'a', 1)).not.toThrow();
    expect(extracted.call(other as unknown as typeof map, 'a', 1)).toBe(other);
    expect(map.has('a')).toBe(false);
  });

  test('从 Set 代理上抽出 delete 绑到非集合 this 上：返回 false', () => {
    const set = observable(new Set(['a']));
    const extracted = set.delete;
    expect(extracted.call({} as Set<string>, 'a')).toBe(false);
    expect(set.has('a')).toBe(true);
  });

  test('黑名单内置 Date 上 constructor 访问器抛错时 observable() 不向调用方抛错', () => {
    const raw = new Date();
    Object.defineProperty(raw, 'constructor', {
      configurable: true,
      get() {
        throw new Error('constructor boom');
      },
    });
    let wrapped: object;
    expect(() => {
      wrapped = observable(raw);
    }).not.toThrow();
    expect(wrapped!).toBe(raw);
    expect(isObservable(wrapped!)).toBe(false);
  });

  test('Function.prototype.toString 抛错时 observable(new Map) 仍能包装且 Map 方法可追踪', () => {
    const orig = Function.prototype.toString;
    Function.prototype.toString = function () {
      throw new Error('toString boom');
    };
    try {
      const map = observable(new Map<string, number>());
      expect(isObservable(map)).toBe(true);
      const seen: Array<number | undefined> = [];
      observe(() => {
        seen.push(map.get('a'));
      });
      map.set('a', 1);
      expect(seen).toEqual([undefined, 1]);
    } finally {
      Function.prototype.toString = orig;
    }
  });

  test('伪造 [object Map] 且 get 访问器抛错的对象走 base handler，自有属性仍可追踪', () => {
    const fake = {
      [Symbol.toStringTag]: 'Map',
    } as { [Symbol.toStringTag]: string; count: number };
    Object.defineProperty(fake, 'get', {
      get() {
        throw new Error('get boom');
      },
    });
    (fake as { count: number }).count = 0;
    const state = observable(fake);
    expect(isObservable(state)).toBe(true);
    const seen: number[] = [];
    observe(() => {
      seen.push(state.count);
    });
    state.count = 2;
    expect(seen).toEqual([0, 2]);
  });
});
