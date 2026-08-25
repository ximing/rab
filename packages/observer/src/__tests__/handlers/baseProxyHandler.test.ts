/**
 * baseProxyHandler 测试
 * 测试基础代理处理器的各种操作和边界情况
 */

import { observable } from '../../observable';
import { observe, unobserve, isObservable } from '../../main';

describe('baseProxyHandler', () => {
  describe('基础操作', () => {
    test('应该处理 get 操作', () => {
      const obs = observable({ prop: 'value' });
      expect(obs.prop).toBe('value');
    });

    test('应该处理 set 操作', () => {
      const obs = observable({ count: 0 });
      obs.count = 10;
      expect(obs.count).toBe(10);
    });

    test('应该处理 deleteProperty 操作', () => {
      const obs = observable({ prop: 'value' } as any);
      delete obs.prop;
      expect(obs.prop).toBeUndefined();
    });

    test('应该处理 has 操作', () => {
      const obs = observable({ prop: 'value' });
      expect('prop' in obs).toBe(true);
      expect('nonexistent' in obs).toBe(false);
    });

    test('应该处理 ownKeys 操作', () => {
      const obs = observable({ a: 1, b: 2 });
      const keys = Object.keys(obs);
      expect(keys).toEqual(['a', 'b']);
    });
  });

  describe('Symbol 处理', () => {
    test('应该处理 Symbol 属性', () => {
      const sym = Symbol('test');
      const obj = { [sym]: 'value' };
      const obs = observable(obj);
      expect(obs[sym]).toBe('value');
    });

    test('应该处理 well-known symbols', () => {
      const obj = { [Symbol.toStringTag]: 'CustomObject' };
      const obs = observable(obj);
      expect(obs[Symbol.toStringTag]).toBe('CustomObject');
    });

    test('应该处理 Symbol.iterator', () => {
      const obj = {
        [Symbol.iterator]: function* () {
          yield 1;
        },
      };
      const obs = observable(obj);
      expect(typeof obs[Symbol.iterator]).toBe('function');
    });

    test('应该处理 Symbol.hasInstance', () => {
      const obj = { [Symbol.hasInstance]: () => true };
      const obs = observable(obj);
      expect(typeof obs[Symbol.hasInstance]).toBe('function');
    });
  });

  describe('属性描述符处理', () => {
    test('应该处理 getter/setter', () => {
      const obj: any = {};
      let value = 0;
      Object.defineProperty(obj, 'prop', {
        get() {
          return value;
        },
        set(v) {
          value = v;
        },
      });
      const obs = observable(obj);
      expect(obs.prop).toBe(0);
      obs.prop = 10;
      expect(obs.prop).toBe(10);
    });

    test('应该处理不可配置属性', () => {
      const obj: any = {};
      Object.defineProperty(obj, 'frozen', {
        value: 42,
        writable: false,
        configurable: false,
      });
      const obs = observable(obj);
      expect(obs.frozen).toBe(42);
    });

    test('应该处理 Object.defineProperty', () => {
      const obs = observable({} as any);
      Object.defineProperty(obs, 'prop', {
        value: 42,
        writable: true,
        configurable: true,
      });
      expect(obs.prop).toBe(42);
    });

    test('应该处理 Object.getOwnPropertyDescriptor', () => {
      const obs = observable({ prop: 'value' });
      const descriptor = Object.getOwnPropertyDescriptor(obs, 'prop');
      expect(descriptor?.value).toBe('value');
    });
  });

  describe('原型链处理', () => {
    test('应该处理原型链中的 setter', () => {
      const parent = observable({ count: 0 });
      const child = observable(Object.create(parent));
      child.count = 10;
      expect(child.count).toBe(10);
    });

    test('应该处理 receiver 不是 proxy 的 set 操作', () => {
      const obs = observable({ count: 0 });
      const child = Object.create(obs);
      child.count = 10;
      expect(child.count).toBe(10);
    });

    test('应该处理 receiver 是 null 的情况', () => {
      const obs = observable({ count: 0 });
      const result = Reflect.set(obs, 'count', 10, null as any);
      expect(typeof result).toBe('boolean');
    });

    test('应该处理 receiver 是 undefined 的情况', () => {
      const obs = observable({ count: 0 });
      const result = Reflect.set(obs, 'count', 10, undefined as any);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('construct 操作', () => {
    test('应该处理 construct 操作', () => {
      class MyClass {
        value = 42;
      }
      const ObsClass = observable(MyClass);
      const instance = new ObsClass();
      expect(instance.value).toBe(42);
    });

    test('应该处理 newTarget 是 proxy 的情况', () => {
      class MyClass {
        value = 42;
      }
      const ObsClass = observable(MyClass);
      const instance = new ObsClass();
      expect(instance.value).toBe(42);
      expect(instance instanceof MyClass).toBe(true);
    });

    test('应该处理 receiver 是 proxy 的 set 操作', () => {
      const obs = observable({ count: 0 });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(obs.count);
      });
      expect(reactions).toEqual([0]);
      obs.count = 10;
      expect(reactions).toEqual([0, 10]);
      unobserve(reaction);
    });
  });

  describe('数组操作', () => {
    test('应该处理数组的 length 属性', () => {
      const arr = observable([1, 2, 3]);
      expect(arr.length).toBe(3);
      arr.length = 2;
      expect(arr.length).toBe(2);
    });

    test('应该处理数组的索引访问', () => {
      const arr = observable([1, 2, 3]);
      expect(arr[0]).toBe(1);
      arr[0] = 10;
      expect(arr[0]).toBe(10);
    });

    test('应该处理数组的 push 方法', () => {
      const arr = observable([1, 2]);
      arr.push(3);
      expect(arr.length).toBe(3);
    });

    test('应该处理数组的 pop 方法', () => {
      const arr = observable([1, 2, 3]);
      const val = arr.pop();
      expect(val).toBe(3);
      expect(arr.length).toBe(2);
    });
  });

  describe('Object 方法', () => {
    test('应该处理 Object.assign', () => {
      const obs = observable({ a: 1 } as any);
      Object.assign(obs, { b: 2 });
      expect(obs.a).toBe(1);
      expect(obs.b).toBe(2);
    });

    test('应该处理 Object.entries', () => {
      const obs = observable({ a: 1, b: 2 });
      const entries = Object.entries(obs);
      expect(entries).toEqual([
        ['a', 1],
        ['b', 2],
      ]);
    });

    test('应该处理 Object.values', () => {
      const obs = observable({ a: 1, b: 2 });
      const values = Object.values(obs);
      expect(values).toEqual([1, 2]);
    });

    test('应该处理 Object.getOwnPropertyNames', () => {
      const obs = observable({ a: 1, b: 2 });
      const names = Object.getOwnPropertyNames(obs);
      expect(names).toContain('a');
      expect(names).toContain('b');
    });

    test('应该处理 Object.getOwnPropertySymbols', () => {
      const sym = Symbol('test');
      const obs = observable({ [sym]: 'value' });
      const symbols = Object.getOwnPropertySymbols(obs);
      expect(symbols).toContain(sym);
    });

    test('应该处理 for...in 循环', () => {
      const obs = observable({ a: 1, b: 2 });
      const keys: string[] = [];
      for (const key in obs) {
        keys.push(key);
      }
      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });
  });

  describe('序列化', () => {
    test('应该处理 JSON.stringify', () => {
      const obs = observable({ a: 1, b: 2 });
      const json = JSON.stringify(obs);
      expect(json).toBe('{"a":1,"b":2}');
    });

    test('应该处理 spread 操作符', () => {
      const obs = observable({ a: 1, b: 2 });
      const spread = { ...obs };
      expect(spread).toEqual({ a: 1, b: 2 });
    });
  });

  describe('特殊对象处理', () => {
    test('应该处理 Object.freeze', () => {
      const obj = Object.freeze({ prop: 'value' });
      const obs = observable(obj);
      expect(obs.prop).toBe('value');
    });

    test('应该处理 Object.seal', () => {
      const obj = Object.seal({ prop: 'value' });
      const obs = observable(obj);
      expect(obs.prop).toBe('value');
    });
  });

  describe('响应式追踪', () => {
    test('应该处理相同值不触发 reactions', () => {
      const obs = observable({ count: 0 });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(obs.count);
      });
      expect(reactions).toEqual([0]);
      obs.count = 0; // 相同值
      expect(reactions).toEqual([0]); // 不应该触发
      unobserve(reaction);
    });

    test('应该处理新增属性', () => {
      const obs = observable({} as any);
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(Object.keys(obs).length);
      });
      expect(reactions).toEqual([0]);
      obs.newProp = 'value';
      expect(reactions).toEqual([0, 1]);
      unobserve(reaction);
    });

    test('应该处理删除不存在的属性', () => {
      const obs = observable({ prop: 'value' });
      const reactions: number[] = [];
      const reaction = observe(() => {
        reactions.push(Object.keys(obs).length);
      });
      expect(reactions).toEqual([1]);
      delete (obs as any).nonexistent;
      expect(reactions).toEqual([1]); // 不应该触发
      unobserve(reaction);
    });
  });

  describe('集合操作', () => {
    test('应该处理 Map 的 set 方法', () => {
      const map = observable(new Map());
      map.set('key', 'value');
      expect(map.get('key')).toBe('value');
    });

    test('应该处理 Set 的 add 方法', () => {
      const set = observable(new Set());
      set.add(1);
      expect(set.has(1)).toBe(true);
    });
  });
});
