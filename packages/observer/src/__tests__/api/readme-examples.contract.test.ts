/**
 * 本文件是 README.md 的公开行为契约（"README 即契约"）。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * Scope: packages/observer/README.md 正文中的每一个可执行示例与注释断言
 * （如「// 立即执行一次: 0」「// 重新运行: 1」「// 停止追踪」）、
 * "observe / unobserve" 章节对 scheduler 两形态与 unobserve 的承诺、
 * "unobserve 之后'在途执行'的语义" 章节的每一条，以及 "已知限制" 小节的
 * 全部 6 条可执行行为。JSDoc @example（observable.ts / shadow-observable.ts /
 * configure.ts）不在本文件——归各 API 模块自己的契约文件钉。
 *
 * 用例按 README 行文组织；每个用例独立自包含，不依赖其他用例的顺序或状态。
 * 已知限制类用例钉"当前行为"，若未来行为改善（如 accessor 同值不再通知、
 * ES2024 Set 方法返回包装成员），这些用例失败是预期的——改断言 + changeset
 * 注明即可，同时必须同步更新 README 措辞。
 */
import { observable, observe, unobserve, isObservable, raw, resetGlobalConfig } from '../../main';
import type { Reaction, ReactionScheduler } from '../../main';

// 全模块纪律：configure 契约污染是跨文件最大风险，任何用例结束后清空全局配置。
afterEach(() => {
  resetGlobalConfig();
});

describe('README 首段与主示例（observe/unobserve 三步）', () => {
  test('observe(fn) 立即执行一次并建立依赖，依赖属性变化时重新运行，unobserve 后停止追踪', () => {
    // README 主示例的逐字改写：注释声称的三步结果全部断言。
    const state = observable({ count: 0 });
    const logs: number[] = [];

    const reaction = observe(() => {
      logs.push(state.count); // README: 立即执行一次: 0
    });
    expect(logs).toEqual([0]);

    state.count = 1; // README: 重新运行: 1
    expect(logs).toEqual([0, 1]);

    unobserve(reaction); // README: 停止追踪, 之后变更不再触发
    state.count = 2;
    expect(logs).toEqual([0, 1]);
  });

  test('reaction 只因自己读取过的属性变化而重新运行（README 首段：细粒度依赖收集）', () => {
    const state = observable({ read: 0, unread: 0 });
    let runs = 0;
    observe(() => {
      void state.read;
      runs++;
    });
    expect(runs).toBe(1);

    state.unread = 1; // 未读取过的属性变化不触发
    expect(runs).toBe(1);

    state.read = 1;
    expect(runs).toBe(2);
  });

  test('README 首段承诺：对象、数组、集合都可以包装成细粒度可观察代理', () => {
    const obj = observable({ a: 0 });
    let objRuns = 0;
    observe(() => {
      void obj.a;
      objRuns++;
    });
    obj.a = 1;
    expect(objRuns).toBe(2);

    const arr = observable([1]);
    let length = 0;
    observe(() => {
      length = arr.length;
    });
    expect(length).toBe(1);
    arr.push(2);
    expect(length).toBe(2);

    const set = observable(new Set<number>([1]));
    let size = 0;
    observe(() => {
      size = set.size;
    });
    expect(size).toBe(1);
    set.add(2);
    expect(size).toBe(2);
  });
});

