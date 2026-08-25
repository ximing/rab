/**
 * 本文件是 unobserve() 的公开行为契约。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 契约来源：
 * - README.md「observe / unobserve」章节
 * - README.md「unobserve 之后"在途执行"的语义（重要）」章节（逐条成测试）
 * - README.md「已知限制」中与 unobserve 相关的条目（在途执行 / debugger 在途事件）
 *
 * 写法约定：每个用例独立自包含；断言"观察到的值 / 执行次数 / 抛出的错误"；
 * 已知限制用例钉"当前行为 + 引用 README 小节名"。
 */
import { observable, observe, unobserve, resetGlobalConfig } from '../../main';
import type { Reaction, ReactionScheduler } from '../../main';

afterEach(() => {
  resetGlobalConfig();
});

describe('unobserve(reaction) 停止后续触发', () => {
  test('unobserve 之后，依赖属性的变更不再重新运行该函数', () => {
    const counter = observable({ num: 0 });
    const runs = jest.fn(() => {
      void counter.num;
    });
    const reaction = observe(runs);

    expect(runs).toHaveBeenCalledTimes(1); // observe 立即执行一次
    counter.num = 1;
    expect(runs).toHaveBeenCalledTimes(2); // 依赖变更触发重跑

    unobserve(reaction);
    counter.num = 2;
    expect(runs).toHaveBeenCalledTimes(2); // unobserve 后零触发
  });

  test('unobserve 释放该 reaction 建立的全部依赖连接：之后对它读过或未读过的属性写入都是零触发', () => {
    const obj = observable({ a: 0, b: 0 });
    let dummyA = -1;
    const reaction = observe(() => {
      dummyA = obj.a;
    });

    expect(dummyA).toBe(0);
    obj.a = 1;
    expect(dummyA).toBe(1);

    unobserve(reaction);
    obj.a = 2; // 它建立过依赖的属性
    obj.b = 2; // 它从未读过的属性
    expect(dummyA).toBe(1); // 值停留在最后一次执行的快照
  });

  test('同一 target/key 上的多个 reaction 各自独立：unobserve 其一不影响其余的触发', () => {
    const counter = observable({ num: 0 });
    let dummy1 = -1;
    let dummy2 = -1;
    let dummy3 = -1;
    const r1 = observe(() => (dummy1 = counter.num));
    const r2 = observe(() => (dummy2 = counter.num));
    const r3 = observe(() => (dummy3 = counter.num));

    expect([dummy1, dummy2, dummy3]).toEqual([0, 0, 0]);

    unobserve(r2);
    counter.num = 1;
    expect(dummy1).toBe(1);
    expect(dummy2).toBe(0); // 只有 r2 停止
    expect(dummy3).toBe(1);
  });
});

describe('重复调用 unobserve 是安全的', () => {
  test('多次调用 unobserve 与调用一次效果相同，不抛错', () => {
    const counter = observable({ num: 0 });
    const runs = jest.fn(() => {
      void counter.num;
    });
    const reaction = observe(runs);

    expect(() => {
      unobserve(reaction);
      unobserve(reaction);
      unobserve(reaction);
    }).not.toThrow();

    counter.num = 1;
    expect(runs).toHaveBeenCalledTimes(1);
  });

  test('重复 unobserve 时，对象型 scheduler 的 delete 每次都会被调用（钉当前行为：Set 等幂等 delete 下安全）', () => {
    const obj = observable({ count: 0 });
    const deletes: Array<unknown> = [];
    const scheduler = {
      add: () => {},
      delete: (fn: Reaction) => {
        deletes.push(fn);
      },
    } satisfies ReactionScheduler;

    const reaction = observe(() => void obj.count, { scheduler });
    unobserve(reaction);
    unobserve(reaction);
    unobserve(reaction);

    // 当前实现：unobserved 标记幂等，但 scheduler.delete 不在幂等守卫内，
    // 每次 unobserve 都调用一次。对 Set 型 scheduler（delete 天然幂等）无副作用。
    // 若未来改为只调用一次，属行为收紧而非破坏，改此断言 + changeset 注明即可。
    expect(deletes).toEqual([reaction, reaction, reaction]);
  });
});

