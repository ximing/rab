/**
 * shadowCollectionHandler 测试
 * 测试影子集合处理器的各种操作
 * 影子集合不会包装嵌套对象，返回原始值
 */

import { shadowObservable } from '../../shadowObservable';
import { observe, unobserve, isObservable } from '../../main';

describe('shadowCollectionHandler', () => {
  describe('Map 操作', () => {
    test('应该处理 Map.set 新增键', () => {
      const map = shadowObservable(new Map<string, number>());
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
      const map = shadowObservable(new Map([['key', 1]]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        reactions.push(map.get('key'));
      });
      expect(reactions).toEqual([1]);
      map.set('key', 1);
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Map.set 不同值触发', () => {
      const map = shadowObservable(new Map([['key', 1]]));
      const reactions: any[] = [];
      const reaction = observe(() => {
        reactions.push(map.get('key'));
      });
      expect(reactions).toEqual([1]);
      map.set('key', 2);
      expect(reactions).toEqual([1, 2]); // 应该触发
      unobserve(reaction);
    });

    test('应该处理 Map.delete 存在的键', () => {
      const map = shadowObservable(
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
      map.delete('key1');
      expect(reactions).toEqual([2, 1]);
      unobserve(reaction);
    });

    test('应该处理 Map.delete 不存在的键', () => {
      const map = shadowObservable(new Map([['key1', 1]]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(map.size);
      });
      expect(reactions).toEqual([1]);
      map.delete('key2');
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Map.clear', () => {
      const map = shadowObservable(
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
      const map = shadowObservable(new Map());
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(map.size);
      });
      expect(reactions).toEqual([0]);
      map.clear();
      expect(reactions).toEqual([0]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Map.get 返回原始值', () => {
      const nestedObj = { value: 1 };
      const map = shadowObservable(new Map([['key', nestedObj]]));
      const val = map.get('key');
      expect(val).toBe(nestedObj);
      expect(isObservable(val)).toBe(false);
    });

    test('应该处理 Map.has', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      expect(map.has('key')).toBe(true);
      expect(map.has('nonexistent')).toBe(false);
    });

    test('应该处理 Map.forEach 返回原始值', () => {
      const nestedObj = { value: 1 };
      const map = shadowObservable(new Map([['key', nestedObj]]));
      let receivedValue: any;
      map.forEach(v => {
        receivedValue = v;
      });
      expect(receivedValue).toBe(nestedObj);
      expect(isObservable(receivedValue)).toBe(false);
    });

    test('应该处理 Map.keys', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
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

    test('应该处理 Map.values 返回原始值', () => {
      const nestedObj = { value: 1 };
      const map = shadowObservable(new Map([['key', nestedObj]]));
      const values = Array.from(map.values());
      expect(values[0]).toBe(nestedObj);
      expect(isObservable(values[0])).toBe(false);
    });

    test('应该处理 Map.entries 返回原始值', () => {
      const nestedObj = { value: 1 };
      const map = shadowObservable(new Map([['key', nestedObj]]));
      const entries = Array.from(map.entries());
      expect(entries[0][1]).toBe(nestedObj);
      expect(isObservable(entries[0][1])).toBe(false);
    });

    test('应该处理 Map[Symbol.iterator] 返回原始值', () => {
      const nestedObj = { value: 1 };
      const map = shadowObservable(new Map([['key', nestedObj]]));
      const entries = Array.from(map);
      expect(entries[0][1]).toBe(nestedObj);
      expect(isObservable(entries[0][1])).toBe(false);
    });

    test('应该处理 Map.size', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
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
      const set = shadowObservable(new Set<number>());
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
      const set = shadowObservable(new Set([1]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([1]);
      set.add(1);
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Set.delete 存在的值', () => {
      const set = shadowObservable(new Set([1, 2]));
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
      const set = shadowObservable(new Set([1]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(set.size);
      });
      expect(reactions).toEqual([1]);
      set.delete(2);
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理 Set.clear', () => {
      const set = shadowObservable(new Set([1, 2]));
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
      const set = shadowObservable(new Set());
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
      const set = shadowObservable(new Set([1, 2, 3]));
      expect(set.has(1)).toBe(true);
      expect(set.has(999)).toBe(false);
    });

    test('应该处理 Set.forEach', () => {
      const set = shadowObservable(new Set([1, 2]));
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
      const set = shadowObservable(new Set([1, 2]));
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
      const set = shadowObservable(new Set([1, 2]));
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
      const set = shadowObservable(new Set([1, 2]));
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
      const set = shadowObservable(new Set([1, 2]));
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
      const set = shadowObservable(new Set([1, 2]));
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
      const weakMap = shadowObservable(new WeakMap([[key1, { value: 1 }]]));

      let callCount = 0;
      observe(() => {
        weakMap.has(key1);
        callCount++;
      });

      expect(callCount).toBe(1);

      expect(weakMap.has(key1)).toBe(true);
      expect(weakMap.has(key2)).toBe(false);

      const val = weakMap.get(key1);
      expect(val).toEqual({ value: 1 });
      expect(isObservable(val as object)).toBe(false);

      weakMap.set(key2, { value: 2 });
      expect(weakMap.get(key2)).toEqual({ value: 2 });

      expect(weakMap.delete(key1)).toBe(true);
      expect(weakMap.has(key1)).toBe(false);
    });

    test('应该处理 WeakMap.get 返回 undefined', () => {
      const wm = shadowObservable(new WeakMap());
      const key = {};
      const result = wm.get(key);
      expect(result).toBeUndefined();
    });
  });

  describe('WeakSet 操作', () => {
    test('应该处理 WeakSet 基本操作', () => {
      const obj1 = {};
      const obj2 = {};
      const weakSet = shadowObservable(new WeakSet([obj1]));

      let callCount = 0;
      observe(() => {
        weakSet.has(obj1);
        callCount++;
      });

      expect(callCount).toBe(1);

      expect(weakSet.has(obj1)).toBe(true);
      expect(weakSet.has(obj2)).toBe(false);

      weakSet.add(obj2);
      expect(weakSet.has(obj2)).toBe(true);

      expect(weakSet.delete(obj1)).toBe(true);
      expect(weakSet.has(obj1)).toBe(false);
    });
  });

  describe('非集合对象处理', () => {
    test('应该处理非集合对象的 has', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const result = (shadow as any).has?.('prop');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 get', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const result = (shadow as any).get?.('prop');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 add', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const result = (shadow as any).add?.('value');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 set', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const result = (shadow as any).set?.('key', 'value');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 delete', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const result = (shadow as any).delete?.('key');
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 clear', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const result = (shadow as any).clear?.();
      expect(result).toBeUndefined();
    });

    test('应该处理非集合对象的 forEach', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const callback = jest.fn();
      const result = (shadow as any).forEach?.(callback);
      expect(result).toBeUndefined();
      expect(callback).not.toHaveBeenCalled();
    });

    test('应该处理非集合对象的 size', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const result = (shadow as any).size;
      expect(result).toBeUndefined();
    });
  });

  describe('返回值验证', () => {
    test('Map.set 应该返回 this', () => {
      const map = shadowObservable(new Map());
      const result = map.set('key', 'value');
      expect(result).toBe(map);
    });

    test('Set.add 应该返回 this', () => {
      const set = shadowObservable(new Set());
      const result = set.add('value');
      expect(result).toBe(set);
    });

    test('Map.delete 应该返回 boolean', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const result = map.delete('key');
      expect(typeof result).toBe('boolean');
    });

    test('Set.delete 应该返回 boolean', () => {
      const set = shadowObservable(new Set([1]));
      const result = set.delete(1);
      expect(typeof result).toBe('boolean');
    });
  });
});
