/**
 * useReaction Hook 测试
 *
 * useReaction 用于在组件中创建副作用响应
 * 当 observable 属性变化时，副作用会自动执行（立即执行模式）
 */

import { render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { observable, useLocalObservable, useReaction, observer } from '@rabjs/react';

describe('useReaction Hook', () => {
  it('默认（不传 immediate）挂载时执行一次并在依赖变化时重跑（#195）', async () => {
    const effects: string[] = [];
    const state = observable({ count: 0 });

    const Component = observer(() => {
      useReaction(() => {
        effects.push(`count: ${state.count}`);
      });
      return <div>Count: {state.count}</div>;
    });

    render(<Component />);

    await waitFor(() => {
      expect(effects).toContain('count: 0');
    });

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects).toContain('count: 1');
    });
  });

  // #200：单函数形式里副作用与依赖收集是同一个函数，immediate: false 无法
  // 跳过挂载首跑（否则后续变更永不触发）。钉住诚实的契约，并指向双函数形式。
  it('immediate: false 挂载时仍会执行一次以收集依赖，变更后再执行（#200 契约）', async () => {
    const effects: string[] = [];
    const state = observable({ count: 0 });

    const Component = observer(() => {
      useReaction(
        () => {
          effects.push(`count: ${state.count}`);
        },
        { immediate: false }
      );
      return <div>Count: {state.count}</div>;
    });

    render(<Component />);

    await waitFor(() => {
      expect(effects).toEqual(['count: 0']);
    });

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects).toEqual(['count: 0', 'count: 1']);
    });
  });

  it('应该支持 immediate: true 立即执行一次', async () => {
    const effects: string[] = [];
    const state = observable({ count: 0 });

    const Component = observer(() => {
      useReaction(
        () => {
          effects.push(`count: ${state.count}`);
        },
        { immediate: true }
      );

      return <div>Count: {state.count}</div>;
    });

    render(<Component />);

    // immediate: true 应该在组件 mounted 时立即执行一次
    await waitFor(() => {
      expect(effects).toContain('count: 0');
    });

    // 再改变状态，应该再执行一次
    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects).toContain('count: 1');
    });
  });

  it('应该支持多个状态变化', async () => {
    const effects: string[] = [];
    const state = observable({ count: 0 });

    const Component = observer(() => {
      useReaction(
        () => {
          effects.push(`count: ${state.count}`);
        },
        { immediate: true }
      );

      return <div>Count: {state.count}</div>;
    });

    render(<Component />);

    await waitFor(() => {
      expect(effects).toContain('count: 0');
    });

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects).toContain('count: 1');
    });

    act(() => {
      state.count = 2;
    });
    await waitFor(() => {
      expect(effects).toContain('count: 2');
    });
  });

  it('应该在同一个组件中支持多个 useReaction', async () => {
    const effects1: string[] = [];
    const effects2: string[] = [];
    const state = observable({ count: 0, name: 'John' });

    const Component = observer(() => {
      useReaction(
        () => {
          effects1.push(`count: ${state.count}`);
        },
        { immediate: true }
      );

      useReaction(
        () => {
          effects2.push(`name: ${state.name}`);
        },
        { immediate: true }
      );

      return (
        <div>
          <p>Count: {state.count}</p>
          <p>Name: {state.name}</p>
        </div>
      );
    });

    render(<Component />);

    await waitFor(() => {
      expect(effects1).toContain('count: 0');
      expect(effects2).toContain('name: John');
    });

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects1).toContain('count: 1');
    });

    act(() => {
      state.name = 'Jane';
    });
    await waitFor(() => {
      expect(effects2).toContain('name: Jane');
    });

    // count 变化不应该触发 effects2（只包含 name 的变化）
    expect(effects2.filter(e => e.includes('count:'))).toHaveLength(0);
  });

  it('应该支持 useLocalObservable', async () => {
    const effects: string[] = [];

    const Component = observer(() => {
      const state = useLocalObservable(() => ({ count: 0 }));

      useReaction(
        () => {
          effects.push(`count: ${state.count}`);
        },
        { immediate: true }
      );

      return (
        <div>
          <p>Count: {state.count}</p>
          <button onClick={() => state.count++}>Increment</button>
        </div>
      );
    });

    const { getByText } = render(<Component />);

    expect(getByText('Count: 0')).toBeInTheDocument();

    await waitFor(() => {
      expect(effects).toContain('count: 0');
    });

    // 点击按钮改变状态
    act(() => {
      getByText('Increment').click();
    });

    await waitFor(() => {
      expect(effects).toContain('count: 1');
    });

    act(() => {
      getByText('Increment').click();
    });

    await waitFor(() => {
      expect(effects).toContain('count: 2');
    });
  });

  it('应该自动清理 reaction 当组件卸载时', async () => {
    const effects: string[] = [];
    const state = observable({ count: 0 });

    const Component = observer(() => {
      useReaction(
        () => {
          effects.push(`count: ${state.count}`);
        },
        { immediate: true }
      );

      return <div>Count: {state.count}</div>;
    });

    const { unmount } = render(<Component />);

    // 初始化执行一次
    await waitFor(() => {
      expect(effects).toContain('count: 0');
    });

    // 改变状态触发副作用
    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects).toContain('count: 1');
    });

    const effectsBeforeUnmount = effects.length;

    // 卸载组件
    unmount();

    // 再改变状态，不应该触发副作用
    act(() => {
      state.count = 2;
    });

    // 等待一点时间确保没有新的副作用
    await new Promise(resolve => setTimeout(resolve, 50));

    // effects 数量不应该增加
    expect(effects.length).toBe(effectsBeforeUnmount);
  });
});

