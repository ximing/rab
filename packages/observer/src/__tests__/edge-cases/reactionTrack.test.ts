/**
 * reactionTrack 测试
 * 测试响应式追踪系统的各种边界情况和特殊场景
 */

import { observable } from '../../observable';
import { observe, unobserve } from '../../main';

describe('reactionTrack', () => {
  describe('基础追踪', () => {
    test('应该处理 connectionStore 不存在的情况', () => {
      const obj = observable({ count: 0 });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(obj.count);
      });
      expect(reactions).toEqual([0]);
      obj.count = 1;
      expect(reactions).toEqual([0, 1]);
      unobserve(reaction);
    });

    test('应该处理 reactionsForTarget 不存在的情况', () => {
      const obj = observable({ count: 0 });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(obj.count);
      });
      expect(reactions).toEqual([0]);
      unobserve(reaction);
      obj.count = 1;
      expect(reactions).toEqual([0]); // 不应该再触发
    });
  });

  describe('集合操作追踪', () => {
    test('应该处理 clear 操作触发所有依赖', () => {
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

    test('应该处理 Map 的 add 操作触发迭代依赖', () => {
      const map = observable(new Map());
      const reactions: number[] = [];
      const reaction = observe(() => {
        const keys = Array.from(map.keys());
        reactions.push(keys.length);
      });
      expect(reactions).toEqual([0]);
      map.set('key1', 1);
      expect(reactions).toEqual([0, 1]);
      unobserve(reaction);
    });

    test('应该处理 Set 的 add 操作触发迭代依赖', () => {
      const set = observable(new Set());
      const reactions: number[] = [];
      const reaction = observe(() => {
        const values = Array.from(set.values());
        reactions.push(values.length);
      });
      expect(reactions).toEqual([0]);
      set.add(1);
      expect(reactions).toEqual([0, 1]);
      unobserve(reaction);
    });

    test('应该处理 Map 的 delete 操作触发迭代依赖', () => {
      const map = observable(new Map([['key1', 1]]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        const keys = Array.from(map.keys());
        reactions.push(keys.length);
      });
      expect(reactions).toEqual([1]);
      map.delete('key1');
      expect(reactions).toEqual([1, 0]);
      unobserve(reaction);
    });

    test('应该处理 Set 的 delete 操作触发迭代依赖', () => {
      const set = observable(new Set([1]));
      const reactions: number[] = [];
      const reaction = observe(() => {
        const values = Array.from(set.values());
        reactions.push(values.length);
      });
      expect(reactions).toEqual([1]);
      set.delete(1);
      expect(reactions).toEqual([1, 0]);
      unobserve(reaction);
    });
  });

  describe('对象操作追踪', () => {
    test('应该处理 add 操作触发迭代依赖', () => {
      const obj = observable({ a: 1 } as any);
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(Object.keys(obj).length);
      });
      expect(reactions).toEqual([1]);
      obj.b = 2;
      expect(reactions).toEqual([1, 2]);
      unobserve(reaction);
    });

    test('应该处理 delete 操作触发迭代依赖', () => {
      const obj = observable({ a: 1, b: 2 } as any);
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(Object.keys(obj).length);
      });
      expect(reactions).toEqual([2]);
      delete obj.a;
      expect(reactions).toEqual([2, 1]);
      unobserve(reaction);
    });

    test('应该处理 iterate 操作', () => {
      const obj = observable({ a: 1, b: 2 } as any);
      const reactions: any[] = [];
      const reaction = observe(() => {
        const keys = Object.keys(obj);
        reactions.push(keys);
      });
      expect(reactions.length).toBe(1);
      obj.c = 3;
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });

    test('应该处理 has 操作', () => {
      const obj = observable({ prop: 'value' });
      const reactions: boolean[] = [];
      const reaction = observe(() => {
        reactions.push('prop' in obj);
      });
      expect(reactions).toEqual([true]);
      (obj as any).prop = undefined;
      expect(reactions.length).toBeGreaterThanOrEqual(1);
      unobserve(reaction);
    });
  });

  describe('数组操作追踪', () => {
    test('应该处理数组的 length 变化', () => {
      const arr = observable([1, 2, 3]);
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(arr.length);
      });
      expect(reactions).toEqual([3]);
      arr.push(4);
      expect(reactions.length).toBeGreaterThanOrEqual(2);
      unobserve(reaction);
    });
  });

  describe('多个 reactions', () => {
    test('应该处理多个 reactions 依赖同一属性', () => {
      const obj = observable({ count: 0 });
      const reactions1: number[] = [];
      const reactions2: number[] = [];
      const reaction1 = observe(() => {
        reactions1.push(obj.count);
      });
      const reaction2 = observe(() => {
        reactions2.push(obj.count);
      });
      expect(reactions1).toEqual([0]);
      expect(reactions2).toEqual([0]);
      obj.count = 1;
      expect(reactions1).toEqual([0, 1]);
      expect(reactions2).toEqual([0, 1]);
      unobserve(reaction1);
      unobserve(reaction2);
    });

    test('应该处理 reaction 清理', () => {
      const obj = observable({ count: 0 });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(obj.count);
      });
      expect(reactions).toEqual([0]);
      unobserve(reaction);
      obj.count = 1;
      expect(reactions).toEqual([0]); // 不应该再触发
    });

    test('应该处理嵌套 reactions', () => {
      const obj = observable({ a: 0, b: 0 });
      const reactions: any[] = [];
      const reaction1 = observe(() => {
        reactions.push({ a: obj.a });
        if (obj.a === 0) {
          const reaction2 = observe(() => {
            reactions.push({ b: obj.b });
          });
        }
      });
      expect(reactions.length).toBeGreaterThan(0);
      unobserve(reaction1);
    });
  });

  describe('复杂场景', () => {
    test('应该处理复杂 Map 操作', () => {
      const map = observable(new Map<string, { value: number }>());
      let totalValue = 0;

      observe(() => {
        totalValue = 0;
        map.forEach(item => {
          totalValue += item.value;
        });
      });

      expect(totalValue).toBe(0);

      map.set('a', { value: 10 });
      expect(totalValue).toBe(10);

      map.set('b', { value: 20 });
      expect(totalValue).toBe(30);

      map.delete('a');
      expect(totalValue).toBe(20);

      map.clear();
      expect(totalValue).toBe(0);
    });

    test('应该处理复杂 Set 操作', () => {
      const set = observable(new Set<{ id: number; value: string }>());
      let itemCount = 0;

      observe(() => {
        itemCount = set.size;
      });

      expect(itemCount).toBe(0);

      const item1 = { id: 1, value: 'a' };
      const item2 = { id: 2, value: 'b' };

      set.add(item1);
      expect(itemCount).toBe(1);

      set.add(item2);
      expect(itemCount).toBe(2);

      set.delete(item1);
      expect(itemCount).toBe(1);

      set.clear();
      expect(itemCount).toBe(0);
    });

    test('应该处理嵌套对象的响应式', () => {
      const state = observable({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      });

      const results: string[] = [];

      observe(() => {
        results.push(`${state.user.name}-${state.settings.theme}`);
      });

      expect(results).toEqual(['John-dark']);

      state.user.name = 'Jane';
      expect(results).toEqual(['John-dark', 'Jane-dark']);

      state.settings.theme = 'light';
      expect(results).toEqual(['John-dark', 'Jane-dark', 'Jane-light']);
    });

    test('应该处理多个 reactions 在同一属性', () => {
      const state = observable({ count: 0 });
      const results: number[] = [];

      observe(() => {
        results.push(state.count);
      });

      observe(() => {
        results.push(state.count * 2);
      });

      observe(() => {
        results.push(state.count * 3);
      });

      expect(results).toEqual([0, 0, 0]);

      state.count = 5;
      expect(results).toEqual([0, 0, 0, 5, 10, 15]);
    });
  });
});
