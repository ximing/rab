/*
 * 回归测试: 集合依赖的对象 key 不得被强持有
 *
 * 背景 bug: connectionStore 的 ConnectionMap 是普通 Map,
 * Map/Set/WeakMap/WeakSet 的 has/get/delete 注册依赖时把用户传入的
 * key 对象原样作为 Map key 存入 —— 只要 observable proxy 还活着,
 * key 就永远无法被 GC。对 WeakMap 使用者是语义破坏 + 内存泄漏
 * (RN 长列表 + WeakMap 缓存场景持续涨内存)。
 *
 * 注意: 需要 NODE_OPTIONS=--expose-gc 运行, 否则跳过。
 */
import { observable, observe } from '../main';

const gc = (globalThis as unknown as { gc?: () => void }).gc;
const maybeTest = typeof WeakRef === 'function' && gc ? test : test.skip;

// V8 语义: WeakRef.deref() 的返回值在当前 Job 结束前被强保持 (KeepDuringJob),
// 因此 gc 前必须先断开 microtask, 否则 gc 收不掉刚被 deref 过的对象
const tick = () => new Promise(r => setTimeout(r, 0));
async function settleAndGC() {
  await tick();
  gc!();
  gc!();
  await tick();
  gc!();
}

describe('集合依赖的对象 key 不被强持有', () => {
  maybeTest('WeakMap.has 注册依赖后 key 应可被 GC', async () => {
    const weak = observable(new WeakMap<object, number>());
    // holder 持有 key, reaction 闭包只引用 holder —— 避免
    // 测试自身通过闭包强持有 key 造成假阴性
    const holder: { key: object | null } = { key: { id: 1 } };
    const ref = new WeakRef(holder.key as object);

    observe(() => {
      (weak as unknown as { has: (k: object) => boolean }).has(holder.key!);
    });
    expect(ref.deref()).toBeDefined();

    holder.key = null;
    await settleAndGC();

    // 修复前: connectionStore 的 Map 强持有 key, deref() 仍返回对象
    expect(ref.deref()).toBeUndefined();
  });

  maybeTest('Map.get 注册依赖后 key 应可被 GC (依赖仍正常触发)', async () => {
    const map = observable(new Map<object, number>());
    const holder: { key: object | null } = { key: { id: 2 } };
    const ref = new WeakRef(holder.key as object);
    const seen: number[] = [];

    const key2 = { id: 3 };
    observe(() => {
      // 对将被丢弃的 key 注册依赖 (这正是泄漏路径)
      (map as unknown as { get: (k: object) => number }).get(holder.key as object);
      // 同时观察一个存活的 key, 用它验证反应正常触发
      seen.push((map as unknown as { get: (k: object) => number }).get(key2) ?? -1);
    });

    (map as unknown as { set: (k: object, v: number) => void }).set(key2, 30);
    expect(seen[seen.length - 1]).toBe(30);

    holder.key = null;
    await settleAndGC();
    expect(ref.deref()).toBeUndefined();

    // 存活 key 的响应式不受影响
    (map as unknown as { set: (k: object, v: number) => void }).set(key2, 31);
    expect(seen[seen.length - 1]).toBe(31);
  });
});
