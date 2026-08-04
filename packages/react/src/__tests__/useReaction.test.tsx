/**
 * useReaction Hook 测试
 *
 * useReaction 用于在组件中创建副作用响应
 * 当 observable 属性变化时，副作用会自动执行（立即执行模式）
 */

import { render, screen, waitFor } from "@testing-library/react";
import React, { act } from "react";
import { observable, useLocalObservable, useReaction, observer } from "@rabjs/react";

describe("useReaction Hook", () => {
  it("应该支持 immediate: true 立即执行一次", async () => {
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
      expect(effects).toContain("count: 0");
    });

    // 再改变状态，应该再执行一次
    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects).toContain("count: 1");
    });
  });

  it("应该支持多个状态变化", async () => {
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
      expect(effects).toContain("count: 0");
    });

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects).toContain("count: 1");
    });

    act(() => {
      state.count = 2;
    });
    await waitFor(() => {
      expect(effects).toContain("count: 2");
    });
  });

  it("应该在同一个组件中支持多个 useReaction", async () => {
    const effects1: string[] = [];
    const effects2: string[] = [];
    const state = observable({ count: 0, name: "John" });

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
      expect(effects1).toContain("count: 0");
      expect(effects2).toContain("name: John");
    });

    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects1).toContain("count: 1");
    });

    act(() => {
      state.name = "Jane";
    });
    await waitFor(() => {
      expect(effects2).toContain("name: Jane");
    });

    // count 变化不应该触发 effects2（只包含 name 的变化）
    expect(effects2.filter((e) => e.includes("count:"))).toHaveLength(0);
  });

  it("应该支持 useLocalObservable", async () => {
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

    expect(getByText("Count: 0")).toBeInTheDocument();

    await waitFor(() => {
      expect(effects).toContain("count: 0");
    });

    // 点击按钮改变状态
    act(() => {
      getByText("Increment").click();
    });

    await waitFor(() => {
      expect(effects).toContain("count: 1");
    });

    act(() => {
      getByText("Increment").click();
    });

    await waitFor(() => {
      expect(effects).toContain("count: 2");
    });
  });

  it("应该自动清理 reaction 当组件卸载时", async () => {
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
      expect(effects).toContain("count: 0");
    });

    // 改变状态触发副作用
    act(() => {
      state.count = 1;
    });
    await waitFor(() => {
      expect(effects).toContain("count: 1");
    });

    const effectsBeforeUnmount = effects.length;

    // 卸载组件
    unmount();

    // 再改变状态，不应该触发副作用
    act(() => {
      state.count = 2;
    });

    // 等待一点时间确保没有新的副作用
    await new Promise((resolve) => setTimeout(resolve, 50));

    // effects 数量不应该增加
    expect(effects.length).toBe(effectsBeforeUnmount);
  });
});