describe("README 'observe / unobserve' 章节：scheduler 两形态与 unobserve 承诺", () => {
  test('函数型 scheduler 接管触发时机：变更不立即执行，由 scheduler 决定何时运行', () => {
    const state = observable({ count: 0 });
    const pending: Array<() => void> = [];
    let runs = 0;

    observe(
      () => {
        void state.count;
        runs++;
      },
      {
        scheduler: (reaction: Reaction) => {
          pending.push(reaction as unknown as () => void);
        },
      }
    );
    expect(runs).toBe(1); // 首跑不受 scheduler 接管，仍同步立即执行

    state.count = 1;
    expect(runs).toBe(1); // 变更只进入 scheduler，不立即执行
    expect(pending.length).toBe(1);

    (pending.shift() as () => void)(); // 冲刷队列
    expect(runs).toBe(2);
  });

  test('对象型 scheduler（如 Set）批量收集，稍后统一执行，且同一 reaction 去重', () => {
    const state = observable({ a: 0, b: 0 });
    const batch = new Set<Reaction>();
    let runs = 0;

    observe(
      () => {
        void state.a;
        void state.b;
        runs++;
      },
      { scheduler: batch }
    );
    expect(runs).toBe(1);

    state.a = 1;
    state.b = 1; // 两次变更都只入队
    expect(runs).toBe(1);
    expect(batch.size).toBe(1); // Set 天然去重，同一 reaction 只排一次

    for (const reaction of batch) {
      reaction();
    }
    batch.clear();
    expect(runs).toBe(2); // 统一执行一次
  });

  test('unobserve 释放已建立的全部依赖连接：之后任何曾读取过的属性变化都不再触发', () => {
    const state = observable({ a: 0, b: 0 });
    let runs = 0;
    const reaction = observe(() => {
      void state.a;
      void state.b;
      runs++;
    });
    expect(runs).toBe(1);

    unobserve(reaction);
    state.a = 1;
    state.b = 1;
    expect(runs).toBe(1);
  });

  test('重复调用 unobserve 是安全的（README 明文承诺）', () => {
    const state = observable({ count: 0 });
    const reaction = observe(() => {
      void state.count;
    });
    unobserve(reaction);
    expect(() => {
      unobserve(reaction);
      unobserve(reaction);
    }).not.toThrow();
  });

  test('对象型 scheduler 的 delete 是可选的：只实现 add 的调度对象在 unobserve 时不抛错', () => {
    const state = observable({ count: 0 });
    const reaction = observe(
      () => {
        void state.count;
      },
      {
        scheduler: {
          add(_reaction: Reaction) {
            /* 只按 add 半边契约写的调度对象 */
          },
        } satisfies ReactionScheduler,
      }
    );
    expect(() => {
      unobserve(reaction);
    }).not.toThrow();
  });
});

describe("README 'unobserve 之后在途执行的语义（重要）' 章节逐条", () => {
  test('手动调用仍执行：unobserve 后调用 reaction() 函数照常执行一次，且执行期间不建立任何新依赖', () => {
    const state = observable({ count: 0 });
    let runs = 0;
    const reaction = observe(() => {
      void state.count;
      runs++;
    });
    expect(runs).toBe(1);

    unobserve(reaction);
    reaction();
    expect(runs).toBe(2); // 手动调用照常执行

    state.count = 1; // 在途执行期间读过的 count 未建立新依赖
    expect(runs).toBe(2); // 之后的变更依旧不触发
  });

  test('嵌套手动调用：在另一个正在运行的 reaction 内调用已 unobserve 的 reaction，其读取不归属外层、不误触发外层', () => {
    const state = observable({ a: 0, b: 0 });
    let innerRuns = 0;
    const inner = observe(() => {
      void state.b;
      innerRuns++;
    });
    unobserve(inner);

    let outerRuns = 0;
    observe(() => {
      void state.a;
      outerRuns++;
      inner(); // 在 outer 运行中手动调用已 unobserve 的 inner
    });
    expect(outerRuns).toBe(1);
    expect(innerRuns).toBe(2); // inner 首跑 + 在 outer 内的手动调用，都执行

    state.b = 1; // inner 读过 b，但已 unobserve 且读取不得归属 outer
    expect(outerRuns).toBe(1); // outer 从未读过 b，不得被误触发
    expect(innerRuns).toBe(2); // inner 不再被触发
  });

  test('已排期的执行仍落地：函数型 scheduler 通过 setTimeout 排期后 unobserve，到点仍执行一次且不重建依赖', () => {
    jest.useFakeTimers();
    try {
      const state = observable({ count: 0 });
      let runs = 0;
      const reaction = observe(
        () => {
          void state.count;
          runs++;
        },
        {
          scheduler: (r: Reaction) => {
            setTimeout(r as unknown as () => void, 30);
          },
        }
      );
      expect(runs).toBe(1);

      state.count = 1; // scheduler: setTimeout(reaction, 30)
      unobserve(reaction); // 立刻 unobserve，但无法撤回定时器闭包里的引用

      jest.advanceTimersByTime(30);
      expect(runs).toBe(2); // 已排期的这次执行照常落地

      state.count = 2;
      expect(runs).toBe(2); // 落地的这次执行未重建依赖
    } finally {
      jest.useRealTimers();
    }
  });

  test('对象型 scheduler 实现了 delete 时，unobserve 移除尚未冲刷的排队条目', () => {
    const state = observable({ count: 0 });
    const batch = new Set<Reaction>();
    let runs = 0;
    const reaction = observe(
      () => {
        void state.count;
        runs++;
      },
      { scheduler: batch }
    );
    expect(runs).toBe(1);

    state.count = 1;
    expect(batch.size).toBe(1); // 排队中

    unobserve(reaction);
    expect(batch.size).toBe(0); // 实现了 delete 的调度对象：条目被移除

    for (const r of batch) {
      r();
    }
    expect(runs).toBe(1); // 冲刷时无条目，不再执行
  });
});