describe('unobserve 与对象型 scheduler（如 Set）', () => {
  test('scheduler 实现了 delete 时，unobserve 移除尚未冲刷的排队条目：冲刷队列时该 reaction 不再执行', () => {
    const obj = observable({ count: 0 });
    const queue = new Set<Reaction>();
    let runs = 0;
    const reaction = observe(
      () => {
        void obj.count;
        runs++;
      },
      { scheduler: queue }
    );

    expect(runs).toBe(1); // 非 lazy 首跑同步执行
    obj.count = 1;
    expect(queue.size).toBe(1); // 变更进入批量队列，尚未执行

    unobserve(reaction);
    expect(queue.size).toBe(0); // 排队条目被 delete 移除

    // 模拟队列冲刷（如批处理 flusher）
    queue.forEach(queued => queued());
    expect(runs).toBe(1); // 移除后冲刷：零执行
  });

  test('scheduler 只实现 add（无 delete）时，unobserve 不抛错（触发路径只要求 add，见 README「observe / unobserve」）', () => {
    const obj = observable({ count: 0 });
    const queued: Array<Reaction> = [];
    const scheduler = {
      add: (fn: Reaction) => queued.push(fn),
    } satisfies ReactionScheduler;

    const reaction = observe(() => void obj.count, { scheduler });
    obj.count = 1;
    expect(queued).toEqual([reaction]);

    expect(() => unobserve(reaction)).not.toThrow();
  });

  test('add-only scheduler 里已排队的条目无法被 unobserve 撤回：冲刷时仍执行那一次（在途执行语义，README「在途执行」）', () => {
    const obj = observable({ count: 0 });
    const queued: Array<Reaction> = [];
    let runs = 0;
    const reaction = observe(
      () => {
        void obj.count;
        runs++;
      },
      {
        scheduler: {
          add: (fn: Reaction) => queued.push(fn),
        } satisfies ReactionScheduler,
      }
    );

    expect(runs).toBe(1);
    obj.count = 1;
    unobserve(reaction);
    expect(queued.length).toBe(1); // 无 delete 可调用，条目保留在用户侧容器里

    (queued.shift() as Reaction)(); // 冲刷
    expect(runs).toBe(2); // 已排队的那一次仍落地

    obj.count = 2;
    expect(runs).toBe(2); // 且该次执行不建立新依赖
  });
});

