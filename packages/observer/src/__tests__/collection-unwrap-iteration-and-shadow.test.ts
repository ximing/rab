/**
 * GG5 第 1 轮对抗审查 follow-up：解包修复的补充回归面
 *
 * 原 14 个用例只覆盖 set/add 写入侧与 get/has 注册侧。此处补上审查确认
 * 当前正确、但缺测试即无法防未来回归的三类场景：
 * 1. delete 触发的依赖对齐（以 raw key 注册的 get/has reaction，
 *    用 proxy key 删除必须触发通知）
 * 2. m.size / spread 迭代依赖被混合身份（proxy/raw）的 set/add/delete 触发
 * 3. shadowObservable 版 WeakMap / WeakSet 的解包往返
 * 4. （附带 pin）shadow 集合对 observable value 的浅层语义：
 *    get/迭代返回 raw 而非存入的 proxy —— 这是规格要求的行为（浅层 get
 *    直接返回 raw），pin 住防止后人误"修"。经返回值直接变更不被追踪，
 *    需要响应式嵌套值时应使用 deep 集合。
 */

import { observable, shadowObservable, observe, unobserve, raw } from '../main';

describe('collection unwrap: delete alignment (GG5 review round 2)', () => {
  test('delete(proxyKey) 必须触发以 raw key 注册的 get reaction', () => {
    const keyObj = { id: 201 };
    const proxyKey = observable(keyObj);
    const m = observable(new Map());
    m.set(keyObj, 1);
    const seen: unknown[] = [];
    const reaction = observe(() => {
      seen.push(m.get(keyObj));
    });
    expect(seen).toEqual([1]);
    m.delete(proxyKey);
    expect(seen).toEqual([1, undefined]);
    unobserve(reaction);
  });

  test('delete(proxyKey) 必须触发以 raw key 注册的 has reaction', () => {
    const keyObj = { id: 202 };
    const proxyKey = observable(keyObj);
    const m = observable(new Map());
    m.set(keyObj, 1);
    const seen: boolean[] = [];
    const reaction = observe(() => {
      seen.push(m.has(keyObj));
    });
    expect(seen).toEqual([true]);
    m.delete(proxyKey);
    expect(seen).toEqual([true, false]);
    unobserve(reaction);
  });

  test('Set.delete(proxyItem) 必须触发以 raw item 注册的 has reaction', () => {
    const item = { id: 203 };
    const itemProxy = observable(item);
    const s = observable(new Set());
    s.add(item);
    const seen: boolean[] = [];
    const reaction = observe(() => {
      seen.push(s.has(item));
    });
    expect(seen).toEqual([true]);
    s.delete(itemProxy);
    expect(seen).toEqual([true, false]);
    unobserve(reaction);
  });

  test('shadow Map delete(proxyKey) 必须触发以 raw key 注册的 get reaction', () => {
    const keyObj = { id: 204 };
    const proxyKey = observable(keyObj);
    const m = shadowObservable(new Map());
    m.set(keyObj, 1);
    const seen: unknown[] = [];
    const reaction = observe(() => {
      seen.push(m.get(keyObj));
    });
    expect(seen).toEqual([1]);
    m.delete(proxyKey);
    expect(seen).toEqual([1, undefined]);
    unobserve(reaction);
  });
});

