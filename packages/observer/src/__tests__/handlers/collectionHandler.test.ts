/**
 * collectionHandler 测试
 * 测试集合类型（Map、Set、WeakMap、WeakSet）的处理
 * 包括各种操作和响应式追踪
 */

import { observable } from '../../observable';
import { observe, unobserve } from '../../main';

describe('collectionHandler', () => {
  describe('Map 操作', () => {
    test('应该处理 Map.set 新增键', () => {
      const map = observable(new Map<string, number>());
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(map.size);
      });
      expect(reactions).toEqual([0]);
      map.set('key1', 1);
      expect(reactions).toEqual([0, 1]);
      unobserve(reaction);
    });

    test('应该处理 Map.set 相同值不触发', () => {
      const map = observable(new Map([['key', 1]]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        reactions.push(map.get('key'));
      });
      expect(reactions).toEqual([1]);
      map.set('key', 1); // 相同值
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Map.set 不同值触发', () => {
      const map = observable(new Map([['key', 1]]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        reactions.push(map.get('key'));
      });
      expect(reactions).toEqual([1]);
      map.set('key', 2); // 不同值
      expect(reactions).toEqual([1, 2]); // 应该触发
      unobserve(reaction);
    });

    test('应该处理 Map.delete 存在的键', () => {
      const map = observable(new Map([['key1', 1]]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(map.size);
      });
      expect(reactions).toEqual([1]);
      map.delete('key1');
      expect(reactions).toEqual([1, 0]);
      unobserve(reaction);
    });

    test('应该处理 Map.delete 不存在的键', () => {
      const map = observable(new Map([['key1', 1]]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(map.size);
      });
      expect(reactions).toEqual([1]);
      map.delete('key2'); // 不存在的键
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Map.clear', () => {
      const map = observable(
        new Map([
          ['key1', 1],
          ['key2', 2],
        ])
      );
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(map.size);
      });
      expect(reactions).toEqual([2]);
      map.clear();
      expect(reactions).toEqual([2, 0]);
      unobserve(reaction);
    });

    test('应该处理 Map.clear 空集合', () => {
      const map = observable(new Map());
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(map.size);
      });
      expect(reactions).toEqual([0]);
      map.clear();
      expect(reactions).toEqual([0]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Map.get', () => {
      const map = observable(new Map([['key', 'value']]));
      expect(map.get('key')).toBe('value');
      expect(map.get('nonexistent')).toBeUndefined();
    });

    test('应该处理 Map.has', () => {
      const map = observable(new Map([['key', 'value']]));
      expect(map.has('key')).toBe(true);
      expect(map.has('nonexistent')).toBe(false);
    });

    test('应该处理 Map.forEach', () => {
      const map = observable(new Map([['key', 'value']]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const items: any[] = [];
        map.forEach((v, k) => {
          items.push([k, v]);
        });
        reactions.push(items);
      });
      expect(reactions.length).toBe(1);
      map.set('key2', 'value2');
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Map.keys', () => {
      const map = observable(new Map([['key', 'value']]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const keys = Array.from(map.keys());
        reactions.push(keys);
      });
      expect(reactions.length).toBe(1);
      map.set('key2', 'value2');
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Map.values', () => {
      const map = observable(new Map([['key', 'value']]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const values = Array.from(map.values());
        reactions.push(values);
      });
      expect(reactions.length).toBe(1);
      map.set('key2', 'value2');
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Map.entries', () => {
      const map = observable(new Map([['key', 'value']]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const entries = Array.from(map.entries());
        reactions.push(entries);
      });
      expect(reactions.length).toBe(1);
      map.set('key2', 'value2');
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Map[Symbol.iterator]', () => {
      const map = observable(new Map([['key', 'value']]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const entries = Array.from(map);
        reactions.push(entries);
      });
      expect(reactions.length).toBe(1);
      map.set('key2', 'value2');
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Map.size', () => {
      const map = observable(new Map([['key', 'value']]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(map.size);
      });
      expect(reactions).toEqual([1]);
      map.set('key2', 'value2');
      expect(reactions).toEqual([1, 2]);
      unobserve(reaction);
    });
  });

  describe('Set 操作', () => {
    test('应该处理 Set.add 新值', () => {
      const set = observable(new Set<number>());
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([0]);
      set.add(1);
      expect(reactions).toEqual([0, 1]);
      unobserve(reaction);
    });

    test('应该处理 Set.add 重复值', () => {
      const set = observable(new Set([1]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([1]);
      set.add(1); // 重复值
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Set.delete 存在的值', () => {
      const set = observable(new Set([1, 2]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([2]);
      set.delete(1);
      expect(reactions).toEqual([2, 1]);
      unobserve(reaction);
    });

    test('应该处理 Set.delete 不存在的值', () => {
      const set = observable(new Set([1]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([1]);
      set.delete(2); // 不存在的值
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Set.clear', () => {
      const set = observable(new Set([1, 2]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([2]);
      set.clear();
      expect(reactions).toEqual([2, 0]);
      unobserve(reaction);
    });

    test('应该处理 Set.clear 空集合', () => {
      const set = observable(new Set());
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([0]);
      set.clear();
      expect(reactions).toEqual([0]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Set.has', () => {
      const set = observable(new Set([1, 2, 3]));
      expect(set.has(1)).toBe(true);
      expect(set.has(999)).toBe(false);
    });

    test('应该处理 Set.forEach', () => {
      const set = observable(new Set([1, 2]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const items: any[] = [];
        set.forEach(v => {
          items.push(v);
        });
        reactions.push(items);
      });
      expect(reactions.length).toBe(1);
      set.add(3);
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Set.values', () => {
      const set = observable(new Set([1, 2]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const values = Array.from(set.values());
        reactions.push(values);
      });
      expect(reactions.length).toBe(1);
      set.add(3);
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Set.keys', () => {
      const set = observable(new Set([1, 2]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const keys = Array.from(set.keys());
        reactions.push(keys);
      });
      expect(reactions.length).toBe(1);
      set.add(3);
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Set.entries', () => {
      const set = observable(new Set([1, 2]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const entries = Array.from(set.entries());
        reactions.push(entries);
      });
      expect(reactions.length).toBe(1);
      set.add(3);
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Set[Symbol.iterator]', () => {
      const set = observable(new Set([1, 2]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        const values = Array.from(set);
        reactions.push(values);
      });
      expect(reactions.length).toBe(1);
      set.add(3);
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 Set.size', () => {
      const set = observable(new Set([1, 2]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([2]);
      set.add(3);
      expect(reactions).toEqual([2, 3]);
      unobserve(reaction);
    });
  });

  describe('WeakMap 操作', () => {
    test('应该处理 WeakMap 基本操作', () => {
      const key1 = {};
      const key2 = {};
      const weakMap = observable(new WeakMap([[key1, 'value1']]));

      expect(weakMap.has(key1)).toBe(true);
      expect(weakMap.has(key2)).toBe(false);
      expect(weakMap.get(key1)).toBe('value1');
      expect(weakMap.get(key2)).toBeUndefined();

      weakMap.set(key2, 'value2');
      expect(weakMap.get(key2)).toBe('value2');

      expect(weakMap.delete(key1)).toBe(true);
      expect(weakMap.has(key1)).toBe(false);
      expect(weakMap.delete(key1)).toBe(false);
    });

    test('应该处理 WeakMap.get 返回 undefined', () => {
      const wm = observable(new WeakMap());
      const key = {};
      const result = wm.get(key);
      expect(result).toBeUndefined();
    });
  });

  describe('WeakSet 操作', () => {
    test('应该处理 WeakSet 基本操作', () => {
      const obj1 = {};
      const obj2 = {};
      const weakSet = observable(new WeakSet([obj1]));

      expect(weakSet.has(obj1)).toBe(true);
      expect(weakSet.has(obj2)).toBe(false);

      weakSet.add(obj2);
      expect(weakSet.has(obj2)).toBe(true);

      expect(weakSet.delete(obj1)).toBe(true);
      expect(weakSet.has(obj1)).toBe(false);
      expect(weakSet.delete(obj1)).toBe(false);
    });
  });

  describe('非集合对象处理', () => {
    test('应该处理非集合对象的 has', () => {
      const obs = observable({ prop: 'value' });
      const result = (obs as any).has?.('prop');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 get', () => {
      const obs = observable({ prop: 'value' });
      const result = (obs as any).get?.('prop');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 add', () => {
      const obs = observable({ prop: 'value' });
      const result = (obs as any).add?.('value');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 set', () => {
      const obs = observable({ prop: 'value' });
      const result = (obs as any).set?.('key', 'value');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 delete', () => {
      const obs = observable({ prop: 'value' });
      const result = (obs as any).delete?.('key');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 clear', () => {
      const obs = observable({ prop: 'value' });
      const result = (obs as any).clear?.();
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 forEach', () => {
      const obs = observable({ prop: 'value' });
      const callback = jest.fn();
      const result = (obs as any).forEach?.(callback);
      expect(result).toBeUndefined();
      expect(callback).not.toHaveBeenCalled();
    });

    test('应该处理非集合对象的 size', () => {
      const obs = observable({ prop: 'value' });
      const result = (obs as any).size;
      expect(result).toBeUndefined();
    });
  });

  describe('返回值验证', () => {
    test('Map.set 应该返回 this', () => {
      const map = observable(new Map());
      const result = map.set('key', 'value');
      expect(result).toBe(map);
    });

    test('Set.add 应该返回 this', () => {
      const set = observable(new Set());
      const result = set.add('value');
      expect(result).toBe(set);
    });

    test('Map.delete 应该返回 boolean', () => {
      const map = observable(new Map([['key', 'value']]));
      const result = map.delete('key');
      expect(typeof result).toBe('boolean');
    });

    test('Set.delete 应该返回 boolean', () => {
      const set = observable(new Set([1]));
      const result = set.delete(1);
      expect(typeof result).toBe('boolean');
    });
  });
});
