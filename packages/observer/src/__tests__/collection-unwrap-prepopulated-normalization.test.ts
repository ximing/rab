/**
 * G5 第 3 轮对抗审查 issue #1：构造期/绕过 trap 写入的 proxy key 条目
 *
 * 场景：在集合被 observable 包装**之前**，key/value 已是 observable proxy
 * （典型: observable(new Map([[box, 42]]))，box 本身是 observable proxy）。
 * 修复后所有 trap 入口统一解包成 raw 查找 —— 若 raw target 内部仍持有
 * proxy 条目，get/has/delete 全部静默失灵，且与 trap 写入混合会产生
 * 同一逻辑 key 的两个不可达重复条目（/tmp/g5-prepop.ts、
 * /tmp/g5-double-entry.ts 实跑复现过）。
 *
 * 修复方向（审查建议 1）：Map/Set 在被包装为 observable 时（deep 与 shadow
 * 两个创建路径）遍历现有条目，把 key/value 中的 observable proxy 归一化为
 * raw，确立不变量『集合内部只持有 raw 身份』。
 *
 * WeakMap/WeakSet 不可枚举，无法在包装时归一化 —— 构造期存入的 proxy key
 * 依旧不可达（Vue 3 的集合 instrumentation 存在同样的固有权衡），文末用
 * pin 测试明确该边界，防止后续误判为回归。
 */

import { observable, shadowObservable, observe, unobserve, raw } from '../main';

