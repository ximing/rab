/**
 * 对象型 scheduler 的最小契约 (触发路径只要求 add, 见 reaction-runner.ts)
 *
 * queueReactionsForOperation 对对象型 scheduler 只调用 scheduler.add(reaction)
 * (reaction-runner.ts), 因此一个只实现了 add 的调度对象在 observe/触发阶段
 * 完全可用。unobserve 过去对该形状的对象无条件调用 scheduler.delete(reaction)
 * 并抛 TypeError —— 触发路径与取消路径的契约不对齐。
 *
 * 契约定型:
 *   - add: 必需 (触发路径调用);
 *   - delete: 可选 —— 实现了则在 unobserve 时被调用 (如 Set), 未实现则跳过。
 */
import { observable, observe, unobserve } from "../main";
import type { Reaction, ReactionScheduler } from "../main";

describe("只有 add 的对象型 scheduler", () => {
  test("observe/触发/unobserve 全程不抛错 (触发路径只要求 add)", () => {
    const obj = observable({ count: 0 });
    const queued: Array<() => void> = [];
    let runs = 0;

    const r = observe(
      () => {
        void obj.count;
        runs++;
      },
      {
        // 只按 add 半边契约写的调度对象 (如某些自定义批量队列)
        scheduler: {
          add(fn: Reaction) {
            queued.push(fn as unknown as () => void);
          },
        } satisfies ReactionScheduler,
      }
    );

    expect(runs).toBe(1); // 非 lazy 首跑走默认同步路径
    obj.count = 1;
    expect(queued.length).toBe(1); // 触发走 add, 不需要 delete

    expect(() => {
      unobserve(r); // 不得因缺少 delete 而抛 TypeError
    }).not.toThrow();
    expect(runs).toBe(1);
  });

  test("实现了 delete 的对象型 scheduler 在 unobserve 时仍被调用", () => {
    const obj = observable({ count: 0 });
    const deleted: Array<unknown> = [];

    const r = observe(
      () => {
        void obj.count;
      },
      {
        scheduler: {
          add(_fn: Reaction) {
            /* no-op */
          },
          delete(fn: Reaction) {
            deleted.push(fn);
            return true;
          },
        } satisfies ReactionScheduler,
      }
    );

    unobserve(r);
    expect(deleted).toEqual([r]);
  });
});
