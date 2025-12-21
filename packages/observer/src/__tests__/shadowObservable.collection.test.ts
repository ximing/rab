import { shadowObservable } from '../shadowObservable';
import { observe, unobserve } from '../observer';
import { isObservable } from '../internals/utils';

describe('shadowObservable - 集合类型支持', () => {
  describe('Map 集合支持', () => {
    it('应该创建一个浅层响应式的 Map', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      expect(isObservable(map)).toBe(true);
      expect(map.get('key')).toBe('value');
    });

    it('Map.set 操作应该触发 observer', () => {
      const map = shadowObservable(new Map<string, number>());
      const reactions: number[] = [];

      const reaction = observe(() => {
        reactions.push(map.size);
      });

      expect(reactions).toEqual([0]);

      map.set('key1', 1);
      expect(reactions).toEqual([0, 1]);

      map.set('key2', 2);
      expect(reactions).toEqual([0, 1, 2]);

      unobserve(reaction);
    });

    it('Map.delete 操作应该触发 observer', () => {
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

    it('Map.clear 操作应该触发 observer', () => {
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

    it('Map 中的嵌套对象不应该被转换为 observable', () => {
      const nestedObj = { value: 1 };
      const map = shadowObservable(new Map([['key', nestedObj]]));
      const val = map.get('key');

      expect(val).toBe(nestedObj);
      expect(isObservable(val)).toBe(false);
    });

    it('Map 中嵌套对象的属性变化不应该触发 observer', () => {
      const nestedObj = { value: 1 };
      const map = shadowObservable(new Map([['key', nestedObj]]));
      const reactions: number[] = [];

      const reaction = observe(() => {
        reactions.push(map.size);
      });

      expect(reactions).toEqual([1]);

      // 修改嵌套对象的属性，不应该触发 observer
      const val = map.get('key') as any;
      val.value = 2;
      expect(reactions).toEqual([1]);

      unobserve(reaction);
    });

    it('Map.has 操作应该建立依赖关系', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const reactions: boolean[] = [];

      const reaction = observe(() => {
        reactions.push(map.has('key'));
      });

      expect(reactions).toEqual([true]);

      map.delete('key');
      expect(reactions).toEqual([true, false]);

      unobserve(reaction);
    });

    it('Map.get 操作应该建立依赖关系', () => {
      const map = shadowObservable(new Map([['key', 'value1']]));
      const reactions: (string | undefined)[] = [];

      const reaction = observe(() => {
        reactions.push(map.get('key'));
      });

      expect(reactions).toEqual(['value1']);

      map.set('key', 'value2');
      expect(reactions).toEqual(['value1', 'value2']);

      unobserve(reaction);
    });

    it('Map.forEach 应该建立迭代依赖', () => {
      const map = shadowObservable(
        new Map([
          ['key1', 1],
          ['key2', 2],
        ])
      );
      const reactions: number[] = [];

      const reaction = observe(() => {
        let sum = 0;
        map.forEach(value => {
          sum += value as number;
        });
        reactions.push(sum);
      });

      expect(reactions).toEqual([3]);

      map.set('key3', 3);
      expect(reactions).toEqual([3, 6]);

      unobserve(reaction);
    });

    it('Map.values 迭代应该返回原始值', () => {
      const nestedObj1 = { value: 1 };
      const nestedObj2 = { value: 2 };
      const map = shadowObservable(
        new Map([
          ['key1', nestedObj1],
          ['key2', nestedObj2],
        ])
      );

      const values = Array.from(map.values());
      expect(values).toEqual([nestedObj1, nestedObj2]);
      expect(values.every(v => !isObservable(v))).toBe(true);
    });

    it('Map.entries 迭代应该返回原始值', () => {
      const nestedObj1 = { value: 1 };
      const nestedObj2 = { value: 2 };
      const map = shadowObservable(
        new Map([
          ['key1', nestedObj1],
          ['key2', nestedObj2],
        ])
      );

      const entries = Array.from(map.entries());
      expect(entries).toEqual([
        ['key1', nestedObj1],
        ['key2', nestedObj2],
      ]);
      expect(entries.every(([, v]) => !isObservable(v))).toBe(true);
    });

    it('Map Symbol.iterator 应该返回原始值', () => {
      const nestedObj1 = { value: 1 };
      const nestedObj2 = { value: 2 };
      const map = shadowObservable(
        new Map([
          ['key1', nestedObj1],
          ['key2', nestedObj2],
        ])
      );

      const entries = Array.from(map);
      expect(entries).toEqual([
        ['key1', nestedObj1],
        ['key2', nestedObj2],
      ]);
      expect(entries.every(([, v]) => !isObservable(v))).toBe(true);
    });
  });

  describe('Set 集合支持', () => {
    it('应该创建一个浅层响应式的 Set', () => {
      const set = shadowObservable(new Set(['value1', 'value2']));
      expect(isObservable(set)).toBe(true);
      expect(set.has('value1')).toBe(true);
    });

    it('Set.add 操作应该触发 observer', () => {
      const set = shadowObservable(new Set<number>());
      const reactions: number[] = [];

      const reaction = observe(() => {
        reactions.push(set.size);
      });

      expect(reactions).toEqual([0]);

      set.add(1);
      expect(reactions).toEqual([0, 1]);

      set.add(2);
      expect(reactions).toEqual([0, 1, 2]);

      unobserve(reaction);
    });

    it('Set.delete 操作应该触发 observer', () => {
      const set = shadowObservable(new Set([1, 2, 3]));
      const reactions: number[] = [];

      const reaction = observe(() => {
        reactions.push(set.size);
      });

      expect(reactions).toEqual([3]);

      set.delete(1);
      expect(reactions).toEqual([3, 2]);

      unobserve(reaction);
    });

    it('Set.clear 操作应该触发 observer', () => {
      const set = shadowObservable(new Set([1, 2, 3]));
      const reactions: number[] = [];

      const reaction = observe(() => {
        reactions.push(set.size);
      });

      expect(reactions).toEqual([3]);

      set.clear();
      expect(reactions).toEqual([3, 0]);

      unobserve(reaction);
    });

    it('Set 中的嵌套对象不应该被转换为 observable', () => {
      const nestedObj = { value: 1 };
      const set = shadowObservable(new Set([nestedObj]));

      const values = Array.from(set);
      expect(values[0]).toBe(nestedObj);
      expect(isObservable(values[0])).toBe(false);
    });

    it('Set 中嵌套对象的属性变化不应该触发 observer', () => {
      const nestedObj = { value: 1 };
      const set = shadowObservable(new Set([nestedObj]));
      const reactions: number[] = [];

      const reaction = observe(() => {
        reactions.push(set.size);
      });

      expect(reactions).toEqual([1]);

      // 修改嵌套对象的属性，不应该触发 observer
      nestedObj.value = 2;
      expect(reactions).toEqual([1]);

      unobserve(reaction);
    });

    it('Set.has 操作应该建立依赖关系', () => {
      const obj = { value: 1 };
      const set = shadowObservable(new Set([obj]));
      const reactions: boolean[] = [];

      const reaction = observe(() => {
        reactions.push(set.has(obj));
      });

      expect(reactions).toEqual([true]);

      set.delete(obj);
      expect(reactions).toEqual([true, false]);

      unobserve(reaction);
    });

    it('Set.forEach 应该建立迭代依赖', () => {
      const set = shadowObservable(new Set([1, 2, 3]));
      const reactions: number[] = [];

      const reaction = observe(() => {
        let sum = 0;
        set.forEach(value => {
          sum += value as number;
        });
        reactions.push(sum);
      });

      expect(reactions).toEqual([6]);

      set.add(4);
      expect(reactions).toEqual([6, 10]);

      unobserve(reaction);
    });

    it('Set.values 迭代应该返回原始值', () => {
      const nestedObj1 = { value: 1 };
      const nestedObj2 = { value: 2 };
      const set = shadowObservable(new Set([nestedObj1, nestedObj2]));

      const values = Array.from(set.values());
      expect(values).toEqual([nestedObj1, nestedObj2]);
      expect(values.every(v => !isObservable(v))).toBe(true);
    });

    it('Set Symbol.iterator 应该返回原始值', () => {
      const nestedObj1 = { value: 1 };
      const nestedObj2 = { value: 2 };
      const set = shadowObservable(new Set([nestedObj1, nestedObj2]));

      const values = Array.from(set);
      expect(values).toEqual([nestedObj1, nestedObj2]);
      expect(values.every(v => !isObservable(v))).toBe(true);
    });
  });

  describe('WeakMap 集合支持', () => {
    it('应该创建一个浅层响应式的 WeakMap', () => {
      const key = { id: 1 };
      const weakMap = shadowObservable(new WeakMap([[key, 'value']]));
      expect(isObservable(weakMap)).toBe(true);
      expect(weakMap.get(key)).toBe('value');
    });

    it('WeakMap.set 操作应该触发 observer', () => {
      const key1 = { id: 1 };
      const key2 = { id: 2 };
      const weakMap = shadowObservable(new WeakMap<object, number>());
      const reactions: (number | undefined)[] = [];

      const reaction = observe(() => {
        // 通过访问特定的键来建立依赖关系
        reactions.push(weakMap.get(key1));
      });

      expect(reactions).toEqual([undefined]);

      weakMap.set(key1, 1);
      expect(reactions).toEqual([undefined, 1]);

      weakMap.set(key1, 2);
      expect(reactions).toEqual([undefined, 1, 2]);

      // 设置 key2 不应该触发 observer，因为 observer 只依赖 key1
      weakMap.set(key2, 3);
      expect(reactions).toEqual([undefined, 1, 2]);

      unobserve(reaction);
    });

    it('WeakMap.has 操作应该建立依赖关系', () => {
      const key = { id: 1 };
      const weakMap = shadowObservable(new WeakMap([[key, 'value']]));
      const reactions: boolean[] = [];

      const reaction = observe(() => {
        reactions.push(weakMap.has(key));
      });

      expect(reactions).toEqual([true]);

      weakMap.delete(key);
      expect(reactions).toEqual([true, false]);

      unobserve(reaction);
    });

    it('WeakMap.get 操作应该建立依赖关系', () => {
      const key = { id: 1 };
      const weakMap = shadowObservable(new WeakMap([[key, 'value1']]));
      const reactions: (string | undefined)[] = [];

      const reaction = observe(() => {
        reactions.push(weakMap.get(key));
      });

      expect(reactions).toEqual(['value1']);

      weakMap.set(key, 'value2');
      expect(reactions).toEqual(['value1', 'value2']);

      unobserve(reaction);
    });

    it('WeakMap 中的嵌套对象不应该被转换为 observable', () => {
      const key = { id: 1 };
      const nestedObj = { value: 1 };
      const weakMap = shadowObservable(new WeakMap([[key, nestedObj]]));

      const val = weakMap.get(key);
      expect(val).toBe(nestedObj);
      expect(isObservable(val)).toBe(false);
    });
  });

  describe('WeakSet 集合支持', () => {
    it('应该创建一个浅层响应式的 WeakSet', () => {
      const obj = { id: 1 };
      const weakSet = shadowObservable(new WeakSet([obj]));
      expect(isObservable(weakSet)).toBe(true);
      expect(weakSet.has(obj)).toBe(true);
    });

    it('WeakSet.add 操作应该触发 observer', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const weakSet = shadowObservable(new WeakSet<object>());
      const reactions: boolean[] = [];

      const reaction = observe(() => {
        // 通过访问特定的对象来建立依赖关系
        reactions.push(weakSet.has(obj1));
      });

      expect(reactions).toEqual([false]);

      weakSet.add(obj1);
      expect(reactions).toEqual([false, true]);

      // 再次添加 obj1 不应该触发 observer（因为值没有变化）
      weakSet.add(obj1);
      expect(reactions).toEqual([false, true]);

      // 添加 obj2 不应该触发 observer，因为 observer 只依赖 obj1
      weakSet.add(obj2);
      expect(reactions).toEqual([false, true]);

      unobserve(reaction);
    });

    it('WeakSet.has 操作应该建立依赖关系', () => {
      const obj = { id: 1 };
      const weakSet = shadowObservable(new WeakSet([obj]));
      const reactions: boolean[] = [];

      const reaction = observe(() => {
        reactions.push(weakSet.has(obj));
      });

      expect(reactions).toEqual([true]);

      weakSet.delete(obj);
      expect(reactions).toEqual([true, false]);

      unobserve(reaction);
    });
  });
});