describe('collection wrap-time normalization (G5 review round 3, issue 1)', () => {
  test('Map 构造期存入 proxy key/value：包装时归一化为 raw，任一身份都可达', () => {
    const keyObj = { id: 1 };
    const valObj = { v: 1 };
    const box = observable({ keyObj, valObj });
    const proxyKey = box.keyObj;
    const proxyVal = box.valObj;

    const m = observable(new Map<unknown, unknown>([[proxyKey, proxyVal]]));

    // 内部存储必须是 raw（不变量）
    expect(raw(m).get(keyObj)).toBe(valObj);
    // proxy 身份经 trap 解包后命中 raw 条目
    expect(m.has(proxyKey)).toBe(true);
    expect(m.get(proxyKey)).toBe(proxyVal); // deep get 经 observableChild 命中缓存 proxy
    // raw 身份直接命中
    expect(m.has(keyObj)).toBe(true);
    expect(m.get(keyObj)).toBe(proxyVal);
    expect(m.size).toBe(1);
    // 删除用任一身份都生效
    expect(m.delete(proxyKey)).toBe(true);
    expect(m.size).toBe(0);
  });

  test('Map 构造期条目归一化后，混合写入不产生双条目', () => {
    const keyObj = { id: 2 };
    const box = observable({ keyObj });
    const proxyKey = box.keyObj;

    const m = observable(new Map<unknown, unknown>([[proxyKey, 42]]));
    // 修复前: 内部是 [proxy]→42；再 set(proxy, 99) 会解包成 raw，出现 size=2
    // 的重复条目，且残留的 proxy 条目经 trap 的 get/has/delete 永远不可达。
    m.set(proxyKey, 99);

    expect(m.size).toBe(1);
    expect(m.get(keyObj)).toBe(99);
    expect(m.delete(proxyKey)).toBe(true);
    expect(m.size).toBe(0);
  });

  test('Map 构造期条目归一化后，依赖通知身份对齐', () => {
    const keyObj = { id: 3 };
    const box = observable({ keyObj });
    const proxyKey = box.keyObj;

    const m = observable(new Map<unknown, unknown>([[proxyKey, 1]]));
    const seen: unknown[] = [];
    const reaction = observe(() => {
      seen.push(m.get(keyObj));
    });
    expect(seen).toEqual([1]);

    // 用 proxy 身份 set，必须通知以 raw 身份注册的依赖
    m.set(proxyKey, 2);
    expect(seen).toEqual([1, 2]);

    unobserve(reaction);
  });

  test('Set 构造期存入 proxy：包装时归一化，has(raw)/delete 双身份可达', () => {
    const valObj = { id: 4 };
    const box = observable({ valObj });
    const proxyVal = box.valObj;

    const s = observable(new Set<unknown>([proxyVal]));

    expect(raw(s).has(valObj)).toBe(true);
    expect(s.has(proxyVal)).toBe(true);
    expect(s.has(valObj)).toBe(true);
    expect(s.size).toBe(1);
    expect(s.delete(proxyVal)).toBe(true);
    expect(s.size).toBe(0);
  });

  test('Map 构造期 value 归一化：内部存 raw，get 返回缓存的 observable 包装', () => {
    const valObjA = { v: 'a' };
    const valObjB = { v: 'b' };
    const box = observable({ valObjA, valObjB });

    const m = observable(
      new Map<string, unknown>([
        ['a', box.valObjA],
        ['b', box.valObjB],
      ])
    );

    expect(raw(m).get('a')).toBe(valObjA);
    expect(raw(m).get('b')).toBe(valObjB);
    // deep 集合 get 返回 observableChild 缓存的同一 proxy，往返身份保持
    expect(m.get('a')).toBe(box.valObjA);
    expect(m.get('b')).toBe(box.valObjB);
  });

  test('shadowObservable 的 Map/Set 构造期条目同样归一化', () => {
    const keyObj = { id: 5 };
    const valObj = { v: 5 };
    const box = observable({ keyObj, valObj });
    const proxyKey = box.keyObj;
    const proxyVal = box.valObj;

    const sm = shadowObservable(new Map<unknown, unknown>([[proxyKey, proxyVal]]));

    expect(raw(sm).get(keyObj)).toBe(valObj);
    expect(sm.has(proxyKey)).toBe(true);
    // shadow get 返回 raw（浅层语义）
    expect(sm.get(proxyKey)).toBe(valObj);
    expect(sm.get(keyObj)).toBe(valObj);
    expect(sm.size).toBe(1);
    expect(sm.delete(keyObj)).toBe(true);
    expect(sm.size).toBe(0);

    const ss = shadowObservable(new Set<unknown>([box.valObj]));
    expect(raw(ss).has(valObj)).toBe(true);
    expect(ss.has(box.valObj)).toBe(true);
    expect(ss.delete(box.valObj)).toBe(true);
    expect(ss.size).toBe(0);
  });

  test('嵌套路径延迟包装的集合同样归一化（observableChild 懒包装）', () => {
    const keyObj = { id: 6 };
    const box = observable({ keyObj, inner: null as unknown });
    const proxyKey = box.keyObj;
    // 先在 raw Map 里塞 proxy key，再整体赋给 observable 属性
    const rawMap = new Map<unknown, unknown>([[proxyKey, 7]]);
    box.inner = rawMap;
    const m = box.inner as Map<unknown, unknown>;

    expect(m.has(proxyKey)).toBe(true);
    expect(m.has(keyObj)).toBe(true);
    expect(m.get(keyObj)).toBe(7);
    expect(m.size).toBe(1);
  });

  // ------------------------------------------------------------------
  // WeakMap/WeakSet 边界 pin（不可枚举 → 无法在包装时归一化）
  // ------------------------------------------------------------------
  test('pin: WeakMap 构造期存入的 proxy key 不可达（不可枚举，固有权衡）', () => {
    const keyObj = { id: 7 };
    const box = observable({ keyObj });
    const proxyKey = box.keyObj;

    const wm = observable(new WeakMap<object, unknown>([[proxyKey, 42]]));
    const ws = observable(new WeakSet<object>([proxyKey]));

    // WeakMap/WeakSet 没有枚举能力，包装时无法遍历归一化已有条目；
    // trap 入口统一按 raw 查找，因此构造期写入的 proxy 条目不可达。
    // 这与 Vue 3 集合 instrumentation 的 toRaw(key) 边缘一致，是
    // 『集合内部只认 raw 身份』不变量下可枚举集合已修复、weak 集合
    // 固有的残余边界 —— pin 住防止后续误判为新回归。
    expect(wm.get(proxyKey)).toBeUndefined();
    expect(wm.has(proxyKey)).toBe(false);
    expect(ws.has(proxyKey)).toBe(false);
    // 经 trap 的写入（正常路径）不受影响
    wm.set(keyObj, 1);
    expect(wm.get(proxyKey)).toBe(1);
    ws.add(keyObj);
    expect(ws.has(proxyKey)).toBe(true);
  });
});
