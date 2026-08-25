/*
 * 回归测试 (终审遗留 A3 / NEW-F): observe() 非 lazy 首跑抛错不得留下
 * "僵尸 reaction"。
 *
 * 背景: observe(fn) 首次执行在 observe 内部直接 reaction(), fn 抛错时
 * 异常穿透到 observe() 调用者 —— 这部分是合理的 (fail-fast)。但半成品
 * reaction 连同它已注册的部分依赖留在 connectionStore 里且处于脱管状态:
 * 用户拿到异常自然认为 observe 已失败, 但后续每次写入都会重跑这个
 * "已死"的 reaction (实测复活并读到新值), 且无人会再 unobserve 它。
 *
 * 修复语义: 首跑抛错 → 自动 unobserve (释放全部依赖连接) → rethrow。
 * 调用者拿到异常, reaction 干净地不存在。
 * */
import { observable, observe, unobserve } from '../main';

describe('observe() 首跑抛错', () => {
  test('异常穿透到调用者, 且 reaction 不复活 (后续写入不再重跑)', () => {
    const state = observable({ x: 1 });
    const later: unknown[] = [];
    expect(() =>
      observe(() => {
        void state.x;
        if (state.x === 1) {
          throw new Error('init boom');
        }
        later.push(state.x);
      })
    ).toThrow('init boom');

    state.x = 2;
    state.x = 3;
    expect(later).toEqual([]); // 修复前: [2, 3] —— 僵尸 reaction 复活
  });

  test('首跑抛错后, 同一 observable 的其他 reaction 不受影响', () => {
    const state = observable({ x: 1 });
    let healthyRuns = 0;
    observe(() => {
      void state.x;
      healthyRuns++;
    });
    expect(() =>
      observe(() => {
        void state.x;
        throw new Error('boom');
      })
    ).toThrow('boom');

    state.x = 2;
    expect(healthyRuns).toBe(2);
  });

  test('抛错前已注册的部分依赖被释放 (首读两个属性, 第二个抛错)', () => {
    const state = observable({ a: 1, b: 2 });
    const later: unknown[] = [];
    expect(() =>
      observe(() => {
        void state.a; // 依赖 a 已注册
        void state.b;
        throw new Error('boom');
      })
    ).toThrow('boom');

    state.a = 10; // 不得触发僵尸
    state.b = 20;
    expect(later).toEqual([]);
  });

  test('lazy observe 不首跑, 不受影响; 手动首跑抛错同样脱管', () => {
    const state = observable({ x: 1 });
    const later: unknown[] = [];
    const r = observe(
      () => {
        void state.x;
        if (state.x === 1) throw new Error('manual boom');
        later.push(state.x);
      },
      { lazy: true }
    );
    expect(() => r()).toThrow('manual boom');
    // 手动执行抛错后, 该 reaction 也应脱管 (与 observe 首跑同语义)
    state.x = 2;
    expect(later).toEqual([]);
    expect(() => unobserve(r)).not.toThrow();
  });

  test('首跑成功的 reaction 语义不变 (正常触发)', () => {
    const state = observable({ x: 1 });
    const seen: number[] = [];
    observe(() => seen.push(state.x));
    state.x = 2;
    expect(seen).toEqual([1, 2]);
  });
});
