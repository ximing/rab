/**
 * observe 复用已 unobserve 的 reaction 测试
 *
 * observe(r)（r 曾被 unobserve）应把 r 重新纳入观察（建立依赖、
 * 后续变更触发），而不是返回一个立即执行一次后静默失效的 reaction（#215）。
 */
import { observable, observe, unobserve, configure, resetGlobalConfig } from '../main';

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

  it('复活后首跑抛错按 firstRun 语义自动脱管，不变成零依赖僵尸（#233 交互回归）', () => {
    const state = observable({ a: 1 });
    let runs = 0;
    let shouldThrow = false;

    const r = observe(() => {
      runs++;
      void state.a;
      if (shouldThrow) {
        throw new Error('boom');
      }
    });
    expect(runs).toBe(1);

    unobserve(r);
    shouldThrow = true;

    // 复用（重新观察）：非 lazy 立即执行，本次执行抛错
    expect(() => observe(r)).toThrow('boom');
    // 复活视同全新首跑：失败后自动脱管，而不是保持「存活但零依赖」——
    // 后者会让之后的变更永远静默不触发，且不再有任何错误浮出水面
    expect(r.unobserved).toBe(true);

    // 脱管后变更不触发、不抛错
    state.a = 2;
    expect(runs).toBe(2);

    // 修复前的僵尸行为：unobserved=false、cleaners=[]，
    // state 再变也不触发也不报错
  });

  it('复活成功后的重跑失败仍走 restore 语义（保留依赖、保持存活）', () => {
    const state = observable({ a: 1 });
    let runs = 0;
    let shouldThrow = false;

    const r = observe(() => {
      runs++;
      void state.a;
      if (shouldThrow) {
        throw new Error('boom');
      }
    });
    unobserve(r);

    // 复活成功：everRan 重新置位
    observe(r);
    expect(runs).toBe(2);
    expect(r.unobserved).toBe(false);

    // 之后的重跑失败不是「首跑」：走 #233 的 restore 分支——
    // 回滚到上次成功依赖、reaction 保持存活
    shouldThrow = true;
    expect(() => {
      state.a = 2;
    }).toThrow('boom');
    expect(r.unobserved).toBe(false);

    // 依赖被回滚保留：恢复后变更继续触发
    shouldThrow = false;
    state.a = 3;
    expect(runs).toBe(4);
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

describe('observe 复活保留原配置（review 回归）', () => {
  it('裸 observe(r) 复活不覆盖自定义 scheduler / debugger', () => {
    const state = observable({ a: 1 });
    const scheduled: Array<() => void> = [];
    const debuggerOps: unknown[] = [];

    const r = observe(
      () => {
        void state.a;
      },
      {
        scheduler: (reaction: () => void) => scheduled.push(reaction as () => void),
        debugger: (op: unknown) => debuggerOps.push(op),
      }
    );

    unobserve(r);
    scheduled.length = 0;

    // 不带 options 复活：scheduler / debugger 必须保留，而不是被全局默认覆盖
    observe(r);

    state.a = 2;
    expect(scheduled.length).toBe(1);
    expect(debuggerOps.length).toBeGreaterThan(0);

    scheduled.forEach(run => run());
  });

  it('裸复活不得钉住「创建时捕获的全局 scheduler」：configure 变更后跟随新全局默认', () => {
    const state = observable({ a: 1 });
    const queuedA: Array<() => void> = [];
    const queuedB: Array<() => void> = [];

    try {
      // reaction 创建时的全局默认是 A（被捕获到 reaction.scheduler 上）
      configure({ scheduler: (reaction: unknown) => queuedA.push(reaction as () => void) });
      const r = observe(() => {
        void state.a;
      });

      // 之后全局默认换成 B
      configure({ scheduler: (reaction: unknown) => queuedB.push(reaction as () => void) });

      unobserve(r);
      // 裸复活：reaction 上的 scheduler 只是「捕获的旧全局默认」而非用户显式
      // 配置，应与 master 一样重新读取当前全局默认，而不是继续用 A
      observe(r);

      state.a = 2;
      expect(queuedA.length).toBe(0);
      expect(queuedB.length).toBe(1);
    } finally {
      resetGlobalConfig();
    }
  });

  it('显式自定义 scheduler 的 reaction 裸复活仍保留自定义 scheduler（不跟随全局变更）', () => {
    const state = observable({ a: 1 });
    const queuedCustom: Array<() => void> = [];
    const queuedGlobal: Array<() => void> = [];

    try {
      const r = observe(
        () => {
          void state.a;
        },
        { scheduler: (reaction: unknown) => queuedCustom.push(reaction as () => void) }
      );

      configure({ scheduler: (reaction: unknown) => queuedGlobal.push(reaction as () => void) });

      unobserve(r);
      observe(r);

      state.a = 2;
      expect(queuedCustom.length).toBe(1);
      expect(queuedGlobal.length).toBe(0);
    } finally {
      resetGlobalConfig();
    }
  });
});
