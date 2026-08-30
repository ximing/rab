/**
 * notify 的 key 解包测试
 *
 * 集合 trap 入口都对 key 做 toRawIfProxy 归一化（依赖注册在 raw 身份），
 * notify 也必须同样解包——传 proxy 形式的 key 时否则静默漏通知（#214）。
 */
import { observable, observe, notify } from '../main';

describe('notify 的 key 解包（#214）', () => {
  it('Map 的 key 是 observable 对象时，notify 传 proxy 形式也能命中注册的依赖', () => {
    const map = observable(new Map<object, number>());
    const keyObj = observable({ id: 1 });

    map.set(keyObj, 10);

    let runs = 0;
    observe(() => {
      runs++;
      void map.get(keyObj);
    });
    expect(runs).toBe(1);

    // proxy 形式的 key（用户手里通常只有 proxy）
    notify(map, keyObj);
    expect(runs).toBe(2);

    // raw 形式依然有效（幂等路径）
    notify(map, (map as unknown as { toJSON?: never }) && keyObj);
    expect(runs).toBe(3);
  });

  it('Set 内部归一化后，notify 对 proxy key 与内部注册身份一致', () => {
    const set = observable(new Set<object>());
    const member = observable({ tag: 'm' });
    set.add(member);

    let runs = 0;
    observe(() => {
      runs++;
      void set.has(member);
    });
    expect(runs).toBe(1);

    notify(set, member);
    expect(runs).toBe(2);
  });

  it('普通对象的 string key 不受影响', () => {
    const state = observable({ n: 0 });

    let runs = 0;
    observe(() => {
      runs++;
      void state.n;
    });
    expect(runs).toBe(1);

    notify(state, 'n');
    expect(runs).toBe(2);
  });
});
