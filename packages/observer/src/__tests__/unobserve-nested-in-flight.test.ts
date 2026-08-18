/**
 * 嵌套场景下 unobserve 的"在途执行不建立任何新依赖"保证
 * (README "unobserve 之后'在途执行'的语义（重要）" 一节)
 *
 * README 保证: unobserve 后手动调用仍执行, 只是"执行期间不再建立任何新依赖"。
 * 该保证此前只在顶层场景 (reactionStack 为空) 成立: runAsReaction 对 unobserved
 * reaction 裸执行 (不压栈), 当它被另一个**正在运行的** reaction 手动调用时,
 * 其读取经由 registerRunningReactionForOperation 注册到外层栈顶 reaction 上,
 * 导致存活的外层 reaction 被它从未读过的 key 误触发。
 *
 * 修正后的语义: unobserved reaction 的在途执行压入 reactionStack (自身即栈顶),
 * registerRunningReactionForOperation 对 unobserved 栈顶跳过注册
 * (见 reaction-runner.ts / 0cf771a), 嵌套与顶层行为一致。
 */
import { observable, observe, unobserve } from "../main";

describe("unobserve 后在途执行的依赖归属 (嵌套场景)", () => {
  test("在运行中的 reaction 内手动调用已 unobserve 的 reaction, 其读取不落到外层", () => {
    const obj = observable({ a: 0, b: 0 });
    let bRuns = 0;
    const B = observe(() => {
      void obj.b;
      bRuns++;
    });
    unobserve(B);

    let aRuns = 0;
    const A = observe(() => {
      void obj.a;
      aRuns++;
      B(); // 在 A 运行中手动调用已 unobserve 的 B
    });

    expect(aRuns).toBe(1);
    expect(bRuns).toBe(2); // B 首跑 + 在 A 内的手动调用, 都执行

    obj.b = 1; // B 读过 b, 但 B 已 unobserve 且读取不得归属 A
    expect(aRuns).toBe(1); // A 从未读过 b, 不得被误触发
    expect(bRuns).toBe(2); // B 不再被触发
  });

  test("嵌套手动调用后, 外层 reaction 对自己真正读过的 key 仍正常触发", () => {
    const obj = observable({ a: 0, b: 0 });
    const B = observe(() => {
      void obj.b;
    });
    unobserve(B);

    let aRuns = 0;
    observe(() => {
      void obj.a;
      aRuns++;
      B();
    });
    expect(aRuns).toBe(1);

    obj.a = 1;
    expect(aRuns).toBe(2); // A 自己的依赖不受影响
    expect(obj.b).toBe(0);
  });

  test("已 unobserve 的 reaction 在途执行期间写 observable, 通知流程不受栈上 unobserved reaction 干扰", () => {
    const obj = observable({ a: 0 });
    const B = observe(() => {
      void obj.a;
    });
    unobserve(B);

    let aRuns = 0;
    observe(() => {
      void obj.a;
      aRuns++;
      B(); // B 在途执行期间写 a —— 自通知不得因为 B 在栈上而误吞 A 的触发
      obj.a = obj.a; // eslint-disable-line no-self-assign
    });
    expect(aRuns).toBe(1);

    obj.a = 5;
    expect(aRuns).toBe(2);
  });

  test("unobserved reaction 手动调用抛错时, 栈正确回退 (外层 reaction 不被卡在栈中)", () => {
    const obj = observable({ a: 0, b: 0 });
    // lazy: B 的函数体只在被 A 手动调用时执行 (其唯一一次执行就是抛错那次)
    const B = observe(
      () => {
        void obj.b;
        throw new Error("boom");
      },
      { lazy: true }
    );
    unobserve(B);

    let aRuns = 0;
    const A = observe(() => {
      void obj.a;
      aRuns++;
      try {
        B();
      } catch {
        /* swallow */
      }
    });
    expect(aRuns).toBe(1);

    // 若 B 抛错后栈未回退, A 残留在栈上, obj.a = 1 的通知会被
    // reactionStack.has(A) 检查吞掉, A 不再触发
    obj.a = 1;
    expect(aRuns).toBe(2);
  });
});