describe('unobserve 之后「在途执行」的语义（README 逐条承诺）', () => {
  test('手动调用仍执行：unobserve 后调用 reaction()，函数照常执行一次，但执行期间不建立任何新依赖', () => {
    const obj = observable({ count: 0 });
    let runs = 0;
    const reaction = observe(() => {
      void obj.count;
      runs++;
    });

    expect(runs).toBe(1);

    unobserve(reaction);
    reaction();
    expect(runs).toBe(2); // 手动调用仍执行

    obj.count = 1;
    expect(runs).toBe(2); // 执行期间未建立新依赖，后续变更零触发
  });

  test('函数型 scheduler 已排期的执行仍落地：unobserve 无法取消闭包里已持有的引用，到点执行一次且不重建依赖', () => {
    const obj = observable({ count: 0 });
    const pending: Array<Reaction> = [];
    let runs = 0;
    const reaction = observe(
      () => {
        void obj.count;
        runs++;
      },
      {
        scheduler: (r: Reaction) => pending.push(r),
      }
    );

    expect(runs).toBe(1);
    obj.count = 1;
    expect(pending.length).toBe(1); // 已排期（如 setTimeout 已设定）

    unobserve(reaction);
    expect(pending.length).toBe(1); // 函数型 scheduler 的已排队条目不被撤回

    (pending.shift() as Reaction)(); // 模拟到点冲刷
    expect(runs).toBe(2); // 已排期的这次执行仍发生

    obj.count = 2;
    expect(runs).toBe(2); // 且该次执行不建立新依赖
  });

  test('嵌套在另一个运行中的 reaction 里调用已 unobserve 的 reaction：其执行照常发生，但读取不归属外层、不误触发外层', () => {
    const obj = observable({ a: 0, b: 0 });
    let bRuns = 0;
    const inner = observe(() => {
      void obj.b;
      bRuns++;
    });
    unobserve(inner);

    let aRuns = 0;
    observe(() => {
      void obj.a;
      aRuns++;
      inner(); // 在外层运行中手动调用已 unobserve 的 inner
    });

    expect(aRuns).toBe(1);
    expect(bRuns).toBe(2); // inner 首跑 + 在外层内的这次调用，都执行

    obj.b = 1; // inner 读过 b，但 inner 已脱管，且其读取不得挂到外层
    expect(aRuns).toBe(1); // 外层从未读过 b，不得被误触发
    expect(bRuns).toBe(2);

    obj.a = 1;
    expect(aRuns).toBe(2); // 外层自己真正读过的依赖不受影响
  });

  test('在途的 unobserved reaction 执行期间写 observable：不干扰其他存活 reaction 的正常触发', () => {
    const obj = observable({ a: 0 });
    const writer = observe(() => void obj.a);
    unobserve(writer);

    let readerRuns = 0;
    observe(() => {
      void obj.a;
      readerRuns++;
      writer(); // writer 在途执行期间写 a
      obj.a = obj.a + 1;
    });
    expect(readerRuns).toBe(1);

    obj.a = 5;
    expect(readerRuns).toBe(2); // 存活 reaction 的触发不因栈上有 unobserved reaction 而被吞
  });

  test('reaction 自身运行中被 unobserve 后不再建立新依赖：执行后半段读的属性不会在后续写入时复活它（不复活承诺）', () => {
    const obj = observable({ a: 0, b: 0 });
    let runs = 0;
    const reaction = observe(
      () => {
        runs++;
        void obj.a; // unobserve 之前读：依赖已建立
        unobserve(reaction); // 在自身执行中脱管
        void obj.b; // unobserve 之后读：不得建立新依赖
      },
      { lazy: true }
    );
    reaction(); // 手动首跑

    expect(runs).toBe(1);
    obj.a = 1; // 既有连接已在 unobserve 中释放
    obj.b = 1; // 新读取未注册
    expect(runs).toBe(1); // 两条路径都不得复活它
  });
});

describe('unobserved 公开标记与在途 debugger 事件（README「已知限制」）', () => {
  test('unobserve 前后 reaction.unobserved 的取值：业务可在 debugger 回调里检查该公开标记', () => {
    const obj = observable({ count: 0 });
    const reaction = observe(() => void obj.count, { lazy: true });

    expect(reaction.unobserved).toBeUndefined(); // 未脱管时无标记

    unobserve(reaction);
    expect(reaction.unobserved).toBe(true); // 脱管后标记为 true
  });

  test('在途执行的那一次仍触发 debugger 事件：debugger 是观察工具，不因脱管而静默（README「已知限制」钉当前行为）', () => {
    const obj = observable({ count: 0 });
    let r!: Reaction;
    const flags: Array<boolean | undefined> = [];
    r = observe(() => void obj.count, {
      lazy: true,
      debugger: () => {
        // README 明示的过滤模式：在 debugger 回调里检查 reaction.unobserved
        flags.push(r.unobserved);
      },
    });

    r(); // 正常执行：debugger 收到事件，此时未脱管
    unobserve(r);
    r(); // 在途执行：debugger 仍收到事件，且 unobserved 已为 true

    expect(flags).toEqual([undefined, true]);
  });
});
