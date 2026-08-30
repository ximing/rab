/**
 * observe 复用已 unobserve 的 reaction 测试
 *
 * observe(r)（r 曾被 unobserve）应把 r 重新纳入观察（建立依赖、
 * 后续变更触发），而不是返回一个立即执行一次后静默失效的 reaction（#215）。
 */
import { observable, observe, unobserve } from '../main';

describe('observe 复用已 unobserve 的 reaction（#215）', () => {
  it('observe(unobserve 过的 reaction) 重新建立依赖，变更继续触发', () => {
    const state = observable({ a: 1 });
    let runs = 0;

    const r = observe(() => {
      runs++;
      void state.a;
    });
    expect(runs).toBe(1);

    unobserve(r);
    state.a = 2;
    expect(runs).toBe(1);

    // 复用：语义是「重新观察」
    const r2 = observe(r);
    expect(r2).toBe(r);
    // 非 lazy 会立即执行一次（重新收集依赖）
    expect(runs).toBe(2);

    state.a = 3;
    expect(runs).toBe(3);
  });

  it('复用时 lazy 选项生效：不立即执行，手动调用后依赖恢复', () => {
    const state = observable({ a: 1 });
    let runs = 0;

    const r = observe(
      () => {
        runs++;
        void state.a;
      },
      { lazy: true }
    );
    r();
    expect(runs).toBe(1);

    unobserve(r);
    state.a = 2;
    expect(runs).toBe(1);

    const r2 = observe(r, { lazy: true });
    expect(r2).toBe(r);
    expect(runs).toBe(1); // lazy：不立即执行

    r2();
    expect(runs).toBe(2);

    state.a = 3;
    expect(runs).toBe(3);
  });

  it('unobserve 语义不变：脱管后变更不再触发', () => {
    const state = observable({ a: 1 });
    let runs = 0;

    const r = observe(() => {
      runs++;
      void state.a;
    });
    expect(runs).toBe(1);

    unobserve(r);
    state.a = 2;
    state.a = 3;
    expect(runs).toBe(1);
  });

  it('复用带自定义 scheduler 的 reaction 保持调度行为', () => {
    const state = observable({ a: 1 });
    let runs = 0;
    const queued: Array<() => void> = [];

    const r = observe(
      () => {
        runs++;
        void state.a;
      },
      {
        lazy: true,
        scheduler: (reaction: unknown) => {
          queued.push(reaction as () => void);
        },
      }
    );
    r();
    expect(runs).toBe(1);

    unobserve(r);
    const r2 = observe(r, {
      lazy: true,
      scheduler: (reaction: unknown) => {
        queued.push(reaction as () => void);
      },
    });
    r2();
    expect(runs).toBe(2);

    state.a = 2;
    expect(queued.length).toBe(1); // 走自定义 scheduler
    queued[0]!();
    expect(runs).toBe(3);
  });
});
