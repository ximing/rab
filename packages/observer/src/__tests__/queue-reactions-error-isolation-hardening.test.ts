import { observe, observable, unobserve } from '../main';

/*
 * GG4 hardening (adversarial review): pin behaviors of the error-isolation fix
 * that the original test file did not cover:
 *  1. nested batches — an error thrown by an inner batch (triggered by a
 *     reaction's own mutation) must not kill the outer batch's siblings, and
 *     must surface exactly once at the top-level mutation call site.
 *  2. falsy thrown values (undefined / 0 / "") must be rethrown as-is
 *     (guards against truthiness-based error bookkeeping).
 */
describe('queueReactionsForOperation error isolation hardening', () => {
  test('an inner-batch error (reaction mutates another key whose batch throws) does not kill outer siblings and rethrows once at the top call site', () => {
    const state = observable({ a: 1, z: 1 });
    const log: string[] = [];
    let phase = false;

    observe(() => {
      state.a; // eslint-disable-line no-unused-expressions
      log.push('A');
      if (phase) {
        state.z = 99; // triggers inner batch [X(throws), Y]
      }
    });
    observe(() => {
      state.z; // eslint-disable-line no-unused-expressions
      log.push('X');
      if (phase) {
        throw new Error('inner-boom');
      }
    });
    observe(() => {
      state.z; // eslint-disable-line no-unused-expressions
      log.push('Y');
    });
    observe(() => {
      state.a; // eslint-disable-line no-unused-expressions
      log.push('B');
    });

    log.length = 0;
    phase = true;
    expect(() => {
      state.a = 2;
    }).toThrow('inner-boom');

    // inner sibling Y ran despite X throwing; outer sibling B ran despite
    // the error propagating through A
    expect(log).toEqual(['A', 'X', 'Y', 'B']);
    // the mutations themselves landed
    expect(state.a).toBe(2);
    expect(state.z).toBe(99);
  });

  test.each([undefined, 0, ''])(
    'a falsy thrown value (%p) is rethrown as-is and siblings still run',
    falsy => {
      const state = observable({ x: 1 });
      const log: string[] = [];
      let phase = false;

      observe(() => {
        state.x; // eslint-disable-line no-unused-expressions
        log.push('first');
        if (phase) {
          throw falsy;
        }
      });
      observe(() => {
        state.x; // eslint-disable-line no-unused-expressions
        log.push('second');
      });

      log.length = 0;
      phase = true;
      let caught: { value: unknown; caught: boolean } = {
        value: undefined,
        caught: false,
      };
      try {
        state.x = 2;
      } catch (error) {
        caught = { value: error, caught: true };
      }
      expect(caught.caught).toBe(true);
      expect(caught.value).toBe(falsy);
      expect(log).toEqual(['first', 'second']);
      expect(state.x).toBe(2);
    }
  );

  test('a mutation performed inside a running reaction whose inner batch throws: outer top-level call site sees the error, inner siblings run', () => {
    const state = observable({ k1: 1, k2: 1 });
    const log: string[] = [];
    let phase = false;

    observe(() => {
      state.k1; // eslint-disable-line no-unused-expressions
      log.push('R1');
      if (phase) {
        state.k2 = 2; // inner batch: [R2(throws), R3]
        log.push('R1-after'); // unreachable: inner error propagates through R1
      }
    });
    observe(() => {
      state.k2; // eslint-disable-line no-unused-expressions
      log.push('R2');
      if (phase) {
        throw new Error('r2-boom');
      }
    });
    observe(() => {
      state.k2; // eslint-disable-line no-unused-expressions
      log.push('R3');
    });

    log.length = 0;
    phase = true;
    expect(() => {
      state.k1 = 2;
    }).toThrow('r2-boom');
    expect(log).toEqual(['R1', 'R2', 'R3']);
    expect(state.k1).toBe(2);
    expect(state.k2).toBe(2);
  });

  test('array push: a throwing index reaction does not skip the length reaction in the combined batch', () => {
    const arr = observable([1, 2, 3]);
    const log: string[] = [];
    let phase = false;

    observe(() => {
      void arr[3];
      log.push('idx3');
      if (phase) {
        throw new Error('idx-boom');
      }
    });
    observe(() => {
      void arr.length;
      log.push('len');
    });

    log.length = 0;
    phase = true;
    expect(() => {
      arr.push(4);
    }).toThrow('idx-boom');
    // the length observer must still have run, and the push itself landed
    expect(log).toEqual(['idx3', 'len']);
    expect(arr.length).toBe(4);
    expect(arr[3]).toBe(4);
  });

  test('add: a throwing key reaction does not skip the ITERATION_KEY reaction', () => {
    const state = observable({} as Record<string, number>);
    const log: string[] = [];
    let phase = false;

    observe(() => {
      void state.b;
      log.push('keyB');
      if (phase) {
        throw new Error('keyB-boom');
      }
    });
    observe(() => {
      void Object.keys(state);
      log.push('iter');
    });

    log.length = 0;
    phase = true;
    expect(() => {
      state.b = 2;
    }).toThrow('keyB-boom');
    expect(log).toEqual(['keyB', 'iter']);
  });

  test('the exact same Error object reaches the mutation call site (identity preserved across rethrow)', () => {
    const state = observable({ x: 1 });
    const sentinel = new Error('sentinel');
    let phase = false;
    observe(() => {
      void state.x;
      if (phase) {
        throw sentinel;
      }
    });
    phase = true;
    let caught: unknown;
    try {
      state.x = 2;
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(sentinel);
  });

  test('a reaction that throws mid-run keeps its already-registered dependencies and re-triggers on later mutations', () => {
    const state = observable({ x: 1 });
    let runs = 0;
    let throwOnRun = -1;
    const r = observe(() => {
      const v = state.x; // dependency registered before the throw
      runs += 1;
      if (runs === throwOnRun) {
        throw new Error('mid-boom');
      }
      void v;
    });

    throwOnRun = 2;
    expect(() => {
      state.x = 2;
    }).toThrow('mid-boom');
    expect(runs).toBe(2);

    // the same reaction must fire again for the next mutation (deps survived the throw)
    throwOnRun = -1;
    state.x = 3;
    expect(runs).toBe(3);

    unobserve(r);
    state.x = 4;
    expect(runs).toBe(3);
  });
});
