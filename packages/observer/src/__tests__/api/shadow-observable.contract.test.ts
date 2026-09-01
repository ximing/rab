/**
 * 本文件是 shadowObservable() 的公开行为契约。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 契约范围（见 shadow-observable.ts JSDoc —— JSDoc 中的承诺同样是公开契约）:
 * - 根级响应式：根属性的读/写/增/删/in 均可被 observe 追踪并通知。
 * - 浅层语义：嵌套对象原样暴露（不包装、不追踪），只有根级赋值/替换才通知。
 * - 集合浅层语义：get/迭代返回原始对象（raw），经返回值修改不产生通知。
 * - 与 observable() 对同一 raw 的双代理并存（G6 分桶）+ 共享连接表的双向互通知。
 * - 数组浅层行为：索引/迭代响应，元素对象不包装。
 * - shadow 独有的集合方法路由：子类自定义方法 this.set 走 trap、
 *   ES2024 只读集合方法以原生语义转发（GG7 第 3 轮确认的行为）。
 *
 * 写法约定：每个用例独立自包含；断言"观察到的值/执行次数"，不断言内部结构。
 */

import {
  shadowObservable,
  observable,
  observe,
  unobserve,
  isObservable,
  raw,
  resetGlobalConfig,
} from '../../main';

// 防止本文件（或其他文件）遗留的全局 configure 污染跨用例行为
afterEach(() => {
  resetGlobalConfig();
});

