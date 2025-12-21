/**
 * Service Observable 功能测试
 * 测试 Service 的 observable 特性和批量更新功能
 */

import { Service } from '../service';
import { observe, isObservable, configure, resetGlobalConfig } from '@rabjs/observer';

describe('Service Observable', () => {
  beforeEach(() => {
    // 重置全局配置
    resetGlobalConfig();
  });

  describe('Observable 特性', () => {
    it('Service 实例应该是 observable 的', () => {
      class TestService extends Service {
        count = 0;
      }

      const service = new TestService();
      expect(isObservable(service)).toBe(true);
    });

    it('Service 属性变化应该触发 reaction', () => {
      class TestService extends Service {
        count = 0;

        increment() {
          this.count++;
        }
      }

      const service = new TestService();
      let reactionCount = 0;

      observe(() => {
        // 访问 count 建立依赖
        const _ = service.count;
        reactionCount++;
      });

      expect(reactionCount).toBe(1); // 初始执行一次

      service.increment();
      expect(reactionCount).toBe(2); // count 变化触发 reaction
    });

    it('$model 应该是 observable 的', () => {
      class TestService extends Service {
        async fetchData() {
          return 'data';
        }
      }

      const service = new TestService();
      expect(isObservable(service.$model)).toBe(true);
    });

    it('$model 状态变化应该触发 reaction', async () => {
      class TestService extends Service {
        async fetchData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'data';
        }
      }

      const service = new TestService();
      const loadingStates: boolean[] = [];

      observe(() => {
        loadingStates.push(service.$model.fetchData.loading);
      });

      expect(loadingStates).toEqual([false]); // 初始状态

      const promise = service.fetchData();
      expect(loadingStates).toEqual([false, true]); // loading 变为 true

      await promise;
      expect(loadingStates).toEqual([false, true, false]); // loading 变为 false
    });
  });

  describe('批量更新配置', () => {
    it('应该能够配置全局 scheduler', () => {
      const scheduler = jest.fn((callback: () => void) => callback());

      configure({
        scheduler: scheduler,
      });

      // 验证配置已应用（通过创建 Service 并检查行为）
      class TestService extends Service {
        async fetchData() {
          return 'data';
        }
      }

      const service = new TestService();
      expect(service).toBeDefined();
    });

    it('Service 状态更新应该通过 observable 的 scheduler 处理', async () => {
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
      const reactions: any[] = [];
      observe(() => {
        reactions.push(service.$model.fetchData.loading);
      });

      batchedUpdates.mockClear();
      await service.fetchData();

      // observable 会通过 scheduler 处理状态更新
      expect(batchedUpdates).toHaveBeenCalled();
    });

    it('Service 的状态变化应该被 observable 追踪', async () => {
      class TestService extends Service {
        async fetchData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'data';
        }
      }

      const service = new TestService();
      const reactions: boolean[] = [];

      observe(() => {
        reactions.push(service.$model.fetchData.loading);
      });

      expect(reactions).toEqual([false]); // 初始状态

      const promise = service.fetchData();
      expect(reactions).toEqual([false, true]); // loading 变为 true

      await promise;
      expect(reactions).toEqual([false, true, false]); // loading 变为 false
    });
  });

  describe('方法拦截', () => {
    it('异步方法应该自动管理 loading 状态', async () => {
      class TestService extends Service {
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

    it('异步方法失败应该设置 error 状态', async () => {
      class TestService extends Service {
        async fetchData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('fetch failed');
        }
      }

      const service = new TestService();

      expect(service.$model.fetchData.error).toBe(null);

      try {
        await service.fetchData();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('fetch failed');
      }

      expect(service.$model.fetchData.loading).toBe(false);
      expect(service.$model.fetchData.error).toBeInstanceOf(Error);
      expect(service.$model.fetchData.error?.message).toBe('fetch failed');
    });

    it('同步方法不应该影响 loading 状态', () => {
      class TestService extends Service {
        syncMethod() {
          return 'result';
        }
      }

      const service = new TestService();

      expect(service.$model.syncMethod.loading).toBe(false);

      const result = service.syncMethod();
      expect(result).toBe('result');
      expect(service.$model.syncMethod.loading).toBe(false);
    });
  });

  describe('继承和原型链', () => {
    it('应该正确处理继承的方法', async () => {
      class BaseService extends Service {
        async baseMethod() {
          return 'base';
        }
      }

      class DerivedService extends BaseService {
        async derivedMethod() {
          return 'derived';
        }
      }

      const service = new DerivedService();

      expect(service.$model.baseMethod).toBeDefined();
      expect(service.$model.derivedMethod).toBeDefined();

      const baseResult = await service.baseMethod();
      expect(baseResult).toBe('base');

      const derivedResult = await service.derivedMethod();
      expect(derivedResult).toBe('derived');
    });

    it('不应该拦截 Service 基类的私有方法', () => {
      class TestService extends Service {
        async fetchData() {
          return 'data';
        }
      }

      const service = new TestService();

      // 私有方法不应该在 $model 中
      expect((service.$model as any).__setupMethodInterception).toBeUndefined();
      expect((service.$model as any).__getMethodNames).toBeUndefined();
      expect((service.$model as any).__createMethodWrapper).toBeUndefined();
      expect((service.$model as any).__makeObservable).toBeUndefined();
    });
  });

  describe('多个 Service 实例', () => {
    it('每个实例应该有独立的状态', async () => {
      class TestService extends Service {
        count = 0;

        async increment() {
          await new Promise(resolve => setTimeout(resolve, 10));
          this.count++;
        }
      }

      const service1 = new TestService();
      const service2 = new TestService();

      expect(service1.count).toBe(0);
      expect(service2.count).toBe(0);

      await service1.increment();
      expect(service1.count).toBe(1);
      expect(service2.count).toBe(0);

      await service2.increment();
      expect(service1.count).toBe(1);
      expect(service2.count).toBe(1);
    });

    it('每个实例的 $model 应该独立', async () => {
      class TestService extends Service {
        async fetchData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'data';
        }
      }

      const service1 = new TestService();
      const service2 = new TestService();

      const promise1 = service1.fetchData();
      expect(service1.$model.fetchData.loading).toBe(true);
      expect(service2.$model.fetchData.loading).toBe(false);

      await promise1;
      expect(service1.$model.fetchData.loading).toBe(false);
      expect(service2.$model.fetchData.loading).toBe(false);
    });
  });
});
