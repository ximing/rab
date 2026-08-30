/**
 * Map 值覆盖的迭代通知测试
 *
 * 值侧迭代（forEach/values/entries/Symbol.iterator/size）必须感知已有
 * key 的值覆盖；key 侧迭代（Map.keys()）不应被值覆盖误触发（#211）。
 * 语义与 Vue 3 对齐（MAP_KEY_ITERATE_KEY 的拆分设计）。
 */
import vm from 'vm';
import { observable, shadowObservable, observe, unobserve } from '../main';

describe('Map 值覆盖通知迭代依赖（#211）', () => {
  describe('deep observable', () => {
    it('forEach reaction 感知已有 key 的值覆盖', () => {
      const map = observable(new Map<string, number>([['k', 1]]));
      let sum = 0;
      const reaction = observe(() => {
        sum = 0;
        map.forEach(v => {
          sum += v;
        });
      });
      expect(sum).toBe(1);

      map.set('k', 5);
      expect(sum).toBe(5);
      unobserve(reaction);
    });

    it('values() 迭代 reaction 感知值覆盖', () => {
      const map = observable(new Map<string, number>([['k', 1]]));
      const seen: number[] = [];
      const reaction = observe(() => {
        seen.length = 0;
        for (const v of map.values()) {
          seen.push(v);
        }
      });
      expect(seen).toEqual([1]);

      map.set('k', 5);
      expect(seen).toEqual([5]);
      unobserve(reaction);
    });

    it('entries() / for...of 默认迭代感知值覆盖', () => {
      const map = observable(new Map<string, number>([['k', 1]]));
      let last = -1;
      const reaction = observe(() => {
        for (const [, v] of map) {
          last = v;
        }
      });
      expect(last).toBe(1);

      map.set('k', 7);
      expect(last).toBe(7);
      unobserve(reaction);
    });

    it('Map.keys() 迭代不被值覆盖误触发', () => {
      const map = observable(new Map<string, number>([['k', 1]]));
      const keysSeen: string[][] = [];
      const reaction = observe(() => {
        keysSeen.push([...map.keys()]);
      });
      expect(keysSeen).toEqual([['k']]);

      map.set('k', 5);
      expect(keysSeen).toEqual([['k']]); // key 集合没变，keys() 不重跑

      map.set('new', 1);
      expect(keysSeen).toEqual([['k'], ['k', 'new']]); // 增删仍触发
      map.delete('new');
      expect(keysSeen).toEqual([['k'], ['k', 'new'], ['k']]);
      unobserve(reaction);
    });

    it('新增 key 仍触发值侧迭代（回归）', () => {
      const map = observable(new Map<string, number>([['k', 1]]));
      let count = -1;
      const reaction = observe(() => {
        count = 0;
        map.forEach(() => {
          count++;
        });
      });
      expect(count).toBe(1);

      map.set('k2', 2);
      expect(count).toBe(2);
      unobserve(reaction);
    });

    it('跨 realm Map 值覆盖仍通知 forEach（instanceof 失效，走 tag+duck-check）', () => {
      const rm = vm.runInNewContext("new Map([['k', 1]])") as Map<string, number>;
      const map = observable(rm);
      let sum = 0;
      const reaction = observe(() => {
        sum = 0;
        map.forEach(v => {
          sum += v;
        });
      });
      expect(sum).toBe(1);

      map.set('k', 5);
      expect(sum).toBe(5);
      unobserve(reaction);
    });
  });

  describe('shadowObservable', () => {
    it('forEach reaction 感知已有 key 的值覆盖', () => {
      const map = shadowObservable(new Map<string, number>([['k', 1]]));
      let sum = 0;
      const reaction = observe(() => {
        sum = 0;
        map.forEach(v => {
          sum += v;
        });
      });
      expect(sum).toBe(1);

      map.set('k', 5);
      expect(sum).toBe(5);
      unobserve(reaction);
    });

    it('Map.keys() 迭代不被值覆盖误触发', () => {
      const map = shadowObservable(new Map<string, number>([['k', 1]]));
      const keysSeen: string[][] = [];
      const reaction = observe(() => {
        keysSeen.push([...map.keys()]);
      });
      expect(keysSeen).toEqual([['k']]);

      map.set('k', 5);
      expect(keysSeen).toEqual([['k']]);

      map.set('new', 1);
      expect(keysSeen).toEqual([['k'], ['k', 'new']]);
      unobserve(reaction);
    });
  });

  describe('普通对象不受影响（对照）', () => {
    it('普通对象已有属性赋值不触发 ownKeys 依赖', () => {
      const state = observable({ a: 1, b: 2 });
      const keysSeen: string[][] = [];
      const reaction = observe(() => {
        keysSeen.push(Object.keys(state));
      });
      expect(keysSeen).toEqual([['a', 'b']]);

      state.a = 99;
      expect(keysSeen).toEqual([['a', 'b']]); // 值覆盖不改变键集合
      unobserve(reaction);
    });

    it('伪造 [object Map] tag 的普通对象赋值不触发 ownKeys 依赖', () => {
      const fake = { [Symbol.toStringTag]: 'Map', a: 1, b: 2 };
      const state = observable(fake);
      const keysSeen: string[][] = [];
      const reaction = observe(() => {
        keysSeen.push(Object.keys(state));
      });
      expect(keysSeen).toEqual([['a', 'b']]);

      (state as { a: number }).a = 99;
      expect(keysSeen).toEqual([['a', 'b']]);
      unobserve(reaction);
    });

    it('throwing toStringTag 的普通对象赋值不抛且不触发 ownKeys', () => {
      const rawObj = { a: 1, b: 2 };
      Object.defineProperty(rawObj, Symbol.toStringTag, {
        get() {
          throw new Error('boom-tag');
        },
      });
      const state = observable(rawObj);
      const keysSeen: string[][] = [];
      const reaction = observe(() => {
        keysSeen.push(Object.keys(state));
      });
      expect(() => {
        state.a = 99;
      }).not.toThrow();
      expect(keysSeen).toEqual([['a', 'b']]);
      unobserve(reaction);
    });
  });
});
