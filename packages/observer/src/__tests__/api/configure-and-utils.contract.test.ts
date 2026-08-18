/**
 * 本文件是 configure() / resetGlobalConfig() / isObservable() / raw() 的公开行为契约。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 覆盖范围（对应 main.ts 公开导出面）：
 * - configure(): 全局默认 scheduler 的生效、局部/全局优先级、undefined 不覆盖、
 *   重配置只影响之后创建的 reaction；
 * - resetGlobalConfig(): 恢复同步默认、不影响已创建 reaction 的 scheduler 快照；
 * - isObservable(): 对对象/数组/集合/函数 proxy 判 true，对原始对象与非对象判 false；
 * - raw(): 返回原始对象（恒等、幂等），对非 observable 输入原样返回；
 * - raw(this) 私有字段 workaround（README「已知限制」小节）；
 * - observe(fn) 返回的 reaction 作为函数调用时透传 fn 的返回值（契约地图缺口补钉）。
 *
 * 纪律：configure 是进程级全局状态，本文件 afterEach 必须 resetGlobalConfig()，
 * 每个用例独立自包含，不依赖其他用例的执行顺序或状态。
 */
import {
  observable,
  observe,
  unobserve,
  configure,
  resetGlobalConfig,
  isObservable,
  raw,
} from "../../main";

// 全局配置是跨用例共享的进程状态，任何用例结束后必须还原为默认值
afterEach(() => {
  resetGlobalConfig();
});

describe("configure() — 全局默认 scheduler", () => {
  it("未配置全局 scheduler 时（默认路径）：observe(fn) 立即同步执行一次，依赖变更后同步重跑（不经任何排期）", () => {
    const state = observable({ count: 0 });
    let runs = 0;

    const reaction = observe(() => {
      runs++;
      state.count;
    });

    // 默认承诺：首跑立即发生
    expect(runs).toBe(1);

    // 默认承诺：没有 scheduler 时变更同步触发重跑，且 fn 的返回值/执行不被排队
    state.count = 1;
    expect(runs).toBe(2);
    state.count = 2;
    expect(runs).toBe(3);

    unobserve(reaction);
  });

  it("configure({ scheduler }) 后：未指定局部 scheduler 的 reaction，依赖变更时交给全局 scheduler 排期（首跑仍同步立即执行）", () => {
    const queued: Array<() => void> = [];
    configure({
      scheduler: (reaction: any) => {
        queued.push(reaction as unknown as () => void);
      },
    });

    const state = observable({ count: 0 });
    let runs = 0;

    const reaction = observe(() => {
      runs++;
      state.count;
    });

    // 首跑不受 scheduler 影响：scheduler 只接管"变更后的重跑"
    expect(runs).toBe(1);
    expect(queued.length).toBe(0);

    state.count = 1;
    // 变更不立即重跑，而是进入全局 scheduler 队列
    expect(runs).toBe(1);
    expect(queued.length).toBe(1);

    // 冲刷队列时 reaction 才执行
    queued[0]();
    expect(runs).toBe(2);

    unobserve(reaction);
  });

  it("局部 scheduler 优先于全局 scheduler：observe(fn, { scheduler }) 指定了局部调度时，全局默认完全不参与", () => {
    const globalQueue: Array<() => void> = [];
    const localQueue: Array<() => void> = [];
    configure({
      scheduler: (r: any) => globalQueue.push(r as unknown as () => void),
    });

    const state = observable({ count: 0 });
    let runs = 0;

    const reaction = observe(
      () => {
        runs++;
        state.count;
      },
      {
        scheduler: (r: any) => localQueue.push(r as unknown as () => void),
      }
    );

    expect(runs).toBe(1);

    state.count = 1;
    // 只有局部 scheduler 收到排期，全局 scheduler 未被触碰
    expect(localQueue.length).toBe(1);
    expect(globalQueue.length).toBe(0);

    localQueue[0]();
    expect(runs).toBe(2);

    unobserve(reaction);
  });

  it("configure 支持对象型 scheduler（如 Set）作为全局默认：变更时 reaction 被 add 进对象，取出执行后生效", () => {
    const schedulerSet = new Set<any>();
    configure({ scheduler: schedulerSet });

    const state = observable({ count: 0 });
    let runs = 0;

    const reaction = observe(() => {
      runs++;
      state.count;
    });

    expect(runs).toBe(1);
    expect(schedulerSet.size).toBe(0);

    state.count = 1;
    expect(runs).toBe(1);
    expect(schedulerSet.size).toBe(1);

    Array.from(schedulerSet).forEach((r) => r());
    expect(runs).toBe(2);

    unobserve(reaction);
  });

  it("configure({ scheduler: undefined }) 不覆盖已配置的全局 scheduler（undefined 表示'未提供'，不是'清空'）", () => {
    const queued: Array<() => void> = [];
    configure({
      scheduler: (r: any) => queued.push(r as unknown as () => void),
    });

    // 显式传入 undefined：已配置的全局 scheduler 应保持不变
    configure({ scheduler: undefined });

    const state = observable({ count: 0 });
    let runs = 0;

    const reaction = observe(() => {
      runs++;
      state.count;
    });

    state.count = 1;
    expect(queued.length).toBe(1);
    expect(runs).toBe(1);

    queued[0]();
    expect(runs).toBe(2);

    unobserve(reaction);
  });

  it("重新 configure 只影响之后创建的 reaction：已创建 reaction 的 scheduler 是创建时的快照", () => {
    const queue1: Array<() => void> = [];
    const queue2: Array<() => void> = [];
    configure({
      scheduler: (r: any) => queue1.push(r as unknown as () => void),
    });

    const state = observable({ count: 0 });
    let runs1 = 0;
    let runs2 = 0;

    const reaction1 = observe(() => {
      runs1++;
      state.count;
    });

    configure({
      scheduler: (r: any) => queue2.push(r as unknown as () => void),
    });

    const reaction2 = observe(() => {
      runs2++;
      state.count;
    });

    state.count = 1;
    // reaction1 仍走配置切换前的 scheduler 快照；reaction2 走新 scheduler
    expect(queue1.length).toBe(1);
    expect(queue2.length).toBe(1);

    queue1[0]();
    queue2[0]();
    expect(runs1).toBe(2);
    expect(runs2).toBe(2);

    unobserve(reaction1);
    unobserve(reaction2);
  });
});

