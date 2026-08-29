/**
 * 本文件是 batch() 的公开行为契约（issue #93）。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 覆盖范围：
 * - batch 内对同一 reaction 的多次写入合并为一次通知，且读到最终值
 * - 嵌套 batch 在最外层结束时才 flush
 * - batch 外的单次赋值仍立即同步执行
 * - 同批 reaction 错误隔离：某个抛错不阻断其余，首错在 batch 结束时 rethrow
 * - flush 前 unobserve 的 reaction 不再执行
 * - 函数型 / 对象型 scheduler 在一次 batch 内各只入队一次
 */
import { observable, observe, unobserve, batch, resetGlobalConfig } from '../../main';

afterEach(() => {
  resetGlobalConfig();
});

describe('batch() 公开契约', () => {
  test('batch 内多次赋值同一 reaction 只跑一次，且读到最终值', () => {
    const state = observable({ a: 1, b: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(state.a + state.b);
    });
    expect(seen).toEqual([2]);

    batch(() => {
      state.a = 10;
      state.b = 20;
    });
    expect(seen).toEqual([2, 30]);
  });

  test('嵌套 batch 在最外层结束时才 flush', () => {
    const state = observable({ n: 0 });
    const seen: number[] = [];
    observe(() => {
      seen.push(state.n);
    });
    expect(seen).toEqual([0]);

    batch(() => {
      state.n = 1;
      batch(() => {
        state.n = 2;
      });
      expect(seen).toEqual([0]);
      state.n = 3;
    });
    expect(seen).toEqual([0, 3]);
  });

  test('batch 外的单次赋值仍立即同步执行', () => {
    const state = observable({ n: 0 });
    const seen: number[] = [];
    observe(() => {
      seen.push(state.n);
    });
    state.n = 1;
    expect(seen).toEqual([0, 1]);
    state.n = 2;
    expect(seen).toEqual([0, 1, 2]);
  });

  test('batch 返回回调的返回值', () => {
    const state = observable({ n: 0 });
    const result = batch(() => {
      state.n = 1;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(state.n).toBe(1);
  });

  test('同批某个 reaction 抛错不阻断其余，首错在 batch 结束时 rethrow', () => {
    const state = observable({ a: 1, b: 1 });
    const log: string[] = [];
    let phase = false;
    observe(() => {
      void state.a;
      log.push('A');
      if (phase) {
        throw new Error('a-boom');
      }
    });
    observe(() => {
      void state.b;
      log.push('B');
    });
    log.length = 0;
    phase = true;
    expect(() => {
      batch(() => {
        state.a = 2;
        state.b = 2;
      });
    }).toThrow('a-boom');
    expect(log).toEqual(['A', 'B']);
    expect(state.a).toBe(2);
    expect(state.b).toBe(2);
  });

  test('flush 前 unobserve 的 reaction 不再执行', () => {
    const state = observable({ n: 0 });
    let runs = 0;
    const reaction = observe(() => {
      void state.n;
      runs++;
    });
    expect(runs).toBe(1);
    batch(() => {
      state.n = 1;
      unobserve(reaction);
    });
    expect(runs).toBe(1);
    expect(state.n).toBe(1);
  });

  test('函数型 scheduler 在一次 batch 内只被调用一次', () => {
    const state = observable({ a: 1, b: 1 });
    const queued: Array<() => void> = [];
    observe(
      () => {
        void (state.a + state.b);
      },
      {
        scheduler: r => {
          queued.push(r as unknown as () => void);
        },
      }
    );
    expect(queued.length).toBe(0);
    batch(() => {
      state.a = 2;
      state.b = 3;
    });
    expect(queued.length).toBe(1);
  });

  test('对象型 scheduler 在一次 batch 内只 add 一次', () => {
    const state = observable({ a: 1, b: 1 });
    const queue = new Set<unknown>();
    observe(
      () => {
        void (state.a + state.b);
      },
      { scheduler: queue }
    );
    expect(queue.size).toBe(0);
    batch(() => {
      state.a = 2;
      state.b = 3;
    });
    expect(queue.size).toBe(1);
  });
});
