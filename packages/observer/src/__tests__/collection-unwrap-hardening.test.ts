/**
 * GG5 加固测试（对抗审查补充）
 *
 * 覆盖 collectionHandlers/shadowCollectionHandlers key/value 解包修复中
 * 未被原测试直接覆盖的回归面：
 * - delete 路径的依赖对齐（proxy 注册 / raw 删除）
 * - Object.is 去重：同一 raw 经 proxy 重复写入不得产生冗余通知
 * - reaction 内部对同一 Map 再 set 的同步重入级联必须有界
 * - deep Set add(proxy) 后迭代身份保持（缓存的同一 proxy）
 */

import { observable, observe, unobserve, raw } from '../main';

describe('collection unwrap hardening (GG5 review)', () => {
  test('delete 依赖对齐：get(proxyKey) 注册，raw key 删除必须触发', () => {
    const keyObj = { id: 101 };
    const proxyKey = observable(keyObj);
    const m = observable(new Map());
    m.set(keyObj, 1);
    const seen: unknown[] = [];
    const reaction = observe(() => {
      seen.push(m.get(proxyKey));
    });
    expect(seen).toEqual([1]);
    m.delete(keyObj);
    expect(seen).toEqual([1, undefined]);
    unobserve(reaction);
  });

  test('Object.is 去重：经 proxy key/value 重复写入同一 raw 不得通知', () => {
    const keyObj = { id: 102 };
    const proxyKey = observable(keyObj);
    const valObj = { v: 1 };
    const valProxy = observable(valObj);
    const m = observable(new Map());
    m.set(keyObj, valObj);
    let runs = 0;
    const reaction = observe(() => {
      m.get(keyObj);
      runs++;
    });
    const before = runs;
    m.set(proxyKey, valProxy); // 解包后与已存值同一身份
    expect(runs).toBe(before);
    unobserve(reaction);
  });

  test('reaction 内对同一 Map 同步重入 set 级联必须有界', () => {
    const m = observable(new Map());
    let cascades = 0;
    const reaction = observe(() => {
      const v = m.get('k');
      if (v !== undefined && cascades < 3) {
        cascades++;
        m.set('k', (v as number) + 1);
      }
    });
    m.set('k', 1);
    expect(m.get('k')).toBe(2);
    expect(cascades).toBe(1);
    unobserve(reaction);
  });

  test('deep Set add(proxy) 后迭代返回缓存的同一 proxy（身份保持）', () => {
    const item = { id: 103 };
    const itemProxy = observable(item);
    const s = observable(new Set());
    s.add(itemProxy);
    expect([...s][0]).toBe(itemProxy);
    expect(raw(s).has(item)).toBe(true);
  });

  test('deep Map set(proxyKey, proxyValue) 内部落盘均为 raw', () => {
    const keyObj = { id: 104 };
    const valObj = { id: 105 };
    const m = observable(new Map());
    m.set(observable(keyObj), observable(valObj));
    const rawMap = raw(m);
    expect(rawMap.has(keyObj)).toBe(true);
    expect(rawMap.get(keyObj)).toBe(valObj);
  });
});
