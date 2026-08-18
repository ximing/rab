/**
 * 本文件是 observe() 的公开行为契约。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 契约按业务可依赖的行为组织：立即执行与依赖收集、依赖按次重建、lazy、
 * 返回值与包装、scheduler（函数型 / 对象型 / add-only）、全局默认 scheduler
 * （configure 交互）、debugger（读路径 + 写路径）、首跑抛错即脱管
 * （README 已知限制「observe 首跑抛错即脱管」）、重跑抛错保持存活与错误隔离
 * （README 已知限制「reaction 执行错误不中断同批」）、循环写入防死循环。
 *
 * 其中标注"README 已知限制"的用例钉住的是**当前行为**：升级时若行为改善，
 * 这些用例失败是预期的、是好事 —— 改断言 + changeset 注明即可。
 *
 * 纪律：每个用例独立自包含；文件级 afterEach 调 resetGlobalConfig()，
 * 避免全局配置跨文件污染。
 */
import {
  observe,
  observable,
  configure,
  resetGlobalConfig,
} from "../../main";
import type {
  Reaction,
  ReactionScheduler,
  Operation,
} from "../../main";

describe("observe() 公开行为契约", () => {
  afterEach(() => {
    resetGlobalConfig();
  });

  describe("立即执行与依赖收集", () => {
    test("observe(fn) 非 lazy 时立即同步执行一次 fn，无需任何触发", () => {
      const fn = jest.fn(() => {});
      observe(fn);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("首跑读到的 observable 属性成为依赖，属性变更后 fn 自动重跑并读到新值", () => {
      const state = observable({ x: 1 });
      let dummy = 0;
      observe(() => {
        dummy = state.x;
      });
      expect(dummy).toBe(1);
      state.x = 7;
      expect(dummy).toBe(7);
    });

    test("依赖的属性被删除时 reaction 重跑（读到 undefined）", () => {
      const state = observable<{ name?: string }>({ name: "rab" });
      let dummy: string | undefined;
      observe(() => {
        dummy = state.name;
      });
      expect(dummy).toBe("rab");
      delete state.name;
      expect(dummy).toBe(undefined);
    });

    test("同一次变更只重跑一次（fn 内对同一属性的多次读取不重复触发）", () => {
      const state = observable({ x: 1 });
      const fn = jest.fn(() => {
        void state.x;
        void state.x;
      });
      observe(fn);
      expect(fn).toHaveBeenCalledTimes(1);
      state.x = 2;
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("依赖按次重建", () => {
    test("每次执行重建依赖：首跑未读到的属性在变为依赖后，其变更开始触发", () => {
      const state = observable({ flag: false, a: "A0", b: "B0" });
      let dummy = "";
      observe(() => {
        dummy = state.flag ? state.a : state.b;
      });
      expect(dummy).toBe("B0");
      // a 尚未被读取，不是依赖
      state.a = "A1";
      expect(dummy).toBe("B0");
      // 分支翻转后 a 进入依赖集
      state.flag = true;
      expect(dummy).toBe("A1");
      state.a = "A2";
      expect(dummy).toBe("A2");
    });

    test("重跑后不再读取的属性退出依赖集，其变更不再触发", () => {
      const state = observable({ flag: true, a: "A0", b: "B0" });
      let dummy = "";
      observe(() => {
        dummy = state.flag ? state.a : state.b;
      });
      expect(dummy).toBe("A0");
      state.flag = false;
      expect(dummy).toBe("B0");
      // a 曾被首跑读过，但重跑后不再是依赖
      state.a = "A1";
      expect(dummy).toBe("B0");
    });
  });

  describe("lazy 选项", () => {
    test("lazy: true 时不执行 fn，返回可手动调用的 reaction", () => {
      const fn = jest.fn(() => {});
      observe(fn, { lazy: true });
      expect(fn).toHaveBeenCalledTimes(0);
    });

    test("手动调用 reaction() 执行 fn 并建立依赖，此后变更自动触发", () => {
      const state = observable({ x: 1 });
      const fn = jest.fn(() => {
        void state.x;
      });
      const reaction = observe(fn, { lazy: true });
      expect(fn).toHaveBeenCalledTimes(0);
      reaction();
      expect(fn).toHaveBeenCalledTimes(1);
      state.x = 2;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("lazy 手动首跑抛错同样脱管：异常穿透且后续写入不复活（README 已知限制「observe 首跑抛错即脱管」含此场景）", () => {
      const state = observable({ x: 1 });
      const runs: number[] = [];
      const reaction = observe(
        () => {
          void state.x;
          if (state.x === 1) throw new Error("manual boom");
          runs.push(state.x);
        },
        { lazy: true }
      );
      expect(() => reaction()).toThrow("manual boom");
      state.x = 2;
      expect(runs).toEqual([]);
    });
  });

  describe("返回值与包装", () => {
    test("observe(fn) 返回 reaction 函数，调用它透传 fn 的返回值", () => {
      const state = observable({ x: 2 });
      const reaction = observe(
        () => state.x * 10,
        { lazy: true }
      );
      expect(reaction()).toBe(20);
      state.x = 3;
      expect(reaction()).toBe(30);
    });

    test("调用 reaction 时透传 this 与参数", () => {
      function compute(this: { base: number }, a: number, b: number) {
        return this.base + a + b;
      }
      const reaction = observe(compute, { lazy: true });
      expect(reaction.call({ base: 100 }, 1, 2)).toBe(103);
    });

    test("observe(reaction) 不二次包装，原样返回同一 reaction", () => {
      const reaction = observe(() => {});
      expect(observe(reaction)).toBe(reaction);
    });
  });

  describe("scheduler", () => {
    test("无 scheduler 且未配置全局默认时，触发后同步立即执行（默认路径）", () => {
      const state = observable({ x: 1 });
      const fn = jest.fn(() => {
        void state.x;
      });
      observe(fn);
      expect(fn).toHaveBeenCalledTimes(1);
      // 同步默认：mutation 语句返回时 reaction 已重跑完毕
      state.x = 2;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("函数型 scheduler：首跑不走 scheduler 同步执行；触发时以 reaction 为参数调用 scheduler，由其决定何时执行", () => {
      const state = observable({ x: 1 });
      const fn = jest.fn(() => {
        void state.x;
      });
      const scheduled: Reaction[] = [];
      const reaction = observe(fn, {
        scheduler: (r) => scheduled.push(r),
      });
      expect(fn).toHaveBeenCalledTimes(1); // 首跑同步
      expect(scheduled).toEqual([]); // 首跑不走 scheduler
      state.x = 2;
      expect(fn).toHaveBeenCalledTimes(1); // 未被同步执行
      expect(scheduled).toEqual([reaction]); // scheduler 收到 reaction 本身
      scheduled[0]!();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("对象型 scheduler（如 Set）：触发时调用 add(reaction) 入队，业务冲刷队列时执行", () => {
      const state = observable({ x: 1 });
      const fn = jest.fn(() => {
        void state.x;
      });
      const queue = new Set<Reaction>();
      const reaction = observe(fn, { scheduler: queue });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(queue.size).toBe(0);
      state.x = 2;
      expect(fn).toHaveBeenCalledTimes(1);
      expect(Array.from(queue)).toEqual([reaction]);
      for (const r of queue) r();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("只实现 add 的调度对象即可工作（delete 可选，触发路径只要求 add）", () => {
      const state = observable({ x: 1 });
      let runs = 0;
      const queued: Reaction[] = [];
      const reaction = observe(
        () => {
          void state.x;
          runs++;
        },
        {
          scheduler: {
            add: (r: Reaction) => queued.push(r),
          } satisfies ReactionScheduler,
        }
      );
      expect(runs).toBe(1);
      state.x = 2;
      expect(runs).toBe(1);
      expect(queued).toEqual([reaction]);
      queued[0]!();
      expect(runs).toBe(2);
    });
  });

  describe("全局默认 scheduler（configure 交互）", () => {
    test("configure() 配置的全局 scheduler 作为未指定 options.scheduler 时的默认（首跑仍同步执行）", () => {
      const state = observable({ x: 1 });
      const fn = jest.fn(() => {
        void state.x;
      });
      const scheduled: Reaction[] = [];
      configure({
        scheduler: (r: Reaction) => scheduled.push(r),
      });
      observe(fn);
      expect(fn).toHaveBeenCalledTimes(1); // 首跑仍同步，不走 scheduler
      expect(scheduled).toEqual([]);
      state.x = 2;
      expect(fn).toHaveBeenCalledTimes(1);
      expect(scheduled.length).toBe(1);
      scheduled[0]!();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("显式传入的 options.scheduler 优先于全局默认", () => {
      const state = observable({ x: 1 });
      const fn = jest.fn(() => {
        void state.x;
      });
      const globalCalls: Reaction[] = [];
      const optionCalls: Reaction[] = [];
      configure({
        scheduler: (r: Reaction) => globalCalls.push(r),
      });
      const reaction = observe(fn, {
        scheduler: (r) => optionCalls.push(r),
      });
      state.x = 2;
      expect(globalCalls).toEqual([]);
      expect(optionCalls).toEqual([reaction]);
    });

    test("observe 时刻的全局 scheduler 被快照到 reaction：之后 resetGlobalConfig() 不影响已创建 reaction 的调度方式", () => {
      const state = observable({ x: 1 });
      const scheduled: Reaction[] = [];
      configure({
        scheduler: (r: Reaction) => scheduled.push(r),
      });
      const reaction = observe(() => {
        void state.x;
      });
      resetGlobalConfig();
      state.x = 2;
      // 已创建 reaction 保留创建时刻的快照，仍走全局 scheduler
      expect(scheduled).toEqual([reaction]);
    });

    test("resetGlobalConfig() 后新建的 reaction 回到同步立即执行的默认路径", () => {
      const state = observable({ x: 1 });
      configure({
        scheduler: (r: Reaction) => {
          void r;
        },
      });
      resetGlobalConfig();
      const fn = jest.fn(() => {
        void state.x;
      });
      observe(fn);
      state.x = 2;
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("debugger", () => {
    test("依赖读取时 debugger 收到读 operation（type/target/key/receiver）", () => {
      const rawObj = { x: 1 };
      const proxy = observable(rawObj);
      const ops: Operation[] = [];
      observe(
        () => {
          void proxy.x;
        },
        { debugger: (op) => ops.push(op) }
      );
      expect(ops.length).toBe(1);
      expect(ops[0]).toMatchObject({
        type: "get",
        target: rawObj,
        key: "x",
        receiver: proxy,
      });
    });

    test("依赖变更时 debugger 收到写 operation（含 value 与 oldValue），重跑的读也产生事件", () => {
      const rawObj = { x: 1 };
      const proxy = observable(rawObj);
      const ops: Operation[] = [];
      let dummy = 0;
      observe(
        () => {
          dummy = proxy.x;
        },
        { debugger: (op) => ops.push(op) }
      );
      ops.length = 0;
      proxy.x = 2;
      expect(dummy).toBe(2);
      const setOp = ops.find((op) => op.type === "set");
      expect(setOp).toMatchObject({
        type: "set",
        target: rawObj,
        key: "x",
        value: 2,
        oldValue: 1,
        receiver: proxy,
      });
      // reaction 重跑时的读路径同样到达 debugger
      expect(ops.some((op) => op.type === "get")).toBe(true);
    });

    test("写路径 debugger 抛错不吞调度：reaction 仍被执行，错误在变更调用点 rethrow（README 已知限制「reaction 执行错误不中断同批」）", () => {
      const state = observable({ x: 1 });
      const runs: number[] = [];
      observe(
        () => {
          runs.push(state.x);
        },
        {
          debugger: (op) => {
            if (op.type === "set") throw new Error("dbg boom");
          },
        }
      );
      expect(runs).toEqual([1]);
      expect(() => {
        state.x = 2;
      }).toThrow("dbg boom");
      // debugger 抛错没有吞掉 reaction 自身的调度
      expect(runs).toEqual([1, 2]);
    });
  });

  describe("首跑抛错（README 已知限制「observe 首跑抛错即脱管」）", () => {
    test("首跑抛错：异常穿透给 observe() 调用者，reaction 自动注销，后续写入不复活", () => {
      const state = observable({ x: 1 });
      const runs: number[] = [];
      expect(() =>
        observe(() => {
          void state.x;
          if (state.x === 1) throw new Error("init boom");
          runs.push(state.x);
        })
      ).toThrow("init boom");
      state.x = 2;
      state.x = 3;
      expect(runs).toEqual([]);
    });

    test("某个 reaction 首跑抛错不波及同一 observable 上的其他 reaction", () => {
      const state = observable({ x: 1 });
      let healthyRuns = 0;
      observe(() => {
        void state.x;
        healthyRuns++;
      });
      expect(() =>
        observe(() => {
          void state.x;
          throw new Error("boom");
        })
      ).toThrow("boom");
      state.x = 2;
      expect(healthyRuns).toBe(2);
    });
  });

  describe("重跑抛错与错误隔离（README 已知限制「reaction 执行错误不中断同批」）", () => {
    test("已成功跑过的 reaction 重跑抛错：错误在变更调用点 rethrow，但 reaction 保持存活，下次变更仍触发", () => {
      const state = observable({ x: 1 });
      const runs: number[] = [];
      let throwNow = false;
      observe(() => {
        void state.x;
        if (throwNow) throw new Error("rerun boom");
        runs.push(state.x);
      });
      expect(runs).toEqual([1]);
      throwNow = true;
      expect(() => {
        state.x = 2;
      }).toThrow("rerun boom");
      // 临时性错误不杀死活着的 reaction：错误清除后，下次变更仍触发
      throwNow = false;
      state.x = 3;
      expect(runs).toEqual([1, 3]);
    });

    test("一次变更触发多个 reaction 时，单个抛错不中断同批，第一个错误在变更调用点 rethrow", () => {
      const state = observable({ x: 1 });
      const order: string[] = [];
      let throwNow = false;
      observe(() => {
        void state.x;
        order.push("a");
        if (throwNow) throw new Error("a-boom");
      });
      observe(() => {
        void state.x;
        order.push("b");
      });
      expect(order).toEqual(["a", "b"]);
      throwNow = true;
      expect(() => {
        state.x = 2;
      }).toThrow("a-boom");
      // 抛错的 a 之后，同批的 b 仍执行了
      expect(order).toEqual(["a", "b", "a", "b"]);
    });
  });

  describe("循环写入防死循环", () => {
    test("reaction 自身执行期间写自身依赖：该次自写不把自身送入 scheduler（执行栈内不自排期）", () => {
      const state = observable({ num: 0 });
      const scheduled: Reaction[] = [];
      const reaction = observe(
        () => {
          state.num++;
        },
        { scheduler: (r) => scheduled.push(r) }
      );
      // 首跑内的自写发生在自己执行栈内，不得把自己排进队列
      expect(state.num).toBe(1);
      expect(scheduled).toEqual([]);
      // 外部写入正常排期一次
      state.num = 4;
      expect(scheduled).toEqual([reaction]);
      // 冲刷：重跑内的自写同样不得再次排期
      scheduled.shift()!();
      expect(state.num).toBe(5);
      expect(scheduled).toEqual([]);
    });

    test("reaction 写自身依赖的属性不死循环（执行栈内不重入），外部变更正常触发重跑", () => {
      const counter = observable({ num: 0 });
      const fn = jest.fn(() => {
        counter.num++;
      });
      observe(fn);
      expect(counter.num).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
      // 从外部变更时正常重跑一次，不会自激递归
      counter.num = 4;
      expect(counter.num).toBe(5);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("两个 reaction 互相写对方依赖的属性不死循环，最终收敛", () => {
      const nums = observable({ a: 0, b: 1 });
      const spy1 = jest.fn(() => {
        nums.a = nums.b;
      });
      const spy2 = jest.fn(() => {
        nums.b = nums.a;
      });
      observe(spy1);
      observe(spy2);
      expect(nums.a).toBe(1);
      expect(nums.b).toBe(1);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      nums.b = 4;
      expect(nums.a).toBe(4);
      expect(nums.b).toBe(4);
      expect(spy1).toHaveBeenCalledTimes(2);
      expect(spy2).toHaveBeenCalledTimes(2);
    });
  });
});
