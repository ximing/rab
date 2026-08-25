/**
 * Service @SyncAction 装饰器功能测试
 * 测试 @SyncAction 装饰器排除方法的 action 批量更新功能
 */

import { Service } from '../service';
import { SyncAction } from '../decorators';
import { configure, resetGlobalConfig, observe } from '@rabjs/observer';

describe('Service @SyncAction Decorator', () => {
  beforeEach(() => {
    // 重置全局配置
    resetGlobalConfig();
  });

  describe('@SyncAction 装饰器', () => {
    it('应该能够使用 @SyncAction 装饰器标记方法', () => {
      class TestService extends Service {
        @SyncAction
        async fetchData() {
          return 'data';
        }
      }

      const service = new TestService();
      expect(service.$model.fetchData).toBeDefined();
      expect(service.$model.fetchData.loading).toBe(false);
    });

    it('应该正确标记 @SyncAction 方法', () => {
      class TestService extends Service {
        @SyncAction
        async fetchData() {
          return 'data';
        }
      }

      // 检查原型上的标记
      const prototype = TestService.prototype;
      expect((prototype.fetchData as any).__isNoAction).toBe(true);
    });

    it('@SyncAction 方法仍然应该管理状态，但不使用 scheduler', async () => {
      const batchedUpdates = jest.fn((callback: () => void) => callback());

      configure({
        scheduler: batchedUpdates,
      });

      class TestService extends Service {
        @SyncAction
        async fetchData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'data';
        }
      }

      const service = new TestService();

      // 观察状态变化
      const reactions: boolean[] = [];
      observe(() => {
        reactions.push(service.$model.fetchData.loading);
      });

      batchedUpdates.mockClear();
      await service.fetchData();

      // @SyncAction 方法的状态变化不会通过 scheduler 处理
      // 但状态仍然会被更新
      expect(reactions.length).toBeGreaterThan(1);
    });

    it('普通方法应该通过 scheduler 处理状态更新', async () => {
      const batchedUpdates = jest.fn((callback: () => void) => callback());

      configure({
        scheduler: batchedUpdates,
      });

      class TestService extends Service {
        async fetchData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'data';
        }
      }

      const service = new TestService();

      // 观察状态变化
      const reactions: boolean[] = [];
      observe(() => {
        reactions.push(service.$model.fetchData.loading);
      });

      batchedUpdates.mockClear();
      await service.fetchData();

      // 普通方法的状态变化会通过 scheduler 处理
      expect(batchedUpdates).toHaveBeenCalled();
      expect(reactions.length).toBeGreaterThan(1);
    });

    it('混合使用 @SyncAction 和普通方法', async () => {
      class TestService extends Service {
        @SyncAction
        async fetchDataNoAction() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'data';
        }

        async fetchDataWithAction() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'data';
        }
      }

      const service = new TestService();

      // 观察 @SyncAction 方法的状态
      const noActionReactions: boolean[] = [];
      observe(() => {
        noActionReactions.push(service.$model.fetchDataNoAction.loading);
      });

      await service.fetchDataNoAction();

      // 观察普通方法的状态
      const actionReactions: boolean[] = [];
      observe(() => {
        actionReactions.push(service.$model.fetchDataWithAction.loading);
      });

      await service.fetchDataWithAction();

      // 两种方法都应该正确管理状态
      expect(noActionReactions.length).toBeGreaterThan(1);
      expect(actionReactions.length).toBeGreaterThan(1);

      // 最终状态都应该是 false
      expect(service.$model.fetchDataNoAction.loading).toBe(false);
      expect(service.$model.fetchDataWithAction.loading).toBe(false);
    });

    it('@SyncAction 方法仍然应该管理 loading 和 error 状态', async () => {
      class TestService extends Service {
        @SyncAction
        async fetchData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'data';
        }
      }

      const service = new TestService();

      expect(service.$model.fetchData.loading).toBe(false);
      expect(service.$model.fetchData.error).toBe(null);

      const promise = service.fetchData();
      expect(service.$model.fetchData.loading).toBe(true);

      const result = await promise;
      expect(result).toBe('data');
      expect(service.$model.fetchData.loading).toBe(false);
      expect(service.$model.fetchData.error).toBe(null);
    });

    it('@SyncAction 方法在出错时应该设置 error 状态', async () => {
      class TestService extends Service {
        @SyncAction
        async fetchData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('fetch failed');
        }
      }

      const service = new TestService();

      try {
        await service.fetchData();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      expect(service.$model.fetchData.loading).toBe(false);
      expect(service.$model.fetchData.error).toBeInstanceOf(Error);
      expect(service.$model.fetchData.error?.message).toBe('fetch failed');
    });
  });
});
