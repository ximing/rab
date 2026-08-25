/**
 * 集合处理器 key/value 的 proxyToRaw 解包
 *
 * collectionHandlers / shadowCollectionHandlers 的 set/add/get/has/delete
 * 必须在入口把传入的 observable proxy 解包成 raw 对象：
 * - Map.set(proxyKey, v) 后 m.get(rawKey) / m.has(rawKey) / m.delete(rawKey) 应正常工作
 * - 依赖注册 (wrapKey 按 key 对象身份缓存 WeakRef) 与通知必须落在同一个
 *   (raw) key 上，否则 proxy/raw 混用时永久漏通知
 * - Map.set('k', proxyValue) 内部必须存 raw，而不是 proxy
 */

import { observable, shadowObservable, observe, unobserve, raw } from '../main';

describe('collection key/value proxy unwrapping', () => {
  describe('observable Map', () => {
    test('set 用 proxy key，get/has/delete 用 raw key 正常', () => {
      const keyObj = { id: 1 };
      const proxyKey = observable(keyObj);
      const m = observable(new Map());
      m.set(proxyKey, 1);
      expect(m.get(keyObj)).toBe(1);
      expect(m.has(keyObj)).toBe(true);
      expect(m.delete(keyObj)).toBe(true);
      expect(m.has(keyObj)).toBe(false);
    });

    test('set 用 raw key，get/has/delete 用 proxy key 正常', () => {
      const keyObj = { id: 2 };
      const proxyKey = observable(keyObj);
      const m = observable(new Map());
      m.set(keyObj, 'v');
      expect(m.get(proxyKey)).toBe('v');
      expect(m.has(proxyKey)).toBe(true);
      expect(m.delete(proxyKey)).toBe(true);
      expect(m.size).toBe(0);
    });

    test('依赖对齐：observe get(rawKey) 后用 proxy key set 新值必须触发', () => {
      const keyObj = { id: 3 };
      const proxyKey = observable(keyObj);
      const m = observable(new Map());
      m.set(keyObj, 1);
      const seen: unknown[] = [];
      const reaction = observe(() => {
        seen.push(m.get(keyObj));
      });
      expect(seen).toEqual([1]);
      m.set(proxyKey, 2);
      expect(seen).toEqual([1, 2]);
      unobserve(reaction);
    });

    test('依赖对齐（反向）：observe get(proxyKey) 后用 raw key set 新值必须触发', () => {
      const keyObj = { id: 4 };
      const proxyKey = observable(keyObj);
      const m = observable(new Map());
      m.set(keyObj, 1);
      const seen: unknown[] = [];
      const reaction = observe(() => {
        seen.push(m.get(proxyKey));
      });
      expect(seen).toEqual([1]);
      m.set(keyObj, 2);
      expect(seen).toEqual([1, 2]);
      unobserve(reaction);
    });

    test('value 解包：set 传入 proxy value，内部存 raw，get 返回 observable 包装且相等', () => {
      const valObj = { deep: true };
      const valProxy = observable(valObj);
      const m = observable(new Map());
      m.set('k', valProxy);
      // 内部存储必须是 raw 对象
      expect(raw(m).get('k')).toBe(valObj);
      // 读取返回 observable 包装（缓存的同一 proxy），且值相等
      expect(m.get('k')).toBe(valProxy);
      expect(m.get('k')).toEqual(valObj);
    });
  });

  describe('observable Set', () => {
    test('add 用 proxy，has/delete 用 raw 正常', () => {
      const item = { id: 5 };
      const itemProxy = observable(item);
      const s = observable(new Set());
      s.add(itemProxy);
      expect(s.has(item)).toBe(true);
      expect(s.delete(item)).toBe(true);
      expect(s.has(item)).toBe(false);
    });

    test('依赖对齐：observe has(raw) 后 add(proxy) 必须触发', () => {
      const item = { id: 6 };
      const itemProxy = observable(item);
      const s = observable(new Set());
      const seen: boolean[] = [];
      const reaction = observe(() => {
        seen.push(s.has(item));
      });
      expect(seen).toEqual([false]);
      s.add(itemProxy);
      expect(seen).toEqual([false, true]);
      unobserve(reaction);
    });
  });

  describe('observable WeakMap / WeakSet', () => {
    test('WeakMap set 用 proxy key，get/has/delete 用 raw key 正常', () => {
      const keyObj = { id: 7 };
      const proxyKey = observable(keyObj);
      const wm = observable(new WeakMap());
      wm.set(proxyKey, 42);
      expect(wm.get(keyObj)).toBe(42);
      expect(wm.has(keyObj)).toBe(true);
      expect(wm.delete(keyObj)).toBe(true);
      expect(wm.has(keyObj)).toBe(false);
    });

    test('WeakSet add 用 proxy，has/delete 用 raw 正常', () => {
      const item = { id: 8 };
      const itemProxy = observable(item);
      const ws = observable(new WeakSet());
      ws.add(itemProxy);
      expect(ws.has(item)).toBe(true);
      expect(ws.delete(item)).toBe(true);
      expect(ws.has(item)).toBe(false);
    });
  });

  describe('shadowObservable Map', () => {
    test('set 用 proxy key，get/has/delete 用 raw key 正常', () => {
      const keyObj = { id: 11 };
      const proxyKey = observable(keyObj);
      const m = shadowObservable(new Map());
      m.set(proxyKey, 1);
      expect(m.get(keyObj)).toBe(1);
      expect(m.has(keyObj)).toBe(true);
      expect(m.delete(keyObj)).toBe(true);
      expect(m.size).toBe(0);
    });

    test('依赖对齐：observe get(rawKey) 后用 proxy key set 新值必须触发', () => {
      const keyObj = { id: 12 };
      const proxyKey = observable(keyObj);
      const m = shadowObservable(new Map());
      m.set(keyObj, 1);
      const seen: unknown[] = [];
      const reaction = observe(() => {
        seen.push(m.get(keyObj));
      });
      expect(seen).toEqual([1]);
      m.set(proxyKey, 2);
      expect(seen).toEqual([1, 2]);
      unobserve(reaction);
    });

    test('value 解包：set 传入 proxy value，内部存 raw，浅层 get 直接返回 raw', () => {
      const valObj = { deep: true };
      const valProxy = observable(valObj);
      const m = shadowObservable(new Map());
      m.set('k', valProxy);
      expect(raw(m).get('k')).toBe(valObj);
      // shadow 版不包装返回值
      expect(m.get('k')).toBe(valObj);
    });
  });

  describe('shadowObservable Set', () => {
    test('add 用 proxy，has/delete 用 raw 正常', () => {
      const item = { id: 13 };
      const itemProxy = observable(item);
      const s = shadowObservable(new Set());
      s.add(itemProxy);
      expect(s.has(item)).toBe(true);
      expect(s.delete(item)).toBe(true);
      expect(s.has(item)).toBe(false);
    });

    test('依赖对齐：observe has(raw) 后 add(proxy) 必须触发', () => {
      const item = { id: 14 };
      const itemProxy = observable(item);
      const s = shadowObservable(new Set());
      const seen: boolean[] = [];
      const reaction = observe(() => {
        seen.push(s.has(item));
      });
      expect(seen).toEqual([false]);
      s.add(itemProxy);
      expect(seen).toEqual([false, true]);
      unobserve(reaction);
    });
  });
});
