/**
 * untracked() —— 一等「不追踪」原语（MobX untracked 语义）
 *
 * 背景：@rabjs/react 的 useReaction 双函数形式（#249）需要 effect 内的
 * 读取不注册为依赖，此前靠「已 unobserve 的 reaction 作屏蔽层」实现 ——
 * 依赖 runAsReaction 对 unobserved reaction 仍压栈、注册逻辑跳过的
 * 未文档化内部行为，observer 侧任何相关重构都会静默破坏该语义且
 * observer 包里没有任何测试能拦截。提升为核心原语并钉住契约。
 */
import { batch, observable, observe, unobserve, untracked } from '../main';

describe('untracked', () => {
  it('untracked 内的读取不注册为依赖', () => {
    const state = observable({ a: 0, b: 0 });
    let runs = 0;
    const reaction = observe(() => {
      runs++;
      void state.a; // 追踪
      untracked(() => {
        void state.b; // 不追踪
      });
    });

    state.b = 1;
    expect(runs).toBe(1);

    state.a = 1;
    expect(runs).toBe(2);
    unobserve(reaction);
  });

  it('返回回调的返回值', () => {
    expect(untracked(() => 42)).toBe(42);
    const state = observable({ v: 'x' });
    expect(untracked(() => state.v)).toBe('x');
  });

  it('顶层（无 reaction 在运行）调用安全且不留任何注册', () => {
    const state = observable({ a: 0 });
    let runs = 0;
    const reaction = observe(() => {
      runs++;
      void state.a;
    });
    expect(untracked(() => state.a)).toBe(0);
    expect(runs).toBe(1);
    unobserve(reaction);
  });

  it('回调抛错后追踪状态正确恢复（异常安全）', () => {
    const state = observable({ a: 0, b: 0 });
    let runs = 0;
    const reaction = observe(() => {
      runs++;
      void state.a;
      expect(() =>
        untracked(() => {
          void state.b;
          throw new Error('boom');
        })
      ).toThrow('boom');
      void state.a; // 抛错后的读取仍应正常追踪
    });

    // b 未被追踪
    state.b = 1;
    expect(runs).toBe(1);
    // a 的追踪未被异常破坏
    state.a = 1;
    expect(runs).toBe(2);
    unobserve(reaction);
  });

  it('嵌套 untracked 与嵌套 reaction 下语义保持', () => {
    const state = observable({ a: 0, b: 0, c: 0 });
    let runs = 0;
    const reaction = observe(() => {
      runs++;
      void state.a;
      untracked(() => {
        void state.b;
        untracked(() => {
          void state.c;
        });
      });
    });

    state.b = 1;
    state.c = 1;
    expect(runs).toBe(1);
    state.a = 1;
    expect(runs).toBe(2);
    unobserve(reaction);
  });

  it('untracked 内的读取不进入外层 reaction 的 debugger', () => {
    const state = observable({ a: 0, b: 0 });
    const seen: string[] = [];
    const debuggerFn = (op: { key: PropertyKey }) => {
      seen.push(String(op.key));
    };
    const reaction = observe(
      () => {
        void state.a;
        untracked(() => {
          void state.b;
        });
      },
      { debugger: debuggerFn }
    );

    expect(seen).toEqual(['a']);
    unobserve(reaction);
  });

  it('batch 内语义不变：untracked 读取仍不注册', () => {
    const state = observable({ a: 0, b: 0 });
    let runs = 0;
    const reaction = observe(() => {
      runs++;
      void state.a;
      untracked(() => {
        void state.b;
      });
    });

    batch(() => {
      state.b = 1;
    });
    expect(runs).toBe(1);
    batch(() => {
      state.a = 1;
    });
    expect(runs).toBe(2);
    unobserve(reaction);
  });
});