describe("README '已知限制' 小节（钉当前行为；行为改善时这些用例失败是预期的）", () => {
  describe('限制 1：私有字段（#field）—— Proxy brand check 限制', () => {
    class PrivateCounter {
      #count = 0;
      // 经代理访问：this 是 proxy，通不过 #count 的 brand check
      readViaProxy() {
        return this.#count;
      }
      // README 官方 workaround：方法内用 raw(this) 取回原始实例再访问私有字段
      readViaRaw() {
        return raw(this).#count;
      }
      incrementViaRaw() {
        raw(this).#count += 1;
      }
    }

    test('限制本身：包装后经 proxy 调用访问私有字段的方法抛 TypeError', () => {
      const proxy = observable(new PrivateCounter());
      expect(() => {
        proxy.readViaProxy();
      }).toThrow(TypeError);
      expect(() => {
        proxy.readViaProxy();
      }).toThrow(/Cannot read private member/);
    });

    test('官方 workaround：方法内 raw(this) 访问私有字段可用，可读可写', () => {
      const proxy = observable(new PrivateCounter());
      expect(proxy.readViaRaw()).toBe(0);
      expect(() => {
        proxy.incrementViaRaw();
        proxy.incrementViaRaw();
      }).not.toThrow();
      expect(proxy.readViaRaw()).toBe(2);
    });
  });

  // 限制 2「unobserve 不取消在途执行」= 上文 "unobserve 之后在途执行的语义"
  // 章节的四条用例，此处不重复，交叉引用之。

  describe('限制 3：在途的 unobserved reaction 仍触发 debugger 事件', () => {
    test('unobserve 后手动调用（在途执行）期间，debugger 仍收到读事件——debugger 是观察工具，不因脱管而静默', () => {
      const state = observable({ count: 0 });
      const readEvents: string[] = [];
      const reaction = observe(
        () => {
          void state.count;
        },
        {
          debugger: operation => {
            readEvents.push(operation.type);
          },
        }
      );
      expect(readEvents).toEqual(['get']); // 首跑的读事件

      unobserve(reaction);
      reaction(); // 在途的那一次执行
      expect(readEvents).toEqual(['get', 'get']); // 仍收到事件
    });

    test('reaction.unobserved 公开标记：unobserve 前为假、后为真，README 明示可在 debugger 回调里检查它过滤在途事件', () => {
      const state = observable({ count: 0 });
      let reaction!: Reaction;
      const readEvents: string[] = [];
      reaction = observe(
        () => {
          void state.count;
        },
        {
          debugger: operation => {
            // README 建议的过滤方式：跳过已脱管 reaction 的在途事件
            if (reaction && reaction.unobserved) {
              return;
            }
            readEvents.push(operation.type);
          },
        }
      );
      expect(readEvents).toEqual(['get']); // 首跑事件未被过滤
      expect(Boolean(reaction.unobserved)).toBe(false);

      unobserve(reaction);
      expect(reaction.unobserved).toBe(true); // 公开标记存在且语义如 README 所述

      reaction(); // 在途执行：事件到达 debugger 但被过滤
      expect(readEvents).toEqual(['get']);
    });
  });

  describe('限制 4：observe 首跑抛错即脱管', () => {
    test('observe(fn) 首跑抛错：异常穿透给调用者，reaction 自动注销，后续写入不复活它', () => {
      const state = observable({ count: 0 });
      let runs = 0;
      expect(() => {
        observe(() => {
          void state.count;
          runs++;
          throw new Error('first run boom');
        });
      }).toThrow('first run boom');
      expect(runs).toBe(1);

      state.count = 1; // 不留下半成品依赖导致写入复活
      expect(runs).toBe(1);
    });

    test('lazy reaction 的手动首跑抛错同样脱管', () => {
      const state = observable({ count: 0 });
      let runs = 0;
      const reaction = observe(
        () => {
          void state.count;
          runs++;
          throw new Error('lazy first run boom');
        },
        { lazy: true }
      );
      expect(() => {
        reaction();
      }).toThrow('lazy first run boom');
      expect(reaction.unobserved).toBe(true);

      state.count = 1;
      expect(runs).toBe(1); // 不复活
    });

    test('已成功执行过至少一次的 reaction，后续重跑抛错保持存活（依赖保留，下次变更仍触发）', () => {
      const state = observable({ count: 0 });
      let runs = 0;
      let throwOnRerun = false;
      observe(() => {
        void state.count;
        runs++;
        if (throwOnRerun) {
          throw new Error('rerun boom');
        }
      });
      expect(runs).toBe(1);

      throwOnRerun = true;
      expect(() => {
        state.count = 1;
      }).toThrow('rerun boom'); // 错误由隔离机制在变更调用点上抛
      expect(runs).toBe(2);

      throwOnRerun = false;
      state.count = 2; // reaction 仍存活
      expect(runs).toBe(3);
    });
  });

  describe('限制 5：reaction 执行错误不中断同批', () => {
    test('一个 reaction 抛错不阻止其余 reaction 执行，所有 reaction 跑完后第一个错误在变更调用点 rethrow', () => {
      const state = observable({ count: 0 });
      let throwOnRerun = false;
      let okRuns = 0;
      observe(() => {
        void state.count;
        if (throwOnRerun) {
          throw new Error('boom');
        }
      });
      observe(() => {
        void state.count;
        okRuns++;
      });
      expect(okRuns).toBe(1);

      throwOnRerun = true;
      expect(() => {
        state.count = 1;
      }).toThrow('boom'); // 第一个错误在变更调用点 rethrow
      expect(okRuns).toBe(2); // 其余 reaction 照常执行
    });

    test('reaction 的 debugger 抛错同样不中断同批：错误上抛，其余 reaction 与本 reaction 的调度照常', () => {
      const state = observable({ count: 0 });
      let debuggerThrows = false;
      let okRuns = 0;
      observe(
        () => {
          void state.count;
        },
        {
          debugger: () => {
            if (debuggerThrows) {
              throw new Error('debugger boom');
            }
          },
        }
      );
      observe(() => {
        void state.count;
        okRuns++;
      });
      expect(okRuns).toBe(1);

      debuggerThrows = true;
      expect(() => {
        state.count = 1;
      }).toThrow('debugger boom');
      expect(okRuns).toBe(2); // debugger 抛错没有吞掉其余 reaction 的执行
    });
  });

  describe('限制 6：accessor 属性的同值写入会通知', () => {
    test('accessor 属性写入与当前 getter 返回值相同的值，reaction 仍重跑一次（当前行为，README 已知限制）', () => {
      let stored = 0;
      const state = observable({
        get value() {
          return stored;
        },
        set value(next: number) {
          stored = next;
        },
      });
      let runs = 0;
      observe(() => {
        void state.value;
        runs++;
      });
      expect(runs).toBe(1);

      state.value = 0; // 与 getter 当前返回值相同
      expect(runs).toBe(2); // 仍通知——accessor 无法安全比较旧值
    });

    test('数据属性无此问题：同值写入（Object.is 相等）不触发重新运行', () => {
      const state = observable({ count: 0 });
      let runs = 0;
      observe(() => {
        void state.count;
        runs++;
      });
      expect(runs).toBe(1);

      state.count = 0; // Object.is(0, 0) —— 同值不通知
      expect(runs).toBe(1);

      state.count = 1;
      expect(runs).toBe(2);
    });
  });

  describe('限制 7：ES2024 Set 方法（union/intersection/difference 等）deep 模式返回原始成员', () => {
    interface SetWithES2024Methods<T> {
      union(other: Set<unknown>): Set<T>;
      intersection(other: Set<unknown>): Set<T>;
      difference(other: Set<unknown>): Set<T>;
    }

    test('deep 模式下 union/intersection/difference 的结果成员不经包装，与 values() 的深度语义不对称（当前行为，README 已知限制）', () => {
      const member = { id: 1 };
      const state = observable(new Set([member]));
      const withMethods = state as unknown as SetWithES2024Methods<typeof member>;

      const fromValues = [...state.values()][0];
      expect(isObservable(fromValues)).toBe(true); // values()/迭代器路径：成员被深度包装
      expect(raw(fromValues)).toBe(member);

      const unioned = [...withMethods.union(new Set([{ id: 2 }]))][0];
      expect(unioned).toBe(member); // union 返回原始成员本身
      expect(isObservable(unioned)).toBe(false); // 不经 observableChild 包装

      const intersected = [...withMethods.intersection(new Set([member, { id: 3 }]))][0];
      expect(isObservable(intersected)).toBe(false);

      const rest = [...withMethods.difference(new Set([{ id: 9 }]))][0];
      expect(isObservable(rest)).toBe(false);
    });
  });
});
