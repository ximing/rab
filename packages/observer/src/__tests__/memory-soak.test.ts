/**
 * observer 内存浸泡测试
 *
 * 不依赖 GC 时机的确定性断言：reaction 的订阅关系（connectionStore）
 * 在 observe/unobserve、依赖漂移、组件级场景后必须回到基线。
 * 任何一条连接残留都是确定性的泄漏 —— 它让死 reaction 在后续写入时
 * 被唤醒（僵尸回调），并钉住 reaction 闭包里的所有引用。
 */
import { observable, observe, unobserve, raw } from '../main';
import { getConnectionsCount } from '../internals/reaction-track';

describe('内存浸泡：连接归还', () => {
  it('observe/unobserve 循环后连接回到基线', () => {
    const store = observable({ a: 1, b: 2 });
    const target = raw(store);
    const baseline = getConnectionsCount(target);

    for (let i = 0; i < 200; i++) {
      const r = observe(() => {
        void store.a;
        void store.b;
      });
      unobserve(r);
    }

    expect(getConnectionsCount(target)).toBe(baseline);
  });

  it('reaction 依赖漂移（条件分支）反复重跑不积累连接', () => {
    const store = observable({ flag: true, a: 0, b: 0 });
    const target = raw(store);

    let runs = 0;
    const r = observe(() => {
      runs++;
      void (store.flag ? store.a : store.b);
    });
    for (let i = 0; i < 200; i++) {
      store.flag = i % 2 === 0;
      store.a = i;
      store.b = i;
    }
    expect(runs).toBeGreaterThan(100);

    unobserve(r);
    expect(getConnectionsCount(target)).toBe(0);
  });

  it('集合迭代依赖：observe/unobserve 循环后 Map/Set 连接清零', () => {
    const map = observable(new Map<string, number>([['k', 1]]));
    const set = observable(new Set<number>([1]));

    for (let i = 0; i < 100; i++) {
      const r1 = observe(() => {
        void [...map.entries()];
      });
      const r2 = observe(() => {
        void [...set.values()];
      });
      map.set('k', i);
      set.add(i);
      unobserve(r1);
      unobserve(r2);
    }

    expect(getConnectionsCount(raw(map))).toBe(0);
    expect(getConnectionsCount(raw(set))).toBe(0);
  });

  it('lazy reaction 创建后从不执行也不留连接', () => {
    const store = observable({ a: 1 });
    const target = raw(store);
    const baseline = getConnectionsCount(target);

    for (let i = 0; i < 100; i++) {
      // lazy: 创建即返回，不执行不注册
      observe(
        () => {
          void store.a;
        },
        { lazy: true }
      );
    }

    expect(getConnectionsCount(target)).toBe(baseline);
  });
});
