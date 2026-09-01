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

  it('回调抛冻结的 Error：cause 赋值失败不得用 TypeError 替换原始异常', () => {
    const state = observable({ a: 1 });
    observe(() => {
      if (state.a === 2) {
        throw new Error('reaction-error');
      }
    });

    // strict mode（本包产物为 ESM）下给冻结对象加属性会抛 TypeError，
    // 修复前它从 finally 抛出并替换在途异常 —— 调用方既丢了自己的
    // 业务错误，也丢了 reaction 的堆栈
    const frozenError = Object.freeze(new Error('frozen-original'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        throw frozenError;
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(frozenError);
    // flush 错误无处附加时至少留有日志线索，不静默丢弃
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('batch'),
      expect.objectContaining({ message: 'reaction-error' })
    );
    warnSpy.mockRestore();
  });

  it('回调抛非 Error 值：flush 错误不静默丢弃（console.warn 留线索）', () => {
    const state = observable({ a: 1 });
    observe(() => {
      if (state.a === 2) {
        throw new Error('reaction-error');
      }
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string-error';
      });
    } catch (e) {
      caught = e;
    }

    // 回调的原始异常（即使是非 Error）仍然优先抛出
    expect(caught).toBe('string-error');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('batch'),
      expect.objectContaining({ message: 'reaction-error' })
    );
    warnSpy.mockRestore();
  });

  it('回调的 Error 已有 cause：flush 错误不覆盖既有 cause，走 warn', () => {
    const state = observable({ a: 1 });
    observe(() => {
      if (state.a === 2) {
        throw new Error('reaction-error');
      }
    });

    const original = new Error('with-cause');
    (original as Error & { cause?: unknown }).cause = new Error('existing-cause');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        throw original;
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(original);
    expect((original as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
    expect(((original as Error & { cause?: Error }).cause as Error).message).toBe('existing-cause');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('可正常附加 cause 时保持 #212 行为且不 warn', () => {
    const state = observable({ a: 1 });
    observe(() => {
      if (state.a === 2) {
        throw new Error('reaction-error');
      }
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const original = new Error('original');
    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        throw original;
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(original);
    expect(((original as Error & { cause?: Error }).cause as Error).message).toBe('reaction-error');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
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

describe('batch 错误边界（review 回归）', () => {
  it('回调与 reaction 抛出同一 Error 实例：不产生自引用 cause', () => {
    const state = observable({ a: 1 });
    const shared = new Error('shared');
    observe(() => {
      if (state.a === 2) {
        throw shared;
      }
    });

    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        throw shared;
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(shared);
    // 自引用 cause (E.cause = E) 会让 cause 链遍历死循环，必须不发生
    expect((shared as Error & { cause?: unknown }).cause).toBeUndefined();
  });

  it('console.warn 自身抛错时也不替换回调的在途异常', () => {
    const state = observable({ a: 1 });
    observe(() => {
      if (state.a === 2) {
        throw new Error('reaction-error');
      }
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
      throw new Error('warn-exploded');
    });
    // 冻结的错误对象走 cause-as-error 失败 -> warn 路径
    const frozen = Object.freeze(new Error('original-frozen'));
    let caught: unknown;
    try {
      batch(() => {
        state.a = 2;
        throw frozen;
      });
    } catch (e) {
      caught = e;
    } finally {
      warnSpy.mockRestore();
    }

    expect(caught).toBe(frozen);
  });
});
