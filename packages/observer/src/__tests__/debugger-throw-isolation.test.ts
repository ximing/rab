/*
 * 回归测试 (终审遗留 A1): queue 时的 reaction.debugger 抛错
 * 不得中断同批其余 reaction。
 *
 * 背景: queueReactionsForOperation 的 debugOperation 调用位于
 * per-reaction 错误收集之外 —— 一个 throwing debugger 的错误直接
 * 冒泡终止循环并 rethrow, 同批其余 reaction 不再执行, 与该函数
 * "单个 reaction 抛错不得中断同批" 的错误隔离契约不一致。
 *
 * 注意用例设计: debugger 在**注册期** (get trap, observe 首跑时) 也会触发,
 * 那条路径 (registerRunningReactionForOperation) 的错误归属 reaction 执行
 * 本身, 不在本测试范围。这里只在通知期 (op.type === "set") 抛错。
 * */
import { observable, observe } from "../main";
import type { Reaction } from "../main";

describe("debugger 抛错的错误隔离", () => {
  test("queue 时 debugger 抛错不得阻止同批其余 reaction 执行 (错误在调用点 rethrow)", () => {
    const state = observable({ x: 1 });
    const r1Runs: number[] = [];
    let r2Runs = 0;

    observe(
      () => {
        r1Runs.push(state.x);
      },
      {
        debugger: (op) => {
          if (op.type === "set") {
            throw new Error("dbg boom");
          }
        },
      }
    );
    observe(() => {
      void state.x;
      r2Runs++;
    });
    expect(r1Runs).toEqual([1]);
    expect(r2Runs).toBe(1);

    expect(() => {
      state.x = 2;
    }).toThrow("dbg boom");

    // r2 必须仍被通知 (修复前: 循环在 r1 的 debugger 处终止, r2 不执行)
    expect(r2Runs).toBe(2);
    // r1 自身的调度不受 debugger 抛错影响 (默认同步 scheduler 也执行了)
    expect(r1Runs).toEqual([1, 2]);

    // 错误隔离不影响后续批次
    expect(() => {
      state.x = 3;
    }).toThrow("dbg boom");
    expect(r2Runs).toBe(3);
    expect(r1Runs).toEqual([1, 2, 3]);
  });

  test("同批多个 throwing debugger: 第一个错误被 rethrow, 其余 reaction 仍执行", () => {
    const state = observable({ x: 1 });
    let r2Runs = 0;
    observe(() => void state.x, {
      debugger: (op) => {
        if (op.type === "set") {
          throw new Error("first");
        }
      },
    });
    observe(() => {
      void state.x;
      r2Runs++;
    });
    observe(() => void state.x, {
      debugger: (op) => {
        if (op.type === "set") {
          throw new Error("second");
        }
      },
    });
    expect(() => {
      state.x = 2;
    }).toThrow("first");
    expect(r2Runs).toBe(2);
  });

  test("debugger 抛错后 isDebugging 复位, 后续 debugger 仍被调用", () => {
    const state = observable({ x: 1 });
    const events: string[] = [];
    observe(() => void state.x, {
      debugger: (op) => {
        events.push(op.type);
        if (op.type === "set") {
          throw new Error("dbg");
        }
      },
    });
    expect(() => {
      state.x = 2;
    }).toThrow("dbg");
    expect(() => {
      state.x = 3;
    }).toThrow("dbg");
    // 两次 set 的 debugger 都触发了 (标志未卡死)
    expect(events.filter((t) => t === "set").length).toBe(2);
  });

  test("debugger 抛错不影响 reaction 自身的调度 (scheduler 仍收到入队)", () => {
    const state = observable({ x: 1 });
    const queue = new Set<Reaction>();
    let runs = 0;
    observe(
      () => {
        void state.x;
        runs++;
      },
      {
        scheduler: queue,
        debugger: (op) => {
          if (op.type === "set") {
            throw new Error("dbg");
          }
        },
      }
    );
    expect(queue.size).toBe(0); // 首跑同步执行, 未经过 scheduler
    expect(() => {
      state.x = 2;
    }).toThrow("dbg");
    // debugger 抛错不得吞掉调度本身: reaction 必须仍被入队
    expect(queue.size).toBe(1);
    const [r] = queue;
    expect(() => r()).not.toThrow();
    expect(runs).toBe(2);
  });
});
