import { observable } from '../observable';
import { observe, unobserve } from '../observer';
import { configure, resetGlobalConfig } from '../configure';

describe('configure', () => {
  afterEach(() => {
    // 每个测试后重置全局配置
    resetGlobalConfig();
  });

  describe('global scheduler configuration', () => {
    it('should use global scheduler when no scheduler is provided', () => {
      const scheduledReactions: any[] = [];
      const globalScheduler = (reaction: any) => {
        scheduledReactions.push(reaction);
      };

      configure({ scheduler: globalScheduler });

      const state = observable({ count: 0 });
      let callCount = 0;

      const reaction = observe(() => {
        callCount++;
        state.count;
      });

      // 初始化时调用一次
      expect(callCount).toBe(1);
      expect(scheduledReactions.length).toBe(0);

      // 修改状态,应该使用全局 scheduler
      state.count++;

      // 由于使用了 scheduler,reaction 应该被加入队列而不是立即执行
      expect(callCount).toBe(1);
      expect(scheduledReactions.length).toBe(1);

      // 手动执行 reaction
      scheduledReactions[0]();
      expect(callCount).toBe(2);

      unobserve(reaction);
    });

    it('should prefer local scheduler over global scheduler', () => {
      const globalScheduledReactions: any[] = [];
      const localScheduledReactions: any[] = [];

      const globalScheduler = (reaction: any) => {
        globalScheduledReactions.push(reaction);
      };

      const localScheduler = (reaction: any) => {
        localScheduledReactions.push(reaction);
      };

      configure({ scheduler: globalScheduler });

      const state = observable({ count: 0 });
      let callCount = 0;

      // 使用本地 scheduler
      const reaction = observe(
        () => {
          callCount++;
          state.count;
        },
        { scheduler: localScheduler }
      );

      expect(callCount).toBe(1);

      // 修改状态
      state.count++;

      // 应该使用本地 scheduler,而不是全局 scheduler
      expect(localScheduledReactions.length).toBe(1);
      expect(globalScheduledReactions.length).toBe(0);

      unobserve(reaction);
    });

    it('should support object-based scheduler (like Set)', () => {
      const schedulerSet = new Set<any>();
      configure({ scheduler: schedulerSet });

      const state = observable({ count: 0 });
      let callCount = 0;

      const reaction = observe(() => {
        callCount++;
        state.count;
      });

      expect(callCount).toBe(1);
      expect(schedulerSet.size).toBe(0);

      // 修改状态
      state.count++;

      // reaction 应该被添加到 Set 中
      expect(schedulerSet.size).toBe(1);
      expect(callCount).toBe(1);

      // 手动执行 reaction
      const reactions = Array.from(schedulerSet);
      reactions.forEach(r => r());

      expect(callCount).toBe(2);

      unobserve(reaction);
    });

    it('should work with lazy reactions', () => {
      const scheduledReactions: any[] = [];
      const globalScheduler = (reaction: any) => {
        scheduledReactions.push(reaction);
      };

      configure({ scheduler: globalScheduler });

      const state = observable({ count: 0 });
      let callCount = 0;

      // 使用 lazy 选项
      const reaction = observe(
        () => {
          callCount++;
          state.count;
        },
        { lazy: true }
      );

      // lazy 时不应该立即执行
      expect(callCount).toBe(0);
      expect(scheduledReactions.length).toBe(0);

      // 首先手动执行一次 reaction 来建立依赖关系
      reaction();
      expect(callCount).toBe(1);

      // 清空队列
      scheduledReactions.length = 0;

      // 修改状态
      state.count++;

      // 应该使用全局 scheduler
      expect(scheduledReactions.length).toBe(1);
      expect(callCount).toBe(1);

      // 手动执行 reaction
      scheduledReactions[0]();
      expect(callCount).toBe(2);

      unobserve(reaction);
    });

    it('should handle multiple reactions with global scheduler', () => {
      const scheduledReactions: any[] = [];
      const globalScheduler = (reaction: any) => {
        scheduledReactions.push(reaction);
      };

      configure({ scheduler: globalScheduler });

      const state = observable({ count: 0, name: 'test' });
      let count1 = 0;
      let count2 = 0;

      const reaction1 = observe(() => {
        count1++;
        state.count;
      });

      const reaction2 = observe(() => {
        count2++;
        state.name;
      });

      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(scheduledReactions.length).toBe(0);

      // 修改 count
      state.count++;

      // 只有 reaction1 应该被调度
      expect(scheduledReactions.length).toBe(1);
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      // 清空队列
      scheduledReactions.length = 0;

      // 修改 name
      state.name = 'updated';

      // 只有 reaction2 应该被调度
      expect(scheduledReactions.length).toBe(1);
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      unobserve(reaction1);
      unobserve(reaction2);
    });

    it('should allow reconfiguring global scheduler for new reactions', () => {
      const scheduler1Reactions: any[] = [];
      const scheduler2Reactions: any[] = [];

      const scheduler1 = (reaction: any) => {
        scheduler1Reactions.push(reaction);
      };

      const scheduler2 = (reaction: any) => {
        scheduler2Reactions.push(reaction);
      };

      configure({ scheduler: scheduler1 });

      const state = observable({ count: 0 });
      let callCount1 = 0;
      let callCount2 = 0;

      // 使用 scheduler1 创建第一个 reaction
      const reaction1 = observe(() => {
        callCount1++;
        state.count;
      });

      state.count++;
      expect(scheduler1Reactions.length).toBe(1);
      expect(scheduler2Reactions.length).toBe(0);

      // 重新配置全局 scheduler
      scheduler1Reactions.length = 0;
      configure({ scheduler: scheduler2 });

      // 使用新的全局 scheduler 创建第二个 reaction
      const reaction2 = observe(() => {
        callCount2++;
        state.count;
      });

      state.count++;
      // reaction1 仍然使用 scheduler1(因为它在重新配置前创建)
      expect(scheduler1Reactions.length).toBe(1);
      // reaction2 使用 scheduler2(因为它在重新配置后创建)
      expect(scheduler2Reactions.length).toBe(1);

      unobserve(reaction1);
      unobserve(reaction2);
    });

    it('should work without global scheduler (default behavior)', () => {
      // 不配置全局 scheduler
      const state = observable({ count: 0 });
      let callCount = 0;

      const reaction = observe(() => {
        callCount++;
        state.count;
      });

      expect(callCount).toBe(1);

      // 修改状态,应该立即执行(同步)
      state.count++;
      expect(callCount).toBe(2);

      state.count++;
      expect(callCount).toBe(3);

      unobserve(reaction);
    });
  });
});