describe('shadowObservable() 行为契约', () => {
  describe('根级响应式', () => {
    it('observe 读取根属性后，写入同一属性会以新值重新运行 reaction', () => {
      const state = shadowObservable({ count: 0 });
      const seen: number[] = [];
      const reaction = observe(() => {
        seen.push(state.count);
      });

      expect(seen).toEqual([0]); // observe(fn) 立即执行一次并建立依赖

      state.count = 1;
      expect(seen).toEqual([0, 1]);

      state.count = 2;
      expect(seen).toEqual([0, 1, 2]);

      unobserve(reaction);
    });

    it('根级同值写入不触发 reaction（Object.is 比较语义，与 observable() 的数据属性承诺一致）', () => {
      const state = shadowObservable({ count: 1 });
      const seen: number[] = [];
      const reaction = observe(() => {
        seen.push(state.count);
      });

      expect(seen).toEqual([1]);

      // 写入与当前值相同的 1 —— 不通知（值没有变化）
      state.count = 1;
      expect(seen).toEqual([1]);

      state.count = 2;
      expect(seen).toEqual([1, 2]);

      unobserve(reaction);
    });

    it('新增根属性会通知枚举类（Object.keys）reaction', () => {
      const state = shadowObservable({ a: 1 } as { a: number; b?: string });
      const keyCounts: number[] = [];
      const reaction = observe(() => {
        keyCounts.push(Object.keys(state).length);
      });

      expect(keyCounts).toEqual([1]);

      state.b = 'new';
      expect(keyCounts).toEqual([1, 2]);
      expect(state.b).toBe('new');

      unobserve(reaction);
    });

    it('删除根属性会通知读该属性的 reaction 与枚举 reaction', () => {
      const state = shadowObservable({
        a: 1,
        b: 2,
      } as { a?: number; b?: number });
      const values: (number | undefined)[] = [];
      const keyCounts: number[] = [];
      const r1 = observe(() => {
        values.push(state.a);
      });
      const r2 = observe(() => {
        keyCounts.push(Object.keys(state).length);
      });

      expect(values).toEqual([1]);
      expect(keyCounts).toEqual([2]);

      delete state.a;
      expect(values).toEqual([1, undefined]);
      expect(keyCounts).toEqual([2, 1]);

      unobserve(r1);
      unobserve(r2);
    });

    it("'key in proxy' 建立的依赖在属性增删时被通知", () => {
      const state = shadowObservable({} as { flag?: boolean });
      const seen: boolean[] = [];
      const reaction = observe(() => {
        seen.push('flag' in state);
      });

      expect(seen).toEqual([false]);

      state.flag = true;
      expect(seen).toEqual([false, true]);

      delete state.flag;
      expect(seen).toEqual([false, true, false]);

      unobserve(reaction);
    });
  });

  describe('浅层语义：嵌套不包装不追踪', () => {
    it('嵌套对象原样暴露：不是 observable，且就是传入的那个原始对象', () => {
      const nested = { name: 'John' };
      const state = shadowObservable({ user: nested });

      expect(state.user).toBe(nested); // 同一身份，非新代理
      expect(isObservable(state.user)).toBe(false);
      expect(raw(state.user)).toBe(nested);
    });

    it('嵌套对象内部属性变更不通知 reaction；整体替换根属性值才通知', () => {
      const state = shadowObservable({
        user: { name: 'John' },
      } as { user: { name: string } });
      const seen: { name: string }[] = [];
      const reaction = observe(() => {
        seen.push(state.user);
      });

      expect(seen.length).toBe(1);

      state.user.name = 'Jane'; // 嵌套内部变更：浅层语义下不通知
      expect(seen.length).toBe(1);

      state.user = { name: 'Jane' }; // 根级替换：通知
      expect(seen.length).toBe(2);
      expect(seen[1]).toEqual({ name: 'Jane' });

      unobserve(reaction);
    });

    it('任意深度的嵌套链路都不被包装：深层变更不通知，根级替换通知', () => {
      const state = shadowObservable({
        level1: { level2: { level3: { value: 'deep' } } },
      } as { level1: { level2: { level3: { value: string } } } });
      const seen: unknown[] = [];
      const reaction = observe(() => {
        seen.push(state.level1);
      });

      expect(seen.length).toBe(1);

      state.level1.level2.level3.value = 'changed';
      expect(seen.length).toBe(1);

      state.level1 = { level2: { level3: { value: 'new' } } };
      expect(seen.length).toBe(2);

      unobserve(reaction);
    });
  });

  describe('集合浅层语义：get / 迭代返回原始对象', () => {
    it('Map.get 返回存入的原始对象，经返回值修改不产生通知', () => {
      const nested = { value: 1 };
      const map = shadowObservable(new Map([['key', nested]]));
      const sizes: number[] = [];
      const reaction = observe(() => {
        sizes.push(map.size);
      });

      expect(map.get('key')).toBe(nested); // raw，不是 observable
      expect(isObservable(map.get('key') as object)).toBe(false);

      (map.get('key') as { value: number }).value = 2; // 不通知（浅层承诺）
      expect(sizes).toEqual([1]);

      unobserve(reaction);
    });

    it('Set 迭代（values / Symbol.iterator / forEach）返回原始成员', () => {
      const item1 = { id: 1 };
      const item2 = { id: 2 };
      const set = shadowObservable(new Set([item1, item2]));

      expect(Array.from(set)).toEqual([item1, item2]);
      expect(Array.from(set.values())).toEqual([item1, item2]);
      const forEachItems: unknown[] = [];
      set.forEach(v => forEachItems.push(v));
      expect(forEachItems).toEqual([item1, item2]);
      expect(isObservable(Array.from(set)[0])).toBe(false);
    });

    it('forEach 保留 thisArg，第三参是 shadow proxy；经第三参写入通知根级依赖（#191）', () => {
      const map = shadowObservable(new Map<string, number>([['a', 1]]));
      const ctx = { tag: 3 };
      let gotThis: unknown;
      let third: unknown;
      const sizes: number[] = [];
      const reaction = observe(() => {
        sizes.push(map.size);
      });
      expect(sizes).toEqual([1]);
      map.forEach(function (this: unknown, _v, k, m) {
        gotThis = this;
        third = m;
        m.set(k, 99);
        m.set('b', 2);
      }, ctx);
      expect(gotThis).toBe(ctx);
      expect(third).toBe(map);
      expect(isObservable(third)).toBe(true);
      expect(map.get('a')).toBe(99);
      expect(map.size).toBe(2);
      // #211 起 Map 值覆盖也通知值侧迭代依赖（size reaction 读的是
      // ITERATION_KEY）：m.set(k, 99) 覆盖 'a' 触发一次（size 仍 1）、
      // m.set('b', 2) 新增触发一次（size 2）；Map.forEach 会访问迭代中
      // 新增的 'b'，回调对 'b' 的两次覆盖各触发一次（size 2）。
      expect(sizes).toEqual([1, 1, 2, 2, 2]);
      unobserve(reaction);
    });

    it('WeakMap.get 返回存入的原始对象', () => {
      const key = { id: 1 };
      const nested = { value: 1 };
      const weakMap = shadowObservable(new WeakMap([[key, nested]]));

      expect(weakMap.get(key)).toBe(nested);
      expect(isObservable(weakMap.get(key) as object)).toBe(false);
    });

    it('Set.keys()/entries() 返回 raw 键（与 deep 的 proxy 键相对，#256 对照契约）', () => {
      // deep 模式为保持 keys === values 身份返回 proxy 键（#192）；
      // shadow 浅层语义不包装，keys/entries 的键就是原始成员本身，
      // 可直接与原始集合互操作（raw(set).has(key) 为 true）。
      const keyObj = { id: 1 };
      const set = shadowObservable(new Set([keyObj]));

      const [key] = Array.from(set.keys());
      expect(key).toBe(keyObj);
      expect(isObservable(key as object)).toBe(false);

      const [entry] = Array.from(set.entries());
      expect(entry[0]).toBe(keyObj);
      expect(entry[1]).toBe(keyObj);

      expect((raw(set) as Set<unknown>).has(key)).toBe(true);
    });

    it('向 shadow 集合存入 observable 代理会被解包为 raw（往返身份）', () => {
      // 已知行为（规格要求，GG5 审查确认）: shadow 集合内部只持有 raw 身份，
      // 存入的 proxy value 会被解包，get/迭代返回 raw。若未来改为保留 proxy
      // 身份，本用例失败是预期的 —— 改断言 + changeset 注明即可。
      const valObj = { v: 1 };
      const valProxy = observable(valObj);
      const map = shadowObservable(new Map());
      map.set('k', valProxy);

      expect(map.get('k')).toBe(valObj); // raw，不是存入的 valProxy
      expect(raw(map).get('k')).toBe(valObj);
    });
  });

  describe('与 observable() 对同一 raw 的双代理并存（G6 分桶）', () => {
    it('同一 raw 可同时持有 shadow 与 deep 两个代理，且各自调用幂等缓存', () => {
      const rawObj = { count: 0 };
      const s1 = shadowObservable(rawObj);
      const o1 = observable(rawObj);

      expect(s1).not.toBe(o1); // 两个不同的代理
      expect(shadowObservable(rawObj)).toBe(s1); // shadow 桶缓存
      expect(observable(rawObj)).toBe(o1); // deep 桶缓存
      expect(raw(s1)).toBe(rawObj);
      expect(raw(o1)).toBe(rawObj);
    });

    it('两种代理保持各自的深浅语义（shadow 浅、deep 深）', () => {
      const rawObj = { nested: { a: 1 } };
      const s = shadowObservable(rawObj);
      const o = observable(rawObj);

      const shadowSeen: number[] = [];
      const deepSeen: number[] = [];
      const r1 = observe(() => {
        shadowSeen.push(s.nested.a);
      });
      const r2 = observe(() => {
        deepSeen.push(o.nested.a);
      });

      expect(shadowSeen).toEqual([1]);
      expect(deepSeen).toEqual([1]);

      // 经 shadow 代理拿到的 nested 是原始对象（无 trap），写入不通知任何
      // reaction —— 包括同一 raw 的 deep 代理上建立的嵌套依赖。
      s.nested.a = 2;
      expect(shadowSeen).toEqual([1]);
      expect(deepSeen).toEqual([1]);

      // 经 deep 代理拿到的 nested 是子代理，嵌套写入通知 deep 依赖；
      // shadow 侧本来就没有嵌套依赖，不受影响。
      o.nested.a = 3;
      expect(shadowSeen).toEqual([1]);
      expect(deepSeen).toEqual([1, 3]);

      unobserve(r1);
      unobserve(r2);
    });

    it('两种代理共享连接表：任一代理的根级写入同时通知两侧建立的 reaction', () => {
      // 这是 JSDoc 明示承诺（G6 语义）：deep 与 shadow 代理写入同一 (raw, key)
      // 都会通知在另一个代理上建立的 reaction。
      const rawObj = { count: 0 };
      const s = shadowObservable(rawObj);
      const o = observable(rawObj);

      const shadowSeen: number[] = [];
      const deepSeen: number[] = [];
      const r1 = observe(() => {
        shadowSeen.push(s.count);
      });
      const r2 = observe(() => {
        deepSeen.push(o.count);
      });

      expect(shadowSeen).toEqual([0]);
      expect(deepSeen).toEqual([0]);

      s.count = 1; // shadow 代理写入 → 两侧都通知
      expect(shadowSeen).toEqual([0, 1]);
      expect(deepSeen).toEqual([0, 1]);

      o.count = 2; // deep 代理写入 → 两侧都通知
      expect(shadowSeen).toEqual([0, 1, 2]);
      expect(deepSeen).toEqual([0, 1, 2]);

      unobserve(r1);
      unobserve(r2);
    });

    it('传入已是 observable 代理（deep 或 shadow）时原样返回传入的代理，不换代理不降级', () => {
      const rawObj = { nested: { a: 1 }, count: 0 };
      const deepProxy = observable(rawObj);
      const shadowProxy = shadowObservable(rawObj);

      // shadowObservable(deepProxy) 返回 deepProxy 自身
      expect(shadowObservable(deepProxy)).toBe(deepProxy);
      // observable(shadowProxy) 返回 shadowProxy 自身
      expect(observable(shadowProxy)).toBe(shadowProxy);

      // 且不降级：deep 代理仍是深层响应式
      const seen: number[] = [];
      const reaction = observe(() => {
        seen.push(deepProxy.nested.a);
      });
      expect(seen).toEqual([1]);
      deepProxy.nested.a = 2;
      expect(seen).toEqual([1, 2]);

      unobserve(reaction);
    });
  });

  describe('数组浅层行为', () => {
    it('索引写入通知迭代 reaction，元素中的对象不被包装', () => {
      const nested = { name: 'John' };
      const state = shadowObservable([1, 2, 3, nested]);
      const snapshots: unknown[][] = [];
      const reaction = observe(() => {
        snapshots.push([...state]);
      });

      expect(snapshots).toEqual([[1, 2, 3, { name: 'John' }]]);

      state[0] = 10;
      expect(snapshots.length).toBe(2);
      expect(snapshots[1]).toEqual([10, 2, 3, { name: 'John' }]);

      // 元素对象是原始对象，内部变更不通知
      (state[3] as { name: string }).name = 'Jane';
      expect(snapshots.length).toBe(2);
      expect(isObservable(state[3])).toBe(false);

      unobserve(reaction);
    });

    it('push 新元素通知 size/迭代依赖', () => {
      const state = shadowObservable([1, 2]);
      const lengths: number[] = [];
      const reaction = observe(() => {
        lengths.push(state.length);
      });

      expect(lengths).toEqual([2]);

      state.push(3);
      expect(lengths).toEqual([2, 3]);

      unobserve(reaction);
    });
  });

  describe('shadow 独有的集合方法路由', () => {
    it('集合子类的自定义方法内部的 this.set 走响应式 trap（变更可被观察）', () => {
      // GG7 第 2 轮确认的路由承诺：子类自定义方法以 proxy 为 receiver 调用，
      // 内部 this.set 命中 instrumented trap —— 数据变更必须产生通知，
      // 不得静默绕过（曾因 bind(raw) 绕过全部 trap 而回归）。
      class MyMap<K, V> extends Map<K, V> {
        putTwice(k: K, v: V) {
          this.set(k, v);
          this.set(k, v);
        }
      }
      const sm = shadowObservable(new MyMap<string, number>());
      const seen: (number | undefined)[] = [];
      const reaction = observe(() => {
        seen.push(sm.get('a'));
      });

      expect(seen).toEqual([undefined]);

      sm.putTwice('a', 1);
      expect(seen).toEqual([undefined, 1]); // 自定义方法的写入触发了通知
      expect(sm.get('a')).toBe(1);

      unobserve(reaction);
    });

    it('ES2024 Set 只读方法（union/intersection/difference 等）以原生语义可用并建立迭代依赖', () => {
      // GG7 第 3 轮确认的行为：union 等纯只读原生集合方法以 raw 转发
      // （以 proxy 为 receiver 会因内部槽位 brand-check 抛
      // "incompatible receiver"）。业务可依赖它们可用、结果正确、且被追踪。
      type SetWithES2024Methods<T> = Set<T> & {
        union(other: Set<unknown>): Set<T>;
        intersection(other: Set<unknown>): Set<T>;
        difference(other: Set<unknown>): Set<T>;
        symmetricDifference(other: Set<unknown>): Set<T>;
      };
      const s = shadowObservable(new Set([1, 2, 3])) as SetWithES2024Methods<number>;

      expect(new Set(s.union(new Set([2, 3, 4])))).toEqual(new Set([1, 2, 3, 4]));
      expect(new Set(s.intersection(new Set([2, 3, 4])))).toEqual(new Set([2, 3]));
      expect(new Set(s.difference(new Set([2])))).toEqual(new Set([1, 3]));
      expect(new Set(s.symmetricDifference(new Set([3, 4])))).toEqual(new Set([1, 2, 4]));

      // 建立迭代依赖：集合变更后 reaction 重新运行
      const sizes: number[] = [];
      const reaction = observe(() => {
        sizes.push(s.union(new Set([9])).size);
      });
      expect(sizes).toEqual([4]);

      s.add(4);
      expect(sizes).toEqual([4, 5]);

      unobserve(reaction);
    });

    it('shadow 集合保持原生 constructor 恒等与字符串化能力', () => {
      const map = shadowObservable(new Map([['a', 1]]));
      const set = shadowObservable(new Set([1]));

      expect(map.constructor).toBe(Map);
      expect(set.constructor).toBe(Set);
      expect(() => String(map)).not.toThrow();
      expect(typeof String(map)).toBe('string');
    });
  });
});