describe("resetGlobalConfig() — 恢复全局默认", () => {
  it("reset 后新建的 reaction 回到同步默认：不再被任何 scheduler 排期，变更立即重跑", () => {
    const queued: Array<() => void> = [];
    configure({
      scheduler: (r: any) => queued.push(r as unknown as () => void),
    });
    resetGlobalConfig();

    const state = observable({ count: 0 });
    let runs = 0;

    const reaction = observe(() => {
      runs++;
      state.count;
    });

    expect(runs).toBe(1);
    state.count = 1;
    // reset 已抹掉全局 scheduler：同步重跑，无排期
    expect(runs).toBe(2);
    expect(queued.length).toBe(0);

    unobserve(reaction);
  });

  it("reset 不影响已创建 reaction 的 scheduler 快照：reset 前创建的 reaction 仍走当时的全局 scheduler", () => {
    const queued: Array<() => void> = [];
    configure({
      scheduler: (r: any) => queued.push(r as unknown as () => void),
    });

    const state = observable({ count: 0 });
    let oldRuns = 0;
    let newRuns = 0;

    const oldReaction = observe(() => {
      oldRuns++;
      state.count;
    });

    resetGlobalConfig();

    const newReaction = observe(() => {
      newRuns++;
      state.count;
    });

    state.count = 1;
    // 旧 reaction：快照的 scheduler 依然接管（reset 只影响"之后"的创建）
    expect(queued.length).toBe(1);
    expect(oldRuns).toBe(1);
    // 新 reaction：reset 后走同步默认
    expect(newRuns).toBe(2);

    queued.splice(0).forEach((r) => r());
    expect(oldRuns).toBe(2);

    unobserve(oldReaction);
    unobserve(newReaction);
  });
});

