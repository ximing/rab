/**
 * shadowProxyHandler 测试
 * 测试影子代理处理器的各种操作和边界情况
 * 影子代理不会包装嵌套对象，只在顶层建立响应式
 */

import { shadowObservable } from '../../shadowObservable';
import { observe, unobserve, isObservable, raw } from '../../main';

describe('shadowProxyHandler', () => {
  describe('基础操作', () => {
    test('应该处理 get 操作', () => {
      const shadow = shadowObservable({ prop: 'value' });
      expect(shadow.prop).toBe('value');
    });

    test('应该处理 set 操作', () => {
      const shadow = shadowObservable({ count: 0 });
      shadow.count = 10;
      expect(shadow.count).toBe(10);
    });

    test('应该处理 deleteProperty 操作', () => {
      const shadow = shadowObservable({ prop: 'value' } as any);
      delete shadow.prop;
      expect(shadow.prop).toBeUndefined();
    });

    test('应该处理 has 操作', () => {
      const shadow = shadowObservable({ prop: 'value' });
      expect('prop' in shadow).toBe(true);
      expect('nonexistent' in shadow).toBe(false);
    });

    test('应该处理 ownKeys 操作', () => {
      const shadow = shadowObservable({ a: 1, b: 2 });
      const keys = Object.keys(shadow);
      expect(keys).toEqual(['a', 'b']);
    });
  });

  describe('Symbol 处理', () => {
    test('应该处理 Symbol 属性', () => {
      const sym = Symbol('test');
      const shadow = shadowObservable({ [sym]: 'value' });
      expect(shadow[sym]).toBe('value');
    });

    test('应该处理 well-known symbols', () => {
      const shadow = shadowObservable({ [Symbol.toStringTag]: 'CustomObject' });
      expect(shadow[Symbol.toStringTag]).toBe('CustomObject');
    });

    test('应该处理 Symbol.iterator', () => {
      const obj = {
        [Symbol.iterator]: function* () {
          yield 1;
        },
      };
      const shadow = shadowObservable(obj);
      expect(typeof shadow[Symbol.iterator]).toBe('function');
    });
  });

  describe('属性描述符处理', () => {
    test('应该处理 getter/setter', () => {
      let value = 0;
      const obj: any = {};
      Object.defineProperty(obj, 'prop', {
        get() {
          return value;
        },
        set(v) {
          value = v;
        },
      });
      const shadow = shadowObservable(obj);
      expect(shadow.prop).toBe(0);
      shadow.prop = 10;
      expect(shadow.prop).toBe(10);
    });

    test('应该处理不可配置属性', () => {
      const obj: any = {};
      Object.defineProperty(obj, 'frozen', {
        value: 42,
        writable: false,
        configurable: false,
      });
      const shadow = shadowObservable(obj);
      expect(shadow.frozen).toBe(42);
    });

    test('应该处理 Object.defineProperty', () => {
      const shadow = shadowObservable({} as any);
      Object.defineProperty(shadow, 'prop', {
        value: 42,
        writable: true,
        configurable: true,
      });
      expect(shadow.prop).toBe(42);
    });

    test('应该处理 Object.getOwnPropertyDescriptor', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const descriptor = Object.getOwnPropertyDescriptor(shadow, 'prop');
      expect(descriptor?.value).toBe('value');
    });
  });

  describe('原型链处理', () => {
    test('应该处理原型链中的 setter', () => {
      const parent = shadowObservable({ count: 0 });
      const child = shadowObservable(Object.create(parent));
      child.count = 10;
      expect(child.count).toBe(10);
    });

    test('应该处理 receiver 不是 proxy 的 set 操作', () => {
      const shadow = shadowObservable({ count: 0 });
      const obj = Object.create(shadow);
      obj.count = 10;
      expect(obj.count).toBe(10);
    });

    test('应该处理 receiver 是 null 的情况', () => {
      const shadow = shadowObservable({ count: 0 });
      const result = Reflect.set(shadow, 'count', 10, null as any);
      expect(typeof result).toBe('boolean');
    });

    test('应该处理 receiver 是 undefined 的情况', () => {
      const shadow = shadowObservable({ count: 0 });
      const result = Reflect.set(shadow, 'count', 10, undefined as any);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('construct 操作', () => {
    test('应该处理 construct 操作', () => {
      class MyClass {
        value = 42;
      }
      const ShadowClass = shadowObservable(MyClass);
      const instance = new ShadowClass();
      expect(instance.value).toBe(42);
    });

    test('应该处理 newTarget 是 proxy 的情况', () => {
      class MyClass {
        value = 42;
      }
      const ShadowClass = shadowObservable(MyClass);
      const instance = new ShadowClass();
      expect(instance.value).toBe(42);
      expect(instance instanceof MyClass).toBe(true);
    });

    test('应该处理 receiver 是 proxy 的 set 操作', () => {
      const shadow = shadowObservable({ count: 0 });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(shadow.count);
      });
      expect(reactions).toEqual([0]);
      shadow.count = 10;
      expect(reactions).toEqual([0, 10]);
      unobserve(reaction);
    });

    test('应该处理 receiver 不是 proxy 的 set 操作', () => {
      const shadow = shadowObservable({ count: 0 });
      const child = Object.create(shadow);
      child.count = 10;
      expect(child.count).toBe(10);
    });
  });

  describe('数组操作', () => {
    test('应该处理数组的 length 属性', () => {
      const arr = shadowObservable([1, 2, 3]);
      expect(arr.length).toBe(3);
      arr.length = 2;
      expect(arr.length).toBe(2);
    });

    test('应该处理数组的索引访问', () => {
      const arr = shadowObservable([1, 2, 3]);
      expect(arr[0]).toBe(1);
      arr[0] = 10;
      expect(arr[0]).toBe(10);
    });

    test('应该处理数组的 push 操作', () => {
      const shadow = shadowObservable([1, 2, 3]);
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(shadow.length);
      });
      expect(reactions).toEqual([3]);
      shadow.push(4);
      expect(reactions.length).toBeGreaterThanOrEqual(2);
      unobserve(reaction);
    });

    test('应该处理数组的索引访问响应式', () => {
      const shadow = shadowObservable([1, 2, 3]);
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(shadow[0]);
      });
      expect(reactions).toEqual([1]);
      shadow[0] = 10;
      expect(reactions).toEqual([1, 10]);
      unobserve(reaction);
    });
  });

  describe('Object 方法', () => {
    test('应该处理 Object.assign', () => {
      const shadow = shadowObservable({ a: 1 } as any);
      Object.assign(shadow, { b: 2 });
      expect(shadow.a).toBe(1);
      expect(shadow.b).toBe(2);
    });

    test('应该处理 for...in 循环', () => {
      const shadow = shadowObservable({ a: 1, b: 2 });
      const keys: string[] = [];
      for (const key in shadow) {
        keys.push(key);
      }
      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });
  });

  describe('序列化', () => {
    test('应该处理 JSON.stringify', () => {
      const shadow = shadowObservable({ a: 1, b: 2 });
      const json = JSON.stringify(shadow);
      expect(json).toBe('{"a":1,"b":2}');
    });

    test('应该处理 spread 操作符', () => {
      const shadow = shadowObservable({ a: 1, b: 2 });
      const spread = { ...shadow };
      expect(spread).toEqual({ a: 1, b: 2 });
    });
  });

  describe('特殊对象处理', () => {
    test('应该处理 Object.freeze 后的对象', () => {
      const obj = Object.freeze({ prop: 'value' });
      const shadow = shadowObservable(obj);
      expect(shadow.prop).toBe('value');
    });

    test('应该处理 Object.seal 后的对象', () => {
      const obj = Object.seal({ prop: 'value' });
      const shadow = shadowObservable(obj);
      expect(shadow.prop).toBe('value');
    });
  });

  describe('嵌套对象处理', () => {
    test('应该不包装嵌套对象', () => {
      const nested = { value: 1 };
      const shadow = shadowObservable({ nested });
      expect(isObservable(shadow.nested)).toBe(false);
      expect(shadow.nested).toBe(nested);
    });

    test('应该支持替换嵌套对象', () => {
      const shadow = shadowObservable({ nested: { value: 1 } } as any);
      const reactions: any[] = [];
      const reaction = observe(() => {
        reactions.push(shadow.nested);
      });
      expect(reactions.length).toBe(1);
      shadow.nested = { value: 2 };
      expect(reactions.length).toBe(2);
      unobserve(reaction);
    });
  });

  describe('响应式追踪', () => {
    test('应该处理相同值不触发 reactions', () => {
      const shadow = shadowObservable({ count: 0 });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(shadow.count);
      });
      expect(reactions).toEqual([0]);
      shadow.count = 0; // 相同值
      expect(reactions).toEqual([0]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理新增属性', () => {
      const shadow = shadowObservable({} as any);
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(Object.keys(shadow).length);
      });
      expect(reactions).toEqual([0]);
      shadow.newProp = 'value';
      expect(reactions).toEqual([0, 1]);
      unobserve(reaction);
    });

    test('应该处理删除不存在的属性', () => {
      const shadow = shadowObservable({ prop: 'value' });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(Object.keys(shadow).length);
      });
      expect(reactions).toEqual([1]);
      delete (shadow as any).nonexistent;
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });
  });
});
