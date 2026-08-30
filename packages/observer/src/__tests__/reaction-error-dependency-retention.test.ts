/**
 * reaction 重跑抛错后的依赖语义（#213）
 *
 * reaction 保持存活（不被注销），但失败的那次重跑只保留抛错点之前
 * 读取的依赖；抛错点之后的依赖要等下一次成功重跑才恢复。钉住该
 * 语义（README「已知限制」与实现一致），防止无声漂移。
 */
import { observable, observe, unobserve } from '../main';

describe('reaction 重跑抛错的依赖语义（#213）', () => {
  it('重跑抛错后 reaction 保持存活，抛错点之前的依赖仍触发', () => {
    const state = observable({ a: 1 });
    let runs = 0;

    const reaction = observe(() => {
      runs++;
      if (state.a === 2) {
        throw new Error('boom');
      }
    });
    expect(runs).toBe(1);

    try {
      state.a = 2;
    } catch {
      // 重跑抛错被上抛
    }
    expect(runs).toBe(2); // 存活：依赖保留

    state.a = 3;
    expect(runs).toBe(3);
    unobserve(reaction);
  });

  it('抛错点之后的依赖在失败重跑中丢失，成功重跑后恢复', () => {
    const state = observable({ a: 1, b: 1 });
    let runs = 0;
    let throwing = false;

    const reaction = observe(() => {
      runs++;
      if (throwing && state.a === 2) {
        throw new Error('boom');
      }
      void state.a;
      void state.b;
    });
    expect(runs).toBe(1);

    throwing = true;
    try {
      state.a = 2;
    } catch {
      // ignore
    }
    expect(runs).toBe(2);

    // b 在抛错点之后：失败重跑没有读到它，此刻依赖丢失（已知限制）
    state.b = 99;
    expect(runs).toBe(2);

    // 成功重跑后依赖恢复完整
    throwing = false;
    state.a = 3;
    expect(runs).toBe(3);

    state.b = 50;
    expect(runs).toBe(4);
    unobserve(reaction);
  });
});
