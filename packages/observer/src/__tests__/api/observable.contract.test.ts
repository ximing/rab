/**
 * 本文件是 observable() 的公开行为契约。修改此处断言 = 破坏性变更，
 * 需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 覆盖范围（按 main.ts 导出面）:
 * - 默认参数与空对象、返回 proxy 且 isObservable 为真
 * - 幂等承诺（已是 observable 的参数原样返回，含 shadow 代理）
 * - 深层懒包装与身份稳定缓存
 * - deep / shadow 两种模式对同一 raw 各自缓存、互不串扰
 * - options（proxyHandlers / collectionHandlers / reactionHandlers）语义:
 *   per-raw 键控、first-wins、partial 回落默认
 * - 值比较语义（数据属性 Object.is / accessor 同值必通知 #93）
 * - 数组 / 普通对象 / typed array / 集合 / 函数的路由
 * - 不可包装对象（Date 等内置、跨 realm 内置）原样返回
 * - 安全边界（__proto__ 赋值抛 TypeError、原型链 constructor 不包装）
 * - README 已知限制: 私有字段 (#field) 双面（限制 + raw(this) workaround）
 *
 * 约定: 每个用例独立自包含；断言"观察到的值 / 执行次数 / 抛出的错误"，
 * 不断言内部结构。已知限制用例钉"当前行为"，升级时行为改善导致失败是
 * 预期的，改断言 + changeset 注明即可。
 */
import vm from 'vm';
import {
  observable,
  shadowObservable,
  observe,
  isObservable,
  raw,
  resetGlobalConfig,
} from '../../main';
import type {
  CollectionHandlers,
  ProxyHandlers,
  Reaction,
  ReactionHandlers,
} from '../../internals/types';

// 全局 configure 契约污染是跨文件最大风险，统一在 afterEach 重置
afterEach(() => {
  resetGlobalConfig();
});

