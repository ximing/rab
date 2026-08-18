import { observe, observable } from "../main";
import type { Reaction } from "../internals/types";

describe("queueReactionsForOperation error isolation", () => {
  test("a throwing reaction must not prevent sibling reactions on the same key from running, and the error is rethrown at the mutation site", () => {
    const state = observable({ x: 1 });
    const order: string[] = [];
    let startThrowing = false;

    observe(() => {
      state.x; // eslint-disable-line no-unused-expressions
      order.push("first");
      if (startThrowing) {
        throw new Error("boom");
      }
    });
    let dummy: number | undefined;
    observe(() => {
      dummy = state.x;
      order.push("second");
    });

    expect(order).toEqual(["first", "second"]);
    expect(dummy!).toBe(1);

    startThrowing = true;
    expect(() => {
      state.x = 2;
    }).toThrow("boom");

    // the sibling reaction must still have run despite the first one throwing
    expect(order).toEqual(["first", "second", "first", "second"]);
    expect(dummy!).toBe(2);
  });

  test("rethrows the first error of the batch even if later reactions also fail", () => {
    const state = observable({ x: 1 });
    const calls: number[] = [];
    let startThrowing = false;

    observe(() => {
      state.x;
      calls.push(1);
      if (startThrowing) {
        throw new Error("first-error");
      }
    });
    observe(() => {
      state.x;
      calls.push(2);
      if (startThrowing) {
        throw new Error("second-error");
      }
    });

    expect(calls).toEqual([1, 2]);

    startThrowing = true;
    expect(() => {
      state.x = 2;
    }).toThrow("first-error");
    // both reactions ran before the rethrow
    expect(calls).toEqual([1, 2, 1, 2]);
  });

  test("a throwing function scheduler is isolated like a reaction error", () => {
    const state = observable({ x: 1 });
    const order: string[] = [];
    let startThrowing = false;

    observe(
      () => {
        state.x; // eslint-disable-line no-unused-expressions
        order.push("scheduled-fn");
      },
      {
        scheduler: (reaction) => {
          order.push("scheduler");
          if (startThrowing) {
            throw new Error("scheduler-boom");
          }
          reaction();
        },
      }
    );
    observe(() => {
      order.push("sync");
      state.x; // eslint-disable-line no-unused-expressions
    });

    // the initial observe() run bypasses the scheduler; it only runs on trigger
    expect(order).toEqual(["scheduled-fn", "sync"]);

    startThrowing = true;
    expect(() => {
      state.x = 2;
    }).toThrow("scheduler-boom");

    // scheduler was invoked and threw, then the sync sibling still ran
    expect(order).toEqual(["scheduled-fn", "sync", "scheduler", "sync"]);
  });

  test("a throwing object scheduler add() is isolated like a reaction error", () => {
    const state = observable({ x: 1 });
    const order: string[] = [];
    let startThrowing = false;

    observe(
      () => {
        state.x; // eslint-disable-line no-unused-expressions
        order.push("collected");
      },
      {
        scheduler: {
          add(reaction: Reaction) {
            order.push("add");
            if (startThrowing) {
              throw new Error("add-boom");
            }
            reaction();
          },
          delete() {
            // no-op: satisfies ReactionScheduler
          },
        },
      }
    );
    observe(() => {
      order.push("sync");
      state.x; // eslint-disable-line no-unused-expressions
    });

    // the initial observe() run bypasses the scheduler; it only runs on trigger
    expect(order).toEqual(["collected", "sync"]);

    startThrowing = true;
    expect(() => {
      state.x = 2;
    }).toThrow("add-boom");

    expect(order).toEqual(["collected", "sync", "add", "sync"]);
  });

  test("no-error path behaves exactly as before: reactions run synchronously in order", () => {
    const state = observable({ x: 1 });
    const order: string[] = [];

    observe(() => {
      state.x;
      order.push("a");
    });
    observe(() => {
      state.x;
      order.push("b");
    });

    expect(order).toEqual(["a", "b"]);
    state.x = 2;
    expect(order).toEqual(["a", "b", "a", "b"]);
    expect(state.x).toBe(2);
  });
});
