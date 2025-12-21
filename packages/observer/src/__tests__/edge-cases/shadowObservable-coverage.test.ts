/**
 * shadowObservable 边界情况测试
 * 目标: 覆盖 shadowObservable.ts 中未覆盖的代码路径
 */

import { shadowObservable } from '../../shadowObservable';
import { observe } from '../../observer';
import { proxyToRaw, rawToProxy } from '../../internals/proxyRawMap';

describe('shadowObservable - 边界情况覆盖', () => {
  describe('已存在的 observable', () => {
    test('应该返回已存在的 observable 而不是创建新的', () => {
      const obj = { count: 0 };
      const observable1 = shadowObservable(obj);
      const observable2 = shadowObservable(obj);

      // 应该返回同一个 observable
      expect(observable1).toBe(observable2);
    });

    test('传入已经是 observable 的对象应该直接返回', () => {
      const obj = { count: 0 };
      const observable1 = shadowObservable(obj);
      const observable2 = shadowObservable(observable1);

      // 应该返回同一个对象
      expect(observable1).toBe(observable2);
    });

    test('应该正确处理缓存的 observable', () => {
      const obj = { value: 1 };
      const observable1 = shadowObservable(obj);

      // 验证缓存已建立
      expect(rawToProxy.get(obj)).toBe(observable1);
      expect(proxyToRaw.get(observable1)).toBe(obj);

      // 再次调用应该返回缓存的 observable
      const observable2 = shadowObservable(obj);
      expect(observable2).toBe(observable1);
    });
  });

  describe('不应该被包装的对象', () => {
    test('Date 对象不应该被包装', () => {
      const date = new Date();
      const result = shadowObservable(date as any);

      // Date 对象不应该被包装，应该返回原对象
      expect(result).toBe(date);
    });

    test('RegExp 对象不应该被包装', () => {
      const regex = /test/;
      const result = shadowObservable(regex as any);

      // RegExp 对象不应该被包装
      expect(result).toBe(regex);
    });

    test('Promise 对象不应该被包装', () => {
      const promise = Promise.resolve(1);
      const result = shadowObservable(promise as any);

      // Promise 对象不应该被包装
      expect(result).toBe(promise);
    });

    test('Error 对象不应该被包装', () => {
      const error = new Error('test');
      const result = shadowObservable(error as any);

      // Error 对象不应该被包装
      expect(result).toBe(error);
    });
  });

  describe('集合类型的浅层响应式', () => {
    test('Map 应该使用 shadowCollectionHandlers', () => {
      const map = shadowObservable(new Map([['key', { nested: 1 }]]));
      let callCount = 0;

      observe(() => {
        map.size;
        callCount++;
      });

      expect(callCount).toBe(1);

      // 修改 Map 应该触发 reaction
      map.set('key2', { nested: 2 });
      expect(callCount).toBe(2);

      // 获取的值不应该是 observable
      const value = map.get('key');
      expect(proxyToRaw.has(value as any)).toBe(false);
    });

    test('Set 应该使用 shadowCollectionHandlers', () => {
      const set = shadowObservable(new Set([{ id: 1 }]));
      let callCount = 0;

      observe(() => {
        set.size;
        callCount++;
      });

      expect(callCount).toBe(1);

      // 修改 Set 应该触发 reaction
      set.add({ id: 2 });
      expect(callCount).toBe(2);
    });

    test('WeakMap 应该使用 shadowCollectionHandlers', () => {
      const key1 = {};
      const key2 = {};
      const weakMap = shadowObservable(new WeakMap([[key1, { value: 1 }]]));

      let callCount = 0;
      observe(() => {
        weakMap.has(key1);
        callCount++;
      });

      expect(callCount).toBe(1);

      // 修改 WeakMap 应该触发 reaction
      weakMap.set(key2, { value: 2 });
      // WeakMap 的 set 操作不会触发 has 的 reaction
      expect(callCount).toBe(1);

      // 获取的值不应该是 observable
      const value = weakMap.get(key1);
      expect(proxyToRaw.has(value as any)).toBe(false);
    });

    test('WeakSet 应该使用 shadowCollectionHandlers', () => {
      const obj1 = {};
      const obj2 = {};
      const weakSet = shadowObservable(new WeakSet([obj1]));

      let callCount = 0;
      observe(() => {
        weakSet.has(obj1);
        callCount++;
      });

      expect(callCount).toBe(1);

      // 修改 WeakSet
      weakSet.add(obj2);
      // WeakSet 的 add 操作不会触发 has 的 reaction
      expect(callCount).toBe(1);
    });
  });

  describe('集合类型的特殊方法', () => {
    test('Map 的 forEach 应该返回原始值', () => {
      const map = shadowObservable(new Map([['key', { nested: 1 }]]));
      const values: any[] = [];

      map.forEach(value => {
        values.push(value);
      });

      // 值不应该是 observable
      expect(proxyToRaw.has(values[0])).toBe(false);
    });

    test('Map 的 values 迭代器应该返回原始值', () => {
      const map = shadowObservable(new Map([['key', { nested: 1 }]]));
      const values = Array.from(map.values());

      // 值不应该是 observable
      expect(proxyToRaw.has(values[0])).toBe(false);
    });

    test('Map 的 entries 迭代器应该返回原始值', () => {
      const map = shadowObservable(new Map([['key', { nested: 1 }]]));
      const entries = Array.from(map.entries());

      // 值不应该是 observable
      expect(proxyToRaw.has(entries[0][1])).toBe(false);
    });

    test('Map 的 Symbol.iterator 应该返回原始值', () => {
      const map = shadowObservable(new Map([['key', { nested: 1 }]]));
      const entries = [...map];

      // 值不应该是 observable
      expect(proxyToRaw.has(entries[0][1])).toBe(false);
    });

    test('Set 的 values 迭代器应该返回原始值', () => {
      const obj = { id: 1 };
      const set = shadowObservable(new Set([obj]));
      const values = Array.from(set.values());

      // 值不应该是 observable
      expect(values[0]).toBe(obj);
      expect(proxyToRaw.has(values[0])).toBe(false);
    });

    test('Set 的 entries 迭代器应该返回原始值', () => {
      const obj = { id: 1 };
      const set = shadowObservable(new Set([obj]));
      const entries = Array.from(set.entries());

      // 值不应该是 observable
      expect(entries[0][0]).toBe(obj);
      expect(entries[0][1]).toBe(obj);
    });
  });

  describe('普通对象的浅层响应式', () => {
    test('应该使用 shadowProxyHandler', () => {
      const obj = shadowObservable({ user: { name: 'John' }, count: 0 });
      let callCount = 0;

      observe(() => {
        obj.count;
        callCount++;
      });

      expect(callCount).toBe(1);

      // 修改根级别属性应该触发 reaction
      obj.count++;
      expect(callCount).toBe(2);

      // 嵌套对象不应该是 observable
      expect(proxyToRaw.has(obj.user)).toBe(false);
    });

    test('修改嵌套对象的属性不应该触发 reaction', () => {
      const obj = shadowObservable({ user: { name: 'John' } });
      let callCount = 0;

      observe(() => {
        obj.user.name;
        callCount++;
      });

      expect(callCount).toBe(1);

      // 修改嵌套对象的属性不应该触发 reaction
      obj.user.name = 'Jane';
      expect(callCount).toBe(1);
    });

    test('替换整个嵌套对象应该触发 reaction', () => {
      const obj = shadowObservable({ user: { name: 'John' } });
      let callCount = 0;

      observe(() => {
        obj.user;
        callCount++;
      });

      expect(callCount).toBe(1);

      // 替换整个对象应该触发 reaction
      obj.user = { name: 'Jane' };
      expect(callCount).toBe(2);
    });
  });

  describe('边界情况', () => {
    test('空对象应该正常工作', () => {
      const obj = shadowObservable({});
      let callCount = 0;

      observe(() => {
        Object.keys(obj).length;
        callCount++;
      });

      expect(callCount).toBe(1);
    });

    test('空 Map 应该正常工作', () => {
      const map = shadowObservable(new Map());
      let callCount = 0;

      observe(() => {
        map.size;
        callCount++;
      });

      expect(callCount).toBe(1);

      map.set('key', 'value');
      expect(callCount).toBe(2);
    });

    test('空 Set 应该正常工作', () => {
      const set = shadowObservable(new Set());
      let callCount = 0;

      observe(() => {
        set.size;
        callCount++;
      });

      expect(callCount).toBe(1);

      set.add('value');
      expect(callCount).toBe(2);
    });

    test('应该正确处理 null 原型对象', () => {
      const obj = Object.create(null);
      obj.value = 1;
      const observable = shadowObservable(obj);

      let callCount = 0;
      observe(() => {
        observable.value;
        callCount++;
      });

      expect(callCount).toBe(1);

      observable.value = 2;
      expect(callCount).toBe(2);
    });
  });

  describe('createShadowCollectionProxyHandlers 的 get 方法', () => {
    test('访问不存在的方法应该返回 undefined', () => {
      const map = shadowObservable(new Map());

      // 访问一个不存在的方法
      const result = (map as any).nonExistentMethod;
      expect(result).toBeUndefined();
    });

    test('访问 Map 的原生方法应该通过 shadowCollectionHandlers', () => {
      const map = shadowObservable(new Map([['key', 'value']]));

      // 这些方法应该正常工作
      expect(map.has('key')).toBe(true);
      expect(map.get('key')).toBe('value');
      expect(map.size).toBe(1);
    });

    test('访问 Set 的原生方法应该通过 shadowCollectionHandlers', () => {
      const set = shadowObservable(new Set(['value']));

      // 这些方法应该正常工作
      expect(set.has('value')).toBe(true);
      expect(set.size).toBe(1);
    });
  });
});