describe('useReaction 双函数形式（#200）', () => {
  it('默认挂载不执行 effect，依赖变化后才执行并拿到 (current, previous)', async () => {
    const calls: Array<[number, number | undefined]> = [];
    const state = observable({ count: 0 });

    const Component = observer(() => {
      useReaction(
        () => state.count,
        (current, previous) => {
          calls.push([current, previous]);
        }
      );
      return <div>Count: {state.count}</div>;
    });

    render(<Component />);

    // 挂载只收集依赖，不跑 effect
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(calls).toEqual([]);

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(calls).toEqual([[1, 0]]);
    });

    act(() => {
      state.count = 2;
    });
    await waitFor(() => {
      expect(calls).toEqual([
        [1, 0],
        [2, 1],
      ]);
    });
  });

  it('fireImmediately: true 挂载时立即执行一次，previous 为 undefined', async () => {
    const calls: Array<[number, number | undefined]> = [];
    const state = observable({ count: 0 });

    const Component = observer(() => {
      useReaction(
        () => state.count,
        (current, previous) => {
          calls.push([current, previous]);
        },
        { fireImmediately: true }
      );
      return <div>Count: {state.count}</div>;
    });

    render(<Component />);

    await waitFor(() => {
      expect(calls).toEqual([[0, undefined]]);
    });

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(calls).toEqual([
        [0, undefined],
        [1, 0],
      ]);
    });
  });

  it('dataFn 可以派生数据，effect 只在依赖变化后拿到派生值', async () => {
    const names: string[] = [];
    const state = observable({ first: 'a', last: 'b' });

    const Component = observer(() => {
      useReaction(
        () => `${state.first}-${state.last}`,
        full => {
          names.push(full);
        }
      );
      return <div>{state.first}</div>;
    });

    render(<Component />);

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(names).toEqual([]);

    act(() => {
      state.last = 'c';
    });
    await waitFor(() => {
      expect(names).toEqual(['a-c']);
    });
  });

  it('卸载后依赖变化不再执行 effect', async () => {
    const calls: number[] = [];
    const state = observable({ count: 0 });

    const Component = observer(() => {
      useReaction(
        () => state.count,
        current => {
          calls.push(current);
        }
      );
      return <div>Count: {state.count}</div>;
    });

    const { unmount } = render(<Component />);
    unmount();

    act(() => {
      state.count = 1;
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(calls).toEqual([]);
  });

  // #249：effect 在 observe 的 tracked 回调内执行，其中读取的 observable 会被
  // 注册为依赖 —— 违反「只有 data() 的读取构成依赖」的契约（MobX reaction 的
  // effect 是 untracked 的）。钉住：只改 effect 读到的属性不得重跑 effect。
  it('effect 内读取的 observable 不泄漏进依赖集合（#249）', async () => {
    const calls: Array<[number, number | undefined]> = [];
    const state = observable({ a: 1, b: 1 });

    const Component = () => {
      useReaction(
        () => state.a,
        (a, prev) => {
          // effect 内读取 b —— 不应成为依赖
          void state.b;
          calls.push([a, prev]);
        }
      );
      return null;
    };

    render(<Component />);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(calls).toEqual([]);

    act(() => {
      state.a = 2;
    });
    await waitFor(() => {
      expect(calls).toEqual([[2, 1]]);
    });

    // 只改 b：effect 里读过 b，但 b 不是 data() 的依赖，不得触发
    act(() => {
      state.b = 3;
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(calls).toEqual([[2, 1]]);
  });

  it('fireImmediately: true 首跑 effect 的读取同样不泄漏进依赖集合（#249）', async () => {
    const calls: Array<[number, number | undefined]> = [];
    const state = observable({ a: 1, b: 1 });

    const Component = () => {
      useReaction(
        () => state.a,
        (a, prev) => {
          void state.b;
          calls.push([a, prev]);
        },
        { fireImmediately: true }
      );
      return null;
    };

    render(<Component />);
    await waitFor(() => {
      expect(calls).toEqual([[1, undefined]]);
    });

    // 首跑 effect 读了 b；只改 b 不得重跑 effect
    act(() => {
      state.b = 3;
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(calls).toEqual([[1, undefined]]);

    // a 变化仍正常触发
    act(() => {
      state.a = 2;
    });
    await waitFor(() => {
      expect(calls).toEqual([
        [1, undefined],
        [2, 1],
      ]);
    });
  });
});

describe('useReaction 单函数形式 lazy 选项（#253）', () => {
  it('传入 lazy 时发出 dev 警告（与 immediate 语义冲突，immediate 优先）', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const effects: number[] = [];
      const state = observable({ count: 0 });

      const Component = () => {
        useReaction(
          () => {
            effects.push(state.count);
          },
          // lazy 被静默丢弃 —— 必须至少警告用户
          { immediate: false, lazy: true }
        );
        return null;
      };

      render(<Component />);

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('lazy'));
      });

      // 语义不变：immediate 优先，挂载仍跑一次以收集依赖
      await waitFor(() => {
        expect(effects).toEqual([0]);
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('不传 lazy 时不发出 lazy 相关警告', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const state = observable({ count: 0 });

      const Component = () => {
        useReaction(() => {
          void state.count;
        });
        return null;
      };

      render(<Component />);
      await new Promise(resolve => setTimeout(resolve, 50));

      const lazyWarnings = warnSpy.mock.calls.filter(args => String(args[0]).includes('lazy'));
      expect(lazyWarnings).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('useReaction lazy 警告的误报守卫', () => {
  it('显式传 lazy: false 时不发出警告（用户并未依赖 lazy 语义）', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const state = observable({ count: 0 });

      const Component = () => {
        // 常见形态：展开一个共享 options 对象，其中 lazy 默认 false
        useReaction(
          () => {
            void state.count;
          },
          { immediate: true, lazy: false }
        );
        return null;
      };

      render(<Component />);
      await new Promise(resolve => setTimeout(resolve, 50));

      const lazyWarnings = warnSpy.mock.calls.filter(args => String(args[0]).includes('lazy'));
      expect(lazyWarnings).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