describe('observable() 公开行为契约', () => {
  describe('默认参数与基础包装', () => {
    test('observable() 无参调用返回一个可观察的空对象，可直接作为状态容器使用', () => {
      const state = observable();
      expect(isObservable(state)).toBe(true);

      let seen: number | undefined;
      observe(() => {
        seen = (state as { count?: number }).count;
      });
      (state as { count: number }).count = 1;
      expect(seen).toBe(1);
    });

    test('observable(obj) 返回新代理而非原对象，isObservable 为真，raw() 可取回原始对象', () => {
      const obj = { prop: 'value' };
      const obs = observable(obj);
      expect(obs).not.toBe(obj);
      expect(isObservable(obs)).toBe(true);
      expect(isObservable(obj)).toBe(false);
      expect(raw(obs)).toBe(obj);
    });

    test('同一 raw 对象重复调用 observable() 始终返回同一个代理（身份稳定缓存）', () => {
      const obj = { prop: 'value' };
      expect(observable(obj)).toBe(observable(obj));
    });
  });

  describe('幂等承诺', () => {
    test('传入已是 observable 的对象原样返回自身，不二次包装', () => {
      const obs = observable({ count: 0 });
      expect(observable(obs)).toBe(obs);
    });

    test('传入 shadowObservable 代理时同样原样返回（不静默升级为深层代理）', () => {
      const target = { nested: { value: 1 } };
      const shadow = shadowObservable(target);
      // observable() 不得把浅层代理替换成 deep 代理，也不得返回降级的新代理
      expect(observable(shadow)).toBe(shadow);
    });
  });

  describe('深层懒包装', () => {
    test('嵌套对象在访问时被包装为 observable，且多次访问身份稳定', () => {
      const nested = { value: 1 };
      const state = observable({ nested });
      // 原始对象图保持原样：raw 视角看到的 nested 仍是原对象
      expect(raw(state).nested).toBe(nested);
      // 经代理访问得到 observable 包装
      expect(isObservable(state.nested)).toBe(true);
      expect(raw(state.nested)).toBe(nested);
      // 身份稳定：重复访问、以及手动 observable(同一 raw) 都是同一个代理
      expect(state.nested).toBe(state.nested);
      expect(state.nested).toBe(observable(nested));
    });

    test('嵌套 observable 代理是深层响应式的：内部属性变更触发 reaction', () => {
      const state = observable({ box: { value: 1 } });
      let runs = 0;
      let seen: number | undefined;
      observe(() => {
        seen = state.box.value;
        runs++;
      });
      expect(runs).toBe(1);
      state.box.value = 2;
      expect(runs).toBe(2);
      expect(seen).toBe(2);
    });

    test('原始值属性不做包装，读取原样返回', () => {
      const state = observable({ n: 1, s: 'a', nul: null, undef: undefined });
      expect(state.n).toBe(1);
      expect(state.s).toBe('a');
      expect(state.nul).toBe(null);
      expect(state.undef).toBe(undefined);
    });

    test('把 observable 代理写入另一个 observable 的属性时解包为 raw 落盘：raw 视角不持有 proxy 身份，读回仍是同一缓存代理', () => {
      const innerObj = { count: 0 };
      const inner = observable(innerObj);
      const outer = observable({ data: null as unknown });
      outer.data = inner;

      // raw 视角（data 属性的实际存储）：存的是原始对象，不是 proxy
      expect(raw(outer).data).toBe(innerObj);
      expect(isObservable(raw(outer).data as object)).toBe(false);
      // proxy 视角读回：经缓存包装，身份稳定
      expect(outer.data).toBe(inner);
    });
  });

  describe('deep 与 shadow 模式对同一 raw 各自缓存、互不串扰', () => {
    test('先 shadow 后 deep：同一 raw 拿到两个不同代理，各自语义保持', () => {
      const target = { nested: { value: 1 } };
      const shadow = shadowObservable(target);
      const deep = observable(target);
      expect(deep).not.toBe(shadow);
      expect(observable(target)).toBe(deep);
      expect(shadowObservable(target)).toBe(shadow);

      // deep 代理的嵌套对象是 observable，shadow 代理的嵌套对象保持原样
      expect(isObservable(deep.nested)).toBe(true);
      expect(shadow.nested).toBe(target.nested);
      expect(isObservable(shadow.nested)).toBe(false);
    });

    test('先 deep 后 shadow：deep 代理不被 shadow 覆盖，深层响应不失效', () => {
      const target = { nested: { value: 1 } };
      const deep = observable(target);
      const shadow = shadowObservable(target);
      expect(shadow).not.toBe(deep);

      let runs = 0;
      observe(() => {
        deep.nested.value;
        runs++;
      });
      deep.nested.value = 2;
      expect(runs).toBe(2);
    });
  });

  describe('类型路由：不同类型获得对应的响应式能力', () => {
    test('普通对象：属性读写被追踪，变更触发 reaction', () => {
      const state = observable({ count: 0 });
      let runs = 0;
      let seen: number | undefined;
      observe(() => {
        seen = state.count;
        runs++;
      });
      state.count = 5;
      expect(runs).toBe(2);
      expect(seen).toBe(5);
    });

    test('数组：索引读写被追踪（数组特有语义见 array.contract）', () => {
      const arr = observable([1, 2, 3]);
      let runs = 0;
      let seen: number | undefined;
      observe(() => {
        seen = arr[0];
        runs++;
      });
      arr[0] = 9;
      expect(runs).toBe(2);
      expect(seen).toBe(9);
    });

    test('typed array：与普通数组一样被包装且索引读写响应式', () => {
      const ta = observable(new Uint8Array([1, 2, 3]));
      expect(isObservable(ta)).toBe(true);
      let runs = 0;
      let seen: number | undefined;
      observe(() => {
        seen = ta[0];
        runs++;
      });
      ta[0] = 7;
      expect(runs).toBe(2);
      expect(seen).toBe(7);
    });

    test('Map：get/set 走插桩方法，读写被追踪', () => {
      const m = observable(new Map<string, number>([['a', 1]]));
      let runs = 0;
      let seen: number | undefined;
      observe(() => {
        seen = m.get('a');
        runs++;
      });
      m.set('a', 2);
      expect(runs).toBe(2);
      expect(seen).toBe(2);
      expect(raw(m).get('a')).toBe(2);
    });

    test('Set：has/add 走插桩方法，读写被追踪', () => {
      const s = observable(new Set<string>());
      let runs = 0;
      let seen: boolean | undefined;
      observe(() => {
        seen = s.has('x');
        runs++;
      });
      expect(seen).toBe(false);
      s.add('x');
      expect(runs).toBe(2);
      expect(seen).toBe(true);
    });

    test('WeakMap：以对象为 key 的读写被追踪（集合迭代语义见 collection.contract）', () => {
      const key = { id: 1 };
      const wm = observable(new WeakMap<object, number>());
      let runs = 0;
      let seen: number | undefined;
      observe(() => {
        seen = wm.get(key);
        runs++;
      });
      wm.set(key, 42);
      expect(runs).toBe(2);
      expect(seen).toBe(42);
    });

    test('函数是一等 observable：包装后的函数可调用且透传参数与返回值', () => {
      function add(a: number, b: number): number {
        return a + b;
      }
      const obsAdd = observable(add);
      expect(isObservable(obsAdd)).toBe(true);
      expect(obsAdd(1, 2)).toBe(3);
      expect(obsAdd(10, 20)).toBe(30);
    });

    test('new 一个 observable 类得到 observable 实例，instanceof 原类仍成立', () => {
      class Point {
        x = 0;
      }
      const ObsPoint = observable(Point);
      expect(isObservable(ObsPoint)).toBe(true);
      const p = new ObsPoint();
      expect(isObservable(p)).toBe(true);
      expect(p instanceof Point).toBe(true);
    });
  });

  describe('不可包装对象原样返回', () => {
    test.each([
      ['Date', () => new Date(2020, 0, 1)],
      ['RegExp', () => /ab+c/],
      ['Promise', () => Promise.resolve(1)],
      ['ArrayBuffer', () => new ArrayBuffer(8)],
      ['Error', () => new Error('boom')],
    ])('依赖内部槽位的内置对象（%s）作为参数传入时原样返回，不包装', (_name, factory) => {
      const builtIn = factory();
      expect(observable(builtIn)).toBe(builtIn);
      expect(isObservable(builtIn)).toBe(false);
    });

    test('嵌套属性中的内置对象（如 Date）保持原样，其方法可直接调用', () => {
      const when = new Date(2020, 0, 1);
      const state = observable({ when });
      expect(state.when).toBe(when);
      expect(isObservable(state.when)).toBe(false);
      expect(state.when.getFullYear()).toBe(2020);
    });

    test('跨 realm 内置对象（vm 隔离环境）同样原样返回，不包装', () => {
      const crossRealmDate = vm.runInNewContext('new Date(2020, 0, 1)');
      expect(observable(crossRealmDate)).toBe(crossRealmDate);
      expect(isObservable(crossRealmDate)).toBe(false);
    });

    test('跨 realm 普通对象仍被正常包装且深层响应式', () => {
      const crossRealmObj = vm.runInNewContext('({ nested: { value: 1 } })') as {
        nested: { value: number };
      };
      const obs = observable(crossRealmObj);
      expect(isObservable(obs)).toBe(true);
      let runs = 0;
      observe(() => {
        obs.nested.value;
        runs++;
      });
      obs.nested.value = 2;
      expect(runs).toBe(2);
    });

    test('跨 realm Map 仍路由到集合插桩，方法读写响应式', () => {
      const crossRealmMap = vm.runInNewContext("new Map([['a', 1]])") as Map<string, number>;
      const obs = observable(crossRealmMap);
      expect(isObservable(obs)).toBe(true);
      let runs = 0;
      let seen: number | undefined;
      observe(() => {
        seen = obs.get('a');
        runs++;
      });
      obs.set('a', 2);
      expect(runs).toBe(2);
      expect(seen).toBe(2);
    });

    test('内置类的用户子类（如 class Stamp extends Date）的自有数据属性仍可获得响应式追踪', () => {
      class Stamp extends Date {
        label = 'init';
      }
      const obs = observable(new Stamp());
      expect(isObservable(obs)).toBe(true);
      let runs = 0;
      let seen: string | undefined;
      observe(() => {
        seen = obs.label;
        runs++;
      });
      obs.label = 'updated';
      expect(runs).toBe(2);
      expect(seen).toBe('updated');
    });
  });

  describe('安全边界', () => {
    test("对 '__proto__' 赋值抛出 TypeError，原型不被篡改", () => {
      const state = observable({ count: 0 });
      const evil = { polluted: true };
      expect(() => {
        (state as unknown as Record<string, unknown>)['__proto__'] = evil;
      }).toThrow(TypeError);
      expect(Object.getPrototypeOf(raw(state))).toBe(Object.prototype);
    });

    test('原型链上的 constructor 读取保持原生语义，不被包装', () => {
      const state = observable({ count: 0 });
      expect((state as unknown as Record<string, unknown>).constructor).toBe(Object);
      expect(isObservable((state as unknown as Record<string, unknown>).constructor)).toBe(false);

      class Thing {
        value = 1;
      }
      const thing = observable(new Thing());
      expect((thing as unknown as Record<string, unknown>).constructor).toBe(Thing);
    });
  });

  describe('值比较语义（README 已知限制章节）', () => {
    test('数据属性同值写入不触发 reaction（Object.is 精确比较）', () => {
      const state = observable({ count: 1 });
      let runs = 0;
      observe(() => {
        state.count;
        runs++;
      });
      expect(runs).toBe(1);
      state.count = 1;
      expect(runs).toBe(1);
      state.count = 2;
      expect(runs).toBe(2);
    });

    test('NaN 与 NaN 视为同值，重复写入不触发 reaction', () => {
      const state = observable({ value: NaN });
      let runs = 0;
      observe(() => {
        state.value;
        runs++;
      });
      state.value = NaN;
      expect(runs).toBe(1);
    });

    test('+0 与 -0 视为不同值（Object.is 语义），写入触发 reaction', () => {
      const state = observable({ value: 0 });
      let runs = 0;
      observe(() => {
        state.value;
        runs++;
      });
      expect(runs).toBe(1);
      state.value = -0;
      expect(runs).toBe(2);
    });

    test('已知限制（README「accessor 属性的同值写入会通知」，issue #93）：accessor 属性写入与当前 getter 返回值相同的值也会通知一次', () => {
      let stored = 1;
      const state = observable({
        get value(): number {
          return stored;
        },
        set value(v: number) {
          stored = v;
        },
      });
      let runs = 0;
      observe(() => {
        state.value;
        runs++;
      });
      expect(runs).toBe(1);
      expect(state.value).toBe(1);
      // 写入与 getter 当前返回值相同的 1 —— 仍会通知（accessor 无法安全读旧值）
      state.value = 1;
      expect(runs).toBe(2);
    });
  });

  describe('README 已知限制：私有字段（#field）', () => {
    class Wallet {
      #balance = 100;
      readViaProxyThis(): number {
        return this.#balance;
      }
      readViaRawThis(): number {
        return raw(this).#balance;
      }
    }

    test('已知限制（README「私有字段」）：包装类实例经代理调用访问私有字段抛 TypeError（Proxy brand check）', () => {
      const obs = observable(new Wallet());
      expect(isObservable(obs)).toBe(true);
      // this 是代理，未持有私有字段 brand —— 抛 TypeError
      expect(() => obs.readViaProxyThis()).toThrow(TypeError);
    });

    test('官方 workaround：方法内用 raw(this) 取回原始实例访问私有字段可用', () => {
      const obs = observable(new Wallet());
      expect(obs.readViaRawThis()).toBe(100);
    });
  });

  describe('options 语义（per-raw 键控 / first-wins / partial 回落默认）', () => {
    test('只传部分 options（或空对象）时，未覆盖的 trap 回落默认实现，响应式不丢失', () => {
      const state = observable({ count: 1 }, {});
      let runs = 0;
      let seen: number | undefined;
      observe(() => {
        seen = state.count;
        runs++;
      });
      state.count = 12;
      expect(runs).toBe(2);
      expect(seen).toBe(12);
    });

    test('first-wins：对同一 raw 第二次传不同 options 被静默忽略（返回同一代理，首个 options 继续生效）', () => {
      const target = { count: 0 };
      const first = jest.fn((_t: object, _k: PropertyKey, reactions: Reaction[]) => reactions);
      const second = jest.fn((_t: object, _k: PropertyKey, reactions: Reaction[]) => reactions);

      const obs1 = observable(target, {
        reactionHandlers: { transformReactions: first } as ReactionHandlers,
      });
      const obs2 = observable(target, {
        reactionHandlers: { transformReactions: second } as ReactionHandlers,
      });
      // 同一 raw 命中缓存：第二个 options 从未生效
      expect(obs2).toBe(obs1);

      observe(() => obs1.count);
      obs1.count = 1;
      expect(first).toHaveBeenCalled();
      expect(second).not.toHaveBeenCalled();
    });

    test('reactionHandlers.transformReactions 过滤通知集：返回空数组时写入不触发任何 reaction', () => {
      const state = observable(
        { count: 0 },
        {
          reactionHandlers: {
            transformReactions: () => [],
          } as ReactionHandlers,
        }
      );
      let runs = 0;
      observe(() => {
        state.count;
        runs++;
      });
      expect(runs).toBe(1);
      state.count = 1;
      // 写入落盘但通知集被过滤为空
      expect(runs).toBe(1);
      expect(raw(state).count).toBe(1);
    });

    test('options 按 raw 键控：嵌套子对象继承根 options，对子对象的写入同样经过 transformReactions', () => {
      const state = observable(
        { box: { value: 0 } },
        {
          reactionHandlers: {
            transformReactions: () => [],
          } as ReactionHandlers,
        }
      );
      let runs = 0;
      observe(() => {
        state.box.value;
        runs++;
      });
      expect(runs).toBe(1);
      state.box.value = 1;
      expect(runs).toBe(1);
      expect(raw(state).box.value).toBe(1);
    });

    test('options 按 raw 键控（跨代理）：经 shadowObservable(raw) 代理的写入同样经过 deep options 的 transformReactions（JSDoc 明示承诺，如需隔离请用不同 raw）', () => {
      const target = { count: 0 };
      const deep = observable(target, {
        reactionHandlers: {
          transformReactions: () => [],
        } as ReactionHandlers,
      });
      const shadow = shadowObservable(target);
      expect(shadow).not.toBe(deep);

      let runs = 0;
      observe(() => {
        shadow.count;
        runs++;
      });
      expect(runs).toBe(1);
      shadow.count = 5;
      // 写入经同一张 (raw, key) 连接表通知，被 deep options 的过滤器过滤
      expect(runs).toBe(1);
      expect(target.count).toBe(5);
    });

    test('自定义 proxyHandlers 的 trap 完全替换默认实现：写入落盘但默认通知语义不再自动生效', () => {
      const seenKeys: string[] = [];
      const state = observable(
        { count: 0 },
        {
          // 部分覆盖：只替换 set trap，其余 trap 回落默认实现（与 ObservableOptions 的合并语义一致）
          proxyHandlers: {
            set: (target: object, key: PropertyKey, value: unknown) => {
              seenKeys.push(String(key));
              return Reflect.set(target, key, value);
            },
          } as unknown as ProxyHandlers,
        }
      );
      let runs = 0;
      observe(() => {
        state.count;
        runs++;
      });
      expect(runs).toBe(1);
      state.count = 5;
      // 自定义 trap 被调用且写入落盘
      expect(seenKeys).toEqual(['count']);
      expect(raw(state).count).toBe(5);
      // 默认 set trap 的通知逻辑被替换，reaction 不重跑
      expect(runs).toBe(1);
    });

    test('自定义 collectionHandlers 的同名方法优先于内置插桩方法生效', () => {
      const m = observable(new Map(), {
        collectionHandlers: {
          get(this: unknown, key: unknown): unknown {
            return `custom:${String(key)}`;
          },
        } as unknown as CollectionHandlers,
      });
      expect(m.get('a')).toBe('custom:a');
      expect(m.get('b')).toBe('custom:b');
    });
  });
});
