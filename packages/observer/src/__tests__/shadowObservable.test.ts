import { shadowObservable } from '../shadowObservable';
import { observe, unobserve } from '../observer';
import { isObservable, raw } from '../internals/utils';
describe('shadowObservable', () => {
  describe('基础功能', () => {
    it('应该创建一个浅层响应式对象', () => {
      const obj = { count: 0, name: 'test' };
      const shadow = shadowObservable(obj);
      expect(isObservable(shadow)).toBe(true);
      expect(shadow.count).toBe(0);
      expect(shadow.name).toBe('test');
    });

    it('应该返回相同的缓存代理', () => {
      const obj = { count: 0 };
      const shadow1 = shadowObservable(obj);
      const shadow2 = shadowObservable(obj);
      expect(shadow1).toBe(shadow2);
    });

    it('应该处理空对象', () => {
      const shadow = shadowObservable({});
      expect(isObservable(shadow)).toBe(true);
    });
  });

  describe('浅层响应式特性', () => {
    it('根级别属性变化应该触发 observer', () => {
      const state = shadowObservable({ count: 0 });
      const reactions: number[] = [];

      const reaction = observe(() => {
        reactions.push(state.count);
      });

      expect(reactions).toEqual([0]);

      state.count = 1;
      expect(reactions).toEqual([0, 1]);

      state.count = 2;
      expect(reactions).toEqual([0, 1, 2]);

      unobserve(reaction);
    });

    it('嵌套对象属性变化不应该触发 observer', () => {
      const state = shadowObservable({
        user: { name: 'John', age: 30 },
        count: 0,
      } as any);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push({
          user: state.user,
          count: state.count,
        });
      });

      expect(reactions.length).toBe(1);

      // 修改嵌套对象的属性，不应该触发 observer
      state.user.name = 'Jane';
      expect(reactions.length).toBe(1);

      state.user.age = 31;
      expect(reactions.length).toBe(1);

      // 修改根级别属性应该触发 observer
      state.count = 1;
      expect(reactions.length).toBe(2);

      unobserve(reaction);
    });

    it('替换整个嵌套对象应该触发 observer', () => {
      const state = shadowObservable({
        user: { name: 'John' },
      } as any);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push(state.user);
      });

      expect(reactions.length).toBe(1);

      // 替换整个对象应该触发 observer
      state.user = { name: 'Jane' };
      expect(reactions.length).toBe(2);
      expect(state.user.name).toBe('Jane');

      unobserve(reaction);
    });

    it('嵌套对象不应该被转换为 observable', () => {
      const nestedObj = { name: 'John' };
      const state = shadowObservable({
        user: nestedObj,
      } as any);

      // 嵌套对象应该是原始对象，不是 observable
      expect(isObservable(state.user)).toBe(false);
      expect(raw(state.user)).toBe(nestedObj);
    });
  });

  describe('属性操作', () => {
    it('应该支持添加新属性', () => {
      const state = shadowObservable({ count: 0 } as any);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push(Object.keys(state).length);
      });

      expect(reactions).toEqual([1]);

      state.name = 'test';
      expect(reactions).toEqual([1, 2]);
      expect(state.name).toBe('test');

      unobserve(reaction);
    });

    it('应该支持删除属性', () => {
      const state = shadowObservable({ count: 0, name: 'test' } as any);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push(Object.keys(state).length);
      });

      expect(reactions).toEqual([2]);

      delete state.name;
      expect(reactions).toEqual([2, 1]);
      expect(state.name).toBeUndefined();

      unobserve(reaction);
    });

    it('应该支持 in 操作符', () => {
      const state = shadowObservable({ count: 0 } as any);
      const reactions: boolean[] = [];

      const reaction = observe(() => {
        reactions.push('count' in state);
      });

      expect(reactions).toEqual([true]);

      delete state.count;
      expect(reactions).toEqual([true, false]);

      unobserve(reaction);
    });

    it('应该支持 for...in 循环', () => {
      const state = shadowObservable({ a: 1, b: 2 } as any);
      const reactions: string[][] = [];

      const reaction = observe(() => {
        const keys: string[] = [];
        for (const key in state) {
          keys.push(key);
        }
        reactions.push(keys);
      });

      expect(reactions.length).toBe(1);

      state.c = 3;
      expect(reactions.length).toBe(2);

      unobserve(reaction);
    });
  });

  describe('数组支持', () => {
    it('应该支持数组的根级别操作', () => {
      const state = shadowObservable([1, 2, 3]);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push([...state]);
      });

      expect(reactions).toEqual([[1, 2, 3]]);

      state[0] = 10;
      expect(reactions).toEqual([
        [1, 2, 3],
        [10, 2, 3],
      ]);

      unobserve(reaction);
    });

    it('数组中的嵌套对象不应该被转换为 observable', () => {
      const nestedObj = { name: 'John' };
      const state = shadowObservable([nestedObj]);

      expect(isObservable(state[0])).toBe(false);
      expect(raw(state[0])).toBe(nestedObj);
    });
  });

  describe('与 observable 的对比', () => {
    it('shadowObservable 不应该深层追踪，而 observable 应该', () => {
      const obj = { user: { name: 'John' } };

      const shadow = shadowObservable(obj);
      const shadowReactions: any[] = [];
      const shadowReaction = observe(() => {
        shadowReactions.push(shadow.user.name);
      });

      // 修改嵌套属性不触发 shadowObservable 的 observer
      shadow.user.name = 'Jane';
      expect(shadowReactions.length).toBe(1);

      unobserve(shadowReaction);
    });
  });

  describe('特殊情况', () => {
    it('应该处理 undefined 和 null 值', () => {
      const state = shadowObservable({
        a: undefined,
        b: null,
      } as any);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push({ a: state.a, b: state.b });
      });

      expect(reactions.length).toBe(1);

      state.a = 'value';
      expect(reactions.length).toBe(2);

      state.b = { nested: 'object' };
      expect(reactions.length).toBe(3);

      unobserve(reaction);
    });

    it('应该处理函数值', () => {
      const fn = () => 'test';
      const state = shadowObservable({
        callback: fn,
      } as any);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push(state.callback);
      });

      expect(reactions.length).toBe(1);

      const newFn = () => 'new';
      state.callback = newFn;
      expect(reactions.length).toBe(2);

      unobserve(reaction);
    });

    it('应该处理 Symbol 键', () => {
      const sym = Symbol('test');
      const state = shadowObservable({
        [sym]: 'value',
      } as any);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push(state[sym]);
      });

      expect(reactions.length).toBe(1);

      state[sym] = 'new value';
      expect(reactions.length).toBe(2);

      unobserve(reaction);
    });

    it('应该处理不可配置的属性', () => {
      const obj = {} as any;
      Object.defineProperty(obj, 'frozen', {
        value: 42,
        writable: false,
        configurable: false,
      });

      const state = shadowObservable(obj);
      expect(state.frozen).toBe(42);
    });
  });

  describe('性能特性', () => {
    it('应该避免深层包装的性能开销', () => {
      const deepObj = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      } as any;

      const state = shadowObservable(deepObj);
      const reactions: any[] = [];

      const reaction = observe(() => {
        reactions.push(state.level1);
      });

      // 深层属性变化不应该触发 observer
      state.level1.level2.level3.level4.value = 'changed';
      expect(reactions.length).toBe(1);

      // 只有根级别属性变化才触发
      state.level1 = { level2: { level3: { level4: { value: 'new' } } } };
      expect(reactions.length).toBe(2);

      unobserve(reaction);
    });
  });

  describe('raw 函数', () => {
    it('应该返回原始对象', () => {
      const obj = { count: 0 };
      const shadow = shadowObservable(obj);
      expect(raw(shadow)).toBe(obj);
    });
  });

  describe('多个 observer', () => {
    it('应该支持多个 observer 同时追踪', () => {
      const state = shadowObservable({ count: 0 });
      const reactions1: number[] = [];
      const reactions2: number[] = [];

      const reaction1 = observe(() => {
        reactions1.push(state.count);
      });

      const reaction2 = observe(() => {
        reactions2.push(state.count * 2);
      });

      expect(reactions1).toEqual([0]);
      expect(reactions2).toEqual([0]);

      state.count = 1;
      expect(reactions1).toEqual([0, 1]);
      expect(reactions2).toEqual([0, 2]);

      unobserve(reaction1);
      unobserve(reaction2);
    });
  });
});