describe('collection unwrap: size / iteration deps under mixed identity', () => {
  test('observe size 后 set(proxyKey, v) 必须触发', () => {
    const keyObj = { id: 211 };
    const proxyKey = observable(keyObj);
    const m = observable(new Map());
    const sizes: number[] = [];
    const reaction = observe(() => {
      sizes.push(m.size);
    });
    expect(sizes).toEqual([0]);
    m.set(proxyKey, 'v');
    expect(sizes).toEqual([0, 1]);
    unobserve(reaction);
  });

  test('observe size 后 delete(proxyKey) 必须触发', () => {
    const keyObj = { id: 212 };
    const proxyKey = observable(keyObj);
    const m = observable(new Map());
    m.set(keyObj, 'v');
    const sizes: number[] = [];
    const reaction = observe(() => {
      sizes.push(m.size);
    });
    expect(sizes).toEqual([1]);
    m.delete(proxyKey);
    expect(sizes).toEqual([1, 0]);
    unobserve(reaction);
  });

  test('observe spread 后 set(proxyKey, v) 必须触发且迭代可见', () => {
    const keyObj = { id: 213 };
    const proxyKey = observable(keyObj);
    const m = observable(new Map());
    const snapshots: unknown[][] = [];
    const reaction = observe(() => {
      snapshots.push([...m.keys()]);
    });
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].length).toBe(0);
    m.set(proxyKey, 'v');
    expect(snapshots.length).toBe(2);
    expect(snapshots[1].length).toBe(1);
    expect(snapshots[1][0]).toBe(keyObj);
    unobserve(reaction);
  });

  test('observe Set size 后 add(proxyItem) / delete(proxyItem) 必须触发', () => {
    const item = { id: 214 };
    const itemProxy = observable(item);
    const s = observable(new Set());
    const sizes: number[] = [];
    const reaction = observe(() => {
      sizes.push(s.size);
    });
    expect(sizes).toEqual([0]);
    s.add(itemProxy);
    expect(sizes).toEqual([0, 1]);
    s.delete(itemProxy);
    expect(sizes).toEqual([0, 1, 0]);
    unobserve(reaction);
  });
});

describe('collection unwrap: shadow WeakMap / WeakSet', () => {
  test('shadow WeakMap set 用 proxy，get/has/delete 用 raw 正常', () => {
    const keyObj = { id: 221 };
    const proxyKey = observable(keyObj);
    const wm = shadowObservable(new WeakMap());
    wm.set(proxyKey, 42);
    expect(wm.get(keyObj)).toBe(42);
    expect(wm.has(keyObj)).toBe(true);
    expect(wm.delete(keyObj)).toBe(true);
    expect(wm.has(keyObj)).toBe(false);
  });

  test('shadow WeakSet add 用 proxy，has/delete 用 raw 正常', () => {
    const item = { id: 222 };
    const itemProxy = observable(item);
    const ws = shadowObservable(new WeakSet());
    ws.add(itemProxy);
    expect(ws.has(item)).toBe(true);
    expect(ws.delete(item)).toBe(true);
    expect(ws.has(item)).toBe(false);
  });
});

describe('shadow collection shallow semantics (pinned, GG5 review item 5)', () => {
  // 规格（原任务书"浅层 get 直接返回 raw"）要求的行为，勿"修"：
  // shadow 集合存取 observable proxy 会解包为 raw，get/迭代返回 raw 而非
  // 存入的 proxy —— 经返回值直接变更不被追踪（无任何通知）。需要响应式
  // 嵌套值时应使用 deep 集合（observable 集合经 observableChild 命中缓存
  // proxy，往返身份保持，见 collection-unwrap-hardening.test.ts）。
  test('shadow Map get 返回 raw（存入 proxy value 的往返）', () => {
    const valObj = { v: 1 };
    const valProxy = observable(valObj);
    const m = shadowObservable(new Map());
    m.set('k', valProxy);
    expect(raw(m).get('k')).toBe(valObj);
    expect(m.get('k')).toBe(valObj); // raw, 不是 valProxy
  });

  test('shadow Set 迭代返回 raw（存入 proxy item 的往返）', () => {
    const item = { id: 231 };
    const itemProxy = observable(item);
    const s = shadowObservable(new Set());
    s.add(itemProxy);
    const items = [...s];
    expect(items.length).toBe(1);
    expect(items[0]).toBe(item); // raw, 不是 itemProxy
    expect(raw(s).has(item)).toBe(true);
  });
});
