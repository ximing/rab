/**
 * handlers 边界情况测试
 * 目标: 覆盖 collectionHandler 和 shadowCollectionHandler 中未覆盖的代码路径
 */

import { observable } from '../../observable';
import { shadowObservable } from '../../shadowObservable';
import { observe } from '../../observer';
import { proxyToRaw } from '../../internals/proxyRawMap';

describe('handlers - 边界情况覆盖', () => {
  describe('collectionHandler - 错误处理', () => {
    test('has 方法在无效 target 时应该返回 false', () => {
      const map = observable(new Map());
      const proxy = map as any;

      // 清除 proxyToRaw 映射来模拟无效 target
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 has 应该返回 false
      const result = proxy.has('key');
      expect(result).toBe(false);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('get 方法在无效 target 时应该返回 undefined', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 get 应该返回 undefined
      const result = proxy.get('key');
      expect(result).toBeUndefined();

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('add 方法在无效 target 时应该返回 this', () => {
      const set = observable(new Set());
      const proxy = set as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 add 应该返回 this
      const result = proxy.add('value');
      expect(result).toBe(proxy);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('set 方法在无效 target 时应该返回 this', () => {
      const map = observable(new Map());
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 set 应该返回 this
      const result = proxy.set('key', 'value');
      expect(result).toBe(proxy);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('delete 方法在无效 target 时应该返回 false', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 delete 应该返回 false
      const result = proxy.delete('key');
      expect(result).toBe(false);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('clear 方法在无效 target 时应该直接返回', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 clear 不应该抛出错误
      expect(() => proxy.clear()).not.toThrow();

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('forEach 方法在无效 target 时应该直接返回', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      let callCount = 0;
      // 调用 forEach 不应该抛出错误
      expect(() => {
        proxy.forEach(() => {
          callCount++;
        });
      }).not.toThrow();

      expect(callCount).toBe(0);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('keys 方法在无效 target 时应该返回空迭代器', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 keys 应该返回空迭代器
      const keys = Array.from(proxy.keys());
      expect(keys).toEqual([]);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('values 方法在无效 target 时应该返回空迭代器', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 values 应该返回空迭代器
      const values = Array.from(proxy.values());
      expect(values).toEqual([]);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('entries 方法在无效 target 时应该返回空迭代器', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 entries 应该返回空迭代器
      const entries = Array.from(proxy.entries());
      expect(entries).toEqual([]);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('Symbol.iterator 在无效 target 时应该返回空迭代器', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 Symbol.iterator 应该返回空迭代器
      const items = [...proxy];
      expect(items).toEqual([]);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('size getter 在无效 target 时应该返回 0', () => {
      const map = observable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 访问 size 应该返回 0
      expect(proxy.size).toBe(0);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });
  });

  describe('shadowCollectionHandler - 错误处理', () => {
    test('has 方法在无效 target 时应该返回 false', () => {
      const map = shadowObservable(new Map());
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 has 应该返回 false
      const result = proxy.has('key');
      expect(result).toBe(false);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('get 方法在无效 target 时应该返回 undefined', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 get 应该返回 undefined
      const result = proxy.get('key');
      expect(result).toBeUndefined();

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('add 方法在无效 target 时应该返回 this', () => {
      const set = shadowObservable(new Set());
      const proxy = set as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 add 应该返回 this
      const result = proxy.add('value');
      expect(result).toBe(proxy);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('set 方法在无效 target 时应该返回 this', () => {
      const map = shadowObservable(new Map());
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 set 应该返回 this
      const result = proxy.set('key', 'value');
      expect(result).toBe(proxy);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('delete 方法在无效 target 时应该返回 false', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 delete 应该返回 false
      const result = proxy.delete('key');
      expect(result).toBe(false);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('clear 方法在无效 target 时应该直接返回', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 clear 不应该抛出错误
      expect(() => proxy.clear()).not.toThrow();

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('forEach 方法在无效 target 时应该直接返回', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      let callCount = 0;
      // 调用 forEach 不应该抛出错误
      expect(() => {
        proxy.forEach(() => {
          callCount++;
        });
      }).not.toThrow();

      expect(callCount).toBe(0);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('keys 方法在无效 target 时应该返回空迭代器', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 keys 应该返回空迭代器
      const keys = Array.from(proxy.keys());
      expect(keys).toEqual([]);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('values 方法在无效 target 时应该返回空迭代器', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 values 应该返回空迭代器
      const values = Array.from(proxy.values());
      expect(values).toEqual([]);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('entries 方法在无效 target 时应该返回空迭代器', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 entries 应该返回空迭代器
      const entries = Array.from(proxy.entries());
      expect(entries).toEqual([]);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('Symbol.iterator 在无效 target 时应该返回空迭代器', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 调用 Symbol.iterator 应该返回空迭代器
      const items = [...proxy];
      expect(items).toEqual([]);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });

    test('size getter 在无效 target 时应该返回 0', () => {
      const map = shadowObservable(new Map([['key', 'value']]));
      const proxy = map as any;

      // 清除 proxyToRaw 映射
      const originalTarget = proxyToRaw.get(proxy);
      proxyToRaw.delete(proxy);

      // 访问 size 应该返回 0
      expect(proxy.size).toBe(0);

      // 恢复映射
      if (originalTarget) {
        proxyToRaw.set(proxy, originalTarget);
      }
    });
  });

  describe('WeakMap 和 WeakSet 的特殊情况', () => {
    test('WeakMap 的 get 方法应该正常工作', () => {
      const key = {};
      const weakMap = observable(new WeakMap([[key, { value: 1 }]]));

      let callCount = 0;
      observe(() => {
        weakMap.get(key);
        callCount++;
      });

      expect(callCount).toBe(1);
    });

    test('WeakMap 的 set 方法应该触发 reactions', () => {
      const key1 = {};
      const key2 = {};
      const weakMap = observable(new WeakMap([[key1, { value: 1 }]]));

      let callCount = 0;
      observe(() => {
        weakMap.has(key1);
        callCount++;
      });

      expect(callCount).toBe(1);

      // 添加新键不会触发 has 的 reaction
      weakMap.set(key2, { value: 2 });
      expect(callCount).toBe(1);
    });

    test('WeakSet 的 add 方法应该正常工作', () => {
      const obj1 = {};
      const obj2 = {};
      const weakSet = observable(new WeakSet([obj1]));

      let callCount = 0;
      observe(() => {
        weakSet.has(obj1);
        callCount++;
      });

      expect(callCount).toBe(1);

      // 添加新对象不会触发 has 的 reaction
      weakSet.add(obj2);
      expect(callCount).toBe(1);
    });

    test('WeakMap 的 delete 方法应该正常工作', () => {
      const key = {};
      const weakMap = observable(new WeakMap([[key, { value: 1 }]]));

      expect(weakMap.has(key)).toBe(true);
      expect(weakMap.delete(key)).toBe(true);
      expect(weakMap.has(key)).toBe(false);
    });

    test('WeakSet 的 delete 方法应该正常工作', () => {
      const obj = {};
      const weakSet = observable(new WeakSet([obj]));

      expect(weakSet.has(obj)).toBe(true);
      expect(weakSet.delete(obj)).toBe(true);
      expect(weakSet.has(obj)).toBe(false);
    });
  });

  describe('迭代器的 done 状态', () => {
    test('values 迭代器应该正确处理 done 状态', () => {
      const map = observable(new Map([['key', { nested: 1 }]]));
      const iterator = map.values();

      const result1 = iterator.next();
      expect(result1.done).toBe(false);
      expect(result1.value).toBeDefined();

      const result2 = iterator.next();
      expect(result2.done).toBe(true);
    });

    test('entries 迭代器应该正确处理 done 状态', () => {
      const map = observable(new Map([['key', { nested: 1 }]]));
      const iterator = map.entries();

      const result1 = iterator.next();
      expect(result1.done).toBe(false);
      expect(result1.value).toBeDefined();
      expect(Array.isArray(result1.value)).toBe(true);

      const result2 = iterator.next();
      expect(result2.done).toBe(true);
    });

    test('Symbol.iterator 应该正确处理 done 状态', () => {
      const set = observable(new Set([1, 2]));
      const iterator = set[Symbol.iterator]();

      const result1 = iterator.next();
      expect(result1.done).toBe(false);

      const result2 = iterator.next();
      expect(result2.done).toBe(false);

      const result3 = iterator.next();
      expect(result3.done).toBe(true);
    });
  });
});