describe("isObservable() — 可观察身份判定", () => {
  it("observable() 包装后的对象与数组 proxy 判定为 true", () => {
    expect(isObservable(observable({ a: 1 }))).toBe(true);
    expect(isObservable(observable([1, 2, 3]))).toBe(true);
  });

  it("observable() 包装后的集合 proxy（Map/Set/WeakMap/WeakSet）判定为 true", () => {
    expect(isObservable(observable(new Map()))).toBe(true);
    expect(isObservable(observable(new Set()))).toBe(true);
    expect(isObservable(observable(new WeakMap()))).toBe(true);
    expect(isObservable(observable(new WeakSet()))).toBe(true);
  });

  it("observable(fn) 返回的函数 proxy 判定为 true（函数是一等 observable）", () => {
    const fn = function (x: number) {
      return x;
    };
    const observedFn = observable(fn);
    expect(isObservable(observedFn)).toBe(true);
  });

  it("普通对象、数组、类实例（未被 observable 包装）判定为 false", () => {
    class Foo {
      bar = 1;
    }
    expect(isObservable({ a: 1 })).toBe(false);
    expect(isObservable([1, 2, 3])).toBe(false);
    expect(isObservable(new Foo())).toBe(false);
    expect(isObservable(new Map())).toBe(false);
    expect(isObservable(function () {})).toBe(false);
  });

  it("observable 的原始对象（raw 侧）判定为 false：只有 proxy 侧是 observable", () => {
    const obj = { a: 1 };
    const proxy = observable(obj);
    expect(isObservable(proxy)).toBe(true);
    expect(isObservable(obj)).toBe(false);
  });

  it("非对象输入（null/undefined/数字/字符串）判定为 false 而不是抛错", () => {
    expect(isObservable(null)).toBe(false);
    expect(isObservable(undefined)).toBe(false);
    expect(isObservable(42)).toBe(false);
    expect(isObservable("text")).toBe(false);
    expect(isObservable(true)).toBe(false);
  });
});

describe("raw() — 取回原始对象", () => {
  it("raw(proxy) 返回包装前的原始对象，且多次调用恒等同一对象", () => {
    const obj = { a: 1 };
    const proxy = observable(obj);

    expect(raw(proxy)).toBe(obj);
    expect(raw(proxy)).toBe(raw(proxy));
  });

  it("raw() 对 Map/Set proxy 返回原始集合实例（保留 instanceof 判定）", () => {
    const map = new Map();
    const set = new Set();
    const mapProxy = observable(map);
    const setProxy = observable(set);

    expect(raw(mapProxy)).toBe(map);
    expect(raw(setProxy)).toBe(set);
    expect(raw(mapProxy) instanceof Map).toBe(true);
    expect(raw(setProxy) instanceof Set).toBe(true);
  });

  it("raw() 对 deep 模式的嵌套子 proxy 同样生效：返回嵌套层的原始对象", () => {
    const inner = { value: 1 };
    const proxy = observable({ inner });
    const innerProxy = proxy.inner;

    expect(isObservable(innerProxy)).toBe(true);
    expect(raw(innerProxy)).toBe(inner);
  });

  it("raw() 对非 observable 输入原样返回：普通对象恒等，且幂等", () => {
    const plain = { a: 1 };
    const plainArr = [1, 2];

    expect(raw(plain)).toBe(plain);
    expect(raw(plainArr)).toBe(plainArr);
    expect(raw(raw(plain))).toBe(plain);

    // raw 再喂 raw 侧对象（observable 的原始对象）也原样返回
    const obj = { a: 1 };
    const proxy = observable(obj);
    expect(raw(obj)).toBe(obj);
    expect(isObservable(raw(proxy))).toBe(false);
  });

  it("raw(fnProxy) 返回原始函数（observable(fn) 的函数 proxy 同样可解包）", () => {
    const fn = function () {
      return 1;
    };
    const fnProxy = observable(fn);
    expect(raw(fnProxy)).toBe(fn);
  });
});

describe("raw(this) 私有字段 workaround（README「已知限制」小节）", () => {
  it("限制（当前行为，README 已知限制）：包装含 #field 的类实例后，经 proxy 调用访问私有字段的方法抛 TypeError", () => {
    class Counter {
      #count = 0;
      increment() {
        this.#count++;
        return this.#count;
      }
    }
    const instance = new Counter();
    const observed = observable(instance);

    expect(() => observed.increment()).toThrow(TypeError);
  });

  it("官方 workaround（README 已知限制）：方法内部用 raw(this) 取回原始实例后访问私有字段可用", () => {
    class Counter {
      #count = 0;
      incrementViaRaw() {
        const self = raw(this as object) as Counter;
        self.#count++;
        return self.#count;
      }
    }
    const instance = new Counter();
    const observed = observable(instance);

    // 经 proxy 调用：this 是 proxy，raw(this) 还原为原始实例，私有字段访问成功
    expect(observed.incrementViaRaw()).toBe(1);
    expect(observed.incrementViaRaw()).toBe(2);
  });
});

describe("reaction 作为函数调用（契约地图缺口补钉）", () => {
  it("observe(fn) 返回的 reaction 作为函数调用时，透传 fn 的返回值", () => {
    const state = observable({ count: 0 });
    const reaction = observe(() => {
      state.count;
      return state.count * 2;
    });

    // reaction() 手动重跑时，调用方拿到的是 fn 的返回值
    expect(reaction()).toBe(0);
    state.count = 21;
    expect(reaction()).toBe(42);

    unobserve(reaction);
  });
});
