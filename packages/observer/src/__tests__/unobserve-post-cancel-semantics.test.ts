/**
 * unobserve 之后的执行语义 (文档化行为, 见 README "observe / unobserve" 章节)
 *
 * 语义: unobserve(reaction) 只做两件事 —— 标记 reaction.unobserved 并释放
 * (target, key) -> reaction 连接 (以及从对象型 scheduler 中移除)。
 * 它不会也不意图"撤回已经在途的执行":
 *   - unobserve 之后手动调用 reaction(), 函数仍会执行一次, 只是执行期间
 *     不再建立任何新依赖 (registerRunningReactionForOperation 对
 *     unobserved reaction 直接跳过注册);
 *   - 函数型 scheduler (如 setTimeout(reaction, 30)) 排期的执行不受
 *     unobserve 影响 —— unobserve 无法取消闭包里已经持有的引用, 到点后
 *     reaction 照常执行一次, 同样不建立新依赖。
 *
 * 因此: unobserve 之后数据变更不会再"排队触发"该 reaction, 但"已经排队/
 * 已经在途的那一次执行"仍会落地。下游若需要彻底取消, 应在 unobserve 的
 * 同时自行清除 scheduler 侧的排期 (如 clearTimeout / scheduler.delete)。
 */
import { observable, observe, unobserve } from '../main';

describe('unobserve 之后的执行语义', () => {
  test('unobserve 后手动调用 reaction 仍执行一次, 且执行期间不建立新依赖', () => {
    const obj = observable({ count: 0 });
    let runs = 0;
    const r = observe(() => {
      void obj.count;
      runs++;
    });

    expect(runs).toBe(1);

    unobserve(r);
    r();
    expect(runs).toBe(2); // 手动调用仍执行

    obj.count = 1;
    expect(runs).toBe(2); // 但执行期间没有建立新依赖, 后续变更不再触发
  });

  test('unobserve 前已被函数型 scheduler 排队的 reaction, 出队执行仍发生一次且不重建依赖', () => {
    const obj = observable({ count: 0 });
    const pending: Array<() => void> = [];
    let runs = 0;
    const r = observe(
      () => {
        void obj.count;
        runs++;
      },
      {
        scheduler: rr => pending.push(rr as unknown as () => void),
      }
    );

    expect(runs).toBe(1);
    obj.count = 1; // 进入 scheduler 队列
    expect(pending.length).toBe(1);

    unobserve(r);
    // unobserve 只对对象型 scheduler 调用 delete, 函数型 scheduler 的
    // 已排队条目仍保留在用户侧容器里
    expect(pending.length).toBe(1);

    (pending.shift() as () => void)(); // 模拟队列冲刷 (如 flusher 定时器到点)
    expect(runs).toBe(2); // 已排队的这次执行仍落地

    obj.count = 2;
    expect(runs).toBe(2); // 执行期间未建立新依赖
  });

  test('unobserve 后已由 setTimeout 排期的 reaction 到点仍执行一次 (30ms 实测场景)', done => {
    const obj = observable({ count: 0 });
    let runs = 0;
    const r = observe(
      () => {
        void obj.count;
        runs++;
      },
      {
        scheduler: rr => {
          setTimeout(rr as unknown as () => void, 30);
        },
      }
    );

    expect(runs).toBe(1);
    obj.count = 1; // scheduler: setTimeout(reaction, 30)
    unobserve(r); // 立刻 unobserve, 但 setTimeout 无法被 unobserve 撤回

    setTimeout(() => {
      expect(runs).toBe(2); // 30ms 后已排期的执行照常发生
      obj.count = 2;
      expect(runs).toBe(2); // 且该次执行未建立新依赖
      done();
    }, 60);
  });
});
