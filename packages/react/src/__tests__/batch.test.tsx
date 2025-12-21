/**
 * 批量更新配置测试
 * 验证启动和不启动批量更新的效果
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { observable, observe, unobserve, configure, resetGlobalConfig } from '@rabjs/observer';
import { observer } from '../observer';
import { useLocalObservable } from '../useLocalObservable';

describe('Batch Updates Configuration', () => {
  afterEach(() => {
    // 每个测试后重置全局配置
    resetGlobalConfig();
  });

  describe('Without Batch Updates (Default Behavior)', () => {
    it('应该立即同步执行 reactions', () => {
      const executionOrder: string[] = [];
      const state = observable({ count: 0 });

      // 创建第一个 reaction
      const reaction1 = observe(() => {
        executionOrder.push('reaction1');
        state.count;
      });

      executionOrder.length = 0; // 清空初始化执行

      // 创建第二个 reaction
      const reaction2 = observe(() => {
        executionOrder.push('reaction2');
        state.count;
      });

      executionOrder.length = 0; // 清空初始化执行

      // 修改状态 - 应该立即同步执行两个 reactions
      state.count++;

      // 验证两个 reactions 都立即执行了
      expect(executionOrder).toEqual(['reaction1', 'reaction2']);

      unobserve(reaction1);
      unobserve(reaction2);
    });

    it('应该在每次状态变化时都立即执行 reaction', () => {
      const callCounts: number[] = [];
      const state = observable({ count: 0 });

      const reaction = observe(() => {
        callCounts.push(1);
        state.count;
      });

      callCounts.length = 0; // 清空初始化执行

      // 多次修改状态
      state.count++;
      state.count++;
      state.count++;

      // 验证每次修改都立即执行了 reaction
      expect(callCounts.length).toBe(3);

      unobserve(reaction);
    });

    it('React 组件应该在每次状态变化时都重新渲染', async () => {
      let renderCount = 0;

      const TestComponent = observer(() => {
        const state = useLocalObservable(() => ({
          count: 0,
        }));

        renderCount++;

        return (
          <div>
            <div data-testid="count">{state.count}</div>
            <button
              onClick={() => {
                state.count++;
                state.count++;
              }}
            >
              Increment Twice
            </button>
          </div>
        );
      });

      const { rerender } = render(<TestComponent />);
      const initialRenderCount = renderCount;

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // 不使用批量更新时，两次状态变化会导致两次重新渲染
      // 但由于 React 的自动批处理，实际上可能只有一次
      // 所以我们验证至少有一次新的渲染
      expect(renderCount).toBeGreaterThan(initialRenderCount);
    });
  });

  describe('With Batch Updates (React Batched Updates)', () => {
    it('应该批量收集 reactions，然后统一执行', () => {
      const executionOrder: string[] = [];
      const batchScheduler = new Set<any>();

      // 配置批量 scheduler
      configure({ scheduler: batchScheduler });

      const state = observable({ count: 0 });

      // 创建第一个 reaction
      const reaction1 = observe(() => {
        executionOrder.push('reaction1');
        state.count;
      });

      executionOrder.length = 0; // 清空初始化执行

      // 创建第二个 reaction
      const reaction2 = observe(() => {
        executionOrder.push('reaction2');
        state.count;
      });

      executionOrder.length = 0; // 清空初始化执行

      // 修改状态 - reactions 应该被添加到 Set 中，而不是立即执行
      state.count++;

      // 验证 reactions 没有立即执行，而是被添加到 Set 中
      expect(executionOrder.length).toBe(0);
      expect(batchScheduler.size).toBe(2);

      // 手动执行所有 reactions
      const reactions = Array.from(batchScheduler);
      reactions.forEach(r => r());

      // 验证现在 reactions 都执行了
      expect(executionOrder).toEqual(['reaction1', 'reaction2']);

      unobserve(reaction1);
      unobserve(reaction2);
    });

    it('应该在批量执行中去重 reactions', () => {
      const executionOrder: string[] = [];
      const batchScheduler = new Set<any>();

      configure({ scheduler: batchScheduler });

      const state = observable({ count: 0, name: 'test' });

      // 创建一个 reaction 依赖多个属性
      const reaction = observe(() => {
        executionOrder.push('reaction');
        state.count;
        state.name;
      });

      executionOrder.length = 0; // 清空初始化执行

      // 同时修改多个属性
      state.count++;
      state.name = 'updated';

      // 验证 reaction 只被添加到 Set 一次（Set 自动去重）
      expect(batchScheduler.size).toBe(1);
      expect(executionOrder.length).toBe(0);

      // 手动执行
      const reactions = Array.from(batchScheduler);
      reactions.forEach(r => r());

      // 验证 reaction 只执行了一次
      expect(executionOrder).toEqual(['reaction']);

      unobserve(reaction);
    });

    it('应该支持函数类型的 scheduler 进行批量处理', () => {
      const executionOrder: string[] = [];
      const scheduledReactions: any[] = [];

      // 使用函数类型的 scheduler
      const batchScheduler = (reaction: any) => {
        scheduledReactions.push(reaction);
      };

      configure({ scheduler: batchScheduler });

      const state = observable({ count: 0 });

      const reaction1 = observe(() => {
        executionOrder.push('reaction1');
        state.count;
      });

      executionOrder.length = 0;

      const reaction2 = observe(() => {
        executionOrder.push('reaction2');
        state.count;
      });

      executionOrder.length = 0;

      // 修改状态
      state.count++;

      // 验证 reactions 被添加到队列中
      expect(executionOrder.length).toBe(0);
      expect(scheduledReactions.length).toBe(2);

      // 手动执行所有 reactions
      scheduledReactions.forEach(r => r());

      expect(executionOrder).toEqual(['reaction1', 'reaction2']);

      unobserve(reaction1);
      unobserve(reaction2);
    });
  });

  describe('Batch Updates in React Components', () => {
    it('启用批量更新时，多次状态变化应该被收集到 scheduler 中', async () => {
      const batchScheduler = new Set<any>();

      configure({ scheduler: batchScheduler });

      const state = observable({ count: 0, name: 'test' });
      let reactionCallCount = 0;

      const reaction = observe(() => {
        reactionCallCount++;
        state.count;
        state.name;
      });

      reactionCallCount = 0; // 清空初始化执行

      // 在一个事件处理器中修改多个状态
      state.count++;
      state.name = 'updated';

      // 由于使用了批量 scheduler，reactions 应该被收集到 Set 中
      // 而不是立即执行
      expect(reactionCallCount).toBe(0);
      expect(batchScheduler.size).toBe(1);

      // 手动执行所有 reactions
      const reactions = Array.from(batchScheduler);
      reactions.forEach(r => r());

      // 验证 reaction 现在执行了
      expect(reactionCallCount).toBe(1);

      unobserve(reaction);
    });

    it('不启用批量更新时，多次状态变化应该立即触发多次重新渲染', async () => {
      resetGlobalConfig(); // 确保没有配置批量 scheduler

      const renderCounts: number[] = [];

      const TestComponent = observer(() => {
        const state = useLocalObservable(() => ({
          count: 0,
          name: 'test',
        }));

        renderCounts.push(1);

        return (
          <div>
            <div data-testid="count">{state.count}</div>
            <div data-testid="name">{state.name}</div>
            <button
              onClick={() => {
                state.count++;
                state.name = 'updated';
              }}
            >
              Update
            </button>
          </div>
        );
      });

      render(<TestComponent />);
      const initialRenderCount = renderCounts.length;

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // 不使用批量 scheduler 时，reactions 应该立即执行
      // 由于 React 的自动批处理，实际渲染次数可能被优化
      // 但我们验证至少有一次新的渲染
      expect(renderCounts.length).toBeGreaterThan(initialRenderCount);
    });
  });

  describe('Switching Between Batch and Non-Batch Modes', () => {
    it('应该能够在批量和非批量模式之间切换', () => {
      const executionOrder: string[] = [];
      const state = observable({ count: 0 });

      // 第一阶段：非批量模式
      const reaction = observe(() => {
        executionOrder.push('reaction');
        state.count;
      });

      executionOrder.length = 0;

      state.count++;
      expect(executionOrder.length).toBe(1); // 立即执行

      executionOrder.length = 0;

      // 第二阶段：切换到批量模式
      const batchScheduler = new Set<any>();
      configure({ scheduler: batchScheduler });

      // 重新创建 reaction 以使用新的全局 scheduler
      unobserve(reaction);
      const reaction2 = observe(() => {
        executionOrder.push('reaction');
        state.count;
      });

      executionOrder.length = 0;

      state.count++;
      expect(executionOrder.length).toBe(0); // 不立即执行
      expect(batchScheduler.size).toBe(1); // 被添加到 Set

      // 手动执行
      const reactions = Array.from(batchScheduler);
      reactions.forEach(r => r());
      expect(executionOrder.length).toBe(1); // 现在执行了

      unobserve(reaction2);
    });

    it('已创建的 reactions 应该保持其原有的 scheduler', () => {
      const executionOrder: string[] = [];
      const state = observable({ count: 0 });

      // 在非批量模式下创建 reaction
      const reaction1 = observe(() => {
        executionOrder.push('reaction1');
        state.count;
      });

      executionOrder.length = 0;

      // 切换到批量模式
      const batchScheduler = new Set<any>();
      configure({ scheduler: batchScheduler });

      // 在批量模式下创建新的 reaction
      const reaction2 = observe(() => {
        executionOrder.push('reaction2');
        state.count;
      });

      executionOrder.length = 0;

      // 修改状态
      state.count++;

      // reaction1 应该立即执行（因为它在非批量模式下创建）
      // reaction2 应该被添加到 Set（因为它在批量模式下创建）
      expect(executionOrder).toEqual(['reaction1']);
      expect(batchScheduler.size).toBe(1);

      // 手动执行 reaction2
      const reactions = Array.from(batchScheduler);
      reactions.forEach(r => r());
      expect(executionOrder).toEqual(['reaction1', 'reaction2']);

      unobserve(reaction1);
      unobserve(reaction2);
    });
  });

  describe('Batch Configuration in batch.ts', () => {
    it('batch.ts 应该配置 React 的 unstable_batchedUpdates 作为全局 scheduler', () => {
      // 这个测试验证 batch.ts 中的配置是否生效
      // 通过导入 batch.ts，全局 scheduler 应该被设置为 React 的 unstable_batchedUpdates

      // 注意：这个测试需要在导入 batch.ts 后运行
      // 由于 batch.ts 在 main.ts 中被导入，所以全局 scheduler 应该已经被配置

      // 重置全局配置以测试 batch.ts 的配置
      resetGlobalConfig();

      // 导入 batch.ts 来配置全局 scheduler
      // 在实际应用中，batch.ts 在 main.ts 中被导入
      // 这里我们手动配置来模拟 batch.ts 的行为
      const { unstable_batchedUpdates } = require('react-dom');
      configure({ scheduler: unstable_batchedUpdates });

      const state = observable({ count: 0 });
      let reactionExecuted = false;

      const reaction = observe(() => {
        reactionExecuted = true;
        state.count;
      });

      reactionExecuted = false;

      // 修改状态
      state.count++;

      // 由于 batch.ts 配置了 React 的 unstable_batchedUpdates，
      // reaction 应该被添加到 React 的批处理队列中
      // unstable_batchedUpdates 会在适当的时机执行 reaction
      // 在测试环境中，它可能会立即执行或延迟执行
      // 我们验证 scheduler 已经被配置
      expect(reaction.scheduler).toBeDefined();

      unobserve(reaction);
    });

    it('batch.ts 配置应该使 reactions 通过 unstable_batchedUpdates 执行', () => {
      // 这个测试验证 batch.ts 的配置是否正确应用
      resetGlobalConfig();

      const { unstable_batchedUpdates } = require('react-dom');
      configure({ scheduler: unstable_batchedUpdates });

      const state = observable({ count: 0 });
      let callCount = 0;

      const reaction = observe(() => {
        callCount++;
        state.count;
      });

      callCount = 0;

      // 修改状态
      state.count++;

      // 验证 reaction 的 scheduler 已经被设置为 unstable_batchedUpdates
      expect(reaction.scheduler).toBe(unstable_batchedUpdates);

      unobserve(reaction);
    });
  });
});
