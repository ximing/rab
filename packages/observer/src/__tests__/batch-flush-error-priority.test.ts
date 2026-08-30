/**
 * batch 错误优先级测试
 *
 * flush 抛出的 reaction 错误不得覆盖 batch 回调自身的在途异常（#212）。
 */
import { observable, observe, batch } from '../main';

describe('batch 错误优先级（#212）', () => {
  it('回调抛错 + flush 抛错：原始异常优先，flush 错误不吞掉它', () => {
    const state = observable({ a: 1 });
    observe(() => {
      if (state.a === 2) {
        throw new Error('reaction-error');
      }
    });

    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        throw new Error('original');
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('original');
  });

  it('只有回调抛错（无 flush 错误）：异常正常传播', () => {
    const state = observable({ a: 1 });
    observe(() => {
      void state.a;
    });

    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        throw new Error('only-callback');
      });
    } catch (e) {
      caught = e;
    }

    expect((caught as Error).message).toBe('only-callback');
  });

  it('只有 flush 抛错（回调正常）：reaction 错误正常传播', () => {
    const state = observable({ a: 1 });
    observe(() => {
      if (state.a === 2) {
        throw new Error('only-reaction');
      }
    });

    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
      });
    } catch (e) {
      caught = e;
    }

    expect((caught as Error).message).toBe('only-reaction');
  });

  it('嵌套 batch：最内层回调的原始异常在最外层保留', () => {
    const state = observable({ a: 1 });
    observe(() => {
      if (state.a === 2) {
        throw new Error('nested-reaction');
      }
    });

    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        batch(() => {
          throw new Error('inner-original');
        });
      });
    } catch (e) {
      caught = e;
    }

    expect((caught as Error).message).toBe('inner-original');
  });
});
