/**
 * reaction 重跑抛错后的依赖语义（#213）
 *
 * 已成功跑过的 reaction 重跑抛错时保持存活，并把依赖回滚为上次成功
 * 运行时的集合——抛错点之后的 key 不得漏通知。
 */
import { observable, observe, unobserve } from '../main';
import { getConnectionsCount } from '../internals/reaction-track';

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

    expect(() => {
      state.a = 2;
    }).toThrow('boom');
    expect(runs).toBe(2);

    state.a = 3;
    expect(runs).toBe(3);
    unobserve(reaction);
  });

  it('失败重跑保留上次成功运行的全部依赖，含抛错点之后的 key', () => {
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
    expect(() => {
      state.a = 2;
    }).toThrow('boom');
    expect(runs).toBe(2);

    throwing = false;
    state.b = 99;
    expect(runs).toBe(3);

    state.b = 50;
    expect(runs).toBe(4);
    unobserve(reaction);
  });

  it('错误条件未解除时，抛错点之后的 key 变更仍会重跑并再次抛错', () => {
    const state = observable({ a: 1, b: 1 });
    let runs = 0;

    const reaction = observe(() => {
      runs++;
      const a = state.a;
      if (a === 2) throw new Error('boom');
      void state.b;
    });
    expect(runs).toBe(1);

    expect(() => {
      state.a = 2;
    }).toThrow('boom');
    expect(runs).toBe(2);

    expect(() => {
      state.b = 99;
    }).toThrow('boom');
    expect(runs).toBe(3);
    unobserve(reaction);
  });

  it('失败重跑在抛错前读到的额外 key 不并入依赖，以上次成功集合为准', () => {
    const state = observable({ a: 1, b: 1, c: 1 });
    let runs = 0;
    let throwing = false;

    const reaction = observe(() => {
      runs++;
      void state.a;
      if (throwing) {
        void state.c;
        throw new Error('boom');
      }
      void state.b;
    });
    expect(runs).toBe(1);

    throwing = true;
    expect(() => {
      state.a = 2;
    }).toThrow('boom');
    expect(runs).toBe(2);

    throwing = false;
    state.c = 99;
    expect(runs).toBe(2);

    state.b = 50;
    expect(runs).toBe(3);
    unobserve(reaction);
  });

  it('成功重跑之后可以丢掉上次失败前恢复的依赖', () => {
    const state = observable({ a: 1, b: 1 });
    let runs = 0;
    let throwing = false;
    let readB = true;

    const reaction = observe(() => {
      runs++;
      void state.a;
      if (throwing) {
        throw new Error('boom');
      }
      if (readB) {
        void state.b;
      }
    });
    expect(runs).toBe(1);

    throwing = true;
    expect(() => {
      state.a = 2;
    }).toThrow('boom');
    expect(runs).toBe(2);

    throwing = false;
    readB = false;
    state.a = 3;
    expect(runs).toBe(3);

    state.b = 99;
    expect(runs).toBe(3);
    unobserve(reaction);
  });

  it('共享同一 key 的其它 reaction 在失败重跑回滚后仍能收到通知', () => {
    const rawObj = { a: 1, b: 1 };
    const state = observable(rawObj);
    let boomRuns = 0;
    let okRuns = 0;
    let throwing = false;

    const boom = observe(() => {
      boomRuns++;
      if (throwing && state.a === 2) {
        throw new Error('boom');
      }
      void state.a;
      void state.b;
    });
    const ok = observe(() => {
      okRuns++;
      void state.b;
    });
    expect(boomRuns).toBe(1);
    expect(okRuns).toBe(1);

    throwing = true;
    expect(() => {
      state.a = 2;
    }).toThrow('boom');
    expect(boomRuns).toBe(2);
    expect(okRuns).toBe(1);

    throwing = false;
    state.b = 99;
    expect(boomRuns).toBe(3);
    expect(okRuns).toBe(2);

    unobserve(ok);
    unobserve(boom);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  it('失败重跑中途 unobserve 不得因回滚而复活', () => {
    const rawObj = { a: 1, b: 1 };
    const state = observable(rawObj);
    let runs = 0;
    let throwing = false;
    let reaction!: ReturnType<typeof observe>;

    reaction = observe(() => {
      runs++;
      void state.a;
      if (throwing) {
        unobserve(reaction);
        throw new Error('boom');
      }
      void state.b;
    });
    expect(runs).toBe(1);

    throwing = true;
    expect(() => {
      state.a = 2;
    }).toThrow('boom');
    expect(runs).toBe(2);
    expect(reaction.unobserved).toBe(true);

    state.a = 3;
    state.b = 99;
    expect(runs).toBe(2);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });
});
