import { Throttle, cancelThrottle, cleanupAllThrottles } from '../../decorators/throttle';
import { Service } from '../../service';

describe('Throttle 装饰器', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('基础节流功能', () => {
    it('应该在时间窗口内最多执行一次', () => {
      class TestService extends Service {
        callCount = 0;

        @Throttle(1000)
        throttledMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      // 快速调用多次
      service.throttledMethod();
      service.throttledMethod();
      service.throttledMethod();

      // 第一次立即执行（leading: true 默认）
      expect(service.callCount).toBe(1);

      // 时间窗口内不会再执行
      jest.advanceTimersByTime(500);
      expect(service.callCount).toBe(1);

      // 时间窗口结束后执行最后一次（trailing: true 默认）
      jest.advanceTimersByTime(500);
      expect(service.callCount).toBe(2);
    });

    it('应该支持 leading: false', () => {
      class TestService extends Service {
        callCount = 0;

        @Throttle(1000, { leading: false })
        throttledMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      service.throttledMethod();
      expect(service.callCount).toBe(0);

      jest.advanceTimersByTime(1000);
      expect(service.callCount).toBe(1);
    });

    it('应该支持 trailing: false', () => {
      class TestService extends Service {
        callCount = 0;

        @Throttle(1000, { trailing: false })
        throttledMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      service.throttledMethod();
      service.throttledMethod();
      expect(service.callCount).toBe(1);

      jest.advanceTimersByTime(1000);
      // trailing: false，不会在时间窗口结束时执行
      expect(service.callCount).toBe(1);
    });
  });

  describe('清理功能', () => {
    it('cancelThrottle 应该清理指定方法的定时器', () => {
      class TestService extends Service {
        callCount = 0;

        @Throttle(1000)
        throttledMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      service.throttledMethod();
      expect(service.callCount).toBe(1);

      // 清理定时器
      cancelThrottle(service, 'throttledMethod');

      // 时间窗口结束后不应该执行
      jest.advanceTimersByTime(1000);
      expect(service.callCount).toBe(1);
    });

    it('cleanupAllThrottles 应该清理所有 Throttle 定时器', () => {
      class TestService extends Service {
        count1 = 0;
        count2 = 0;

        @Throttle(1000)
        method1() {
          this.count1++;
        }

        @Throttle(1000)
        method2() {
          this.count2++;
        }
      }

      const service = new TestService();

      service.method1();
      service.method2();
      expect(service.count1).toBe(1);
      expect(service.count2).toBe(1);

      // 清理所有定时器
      cleanupAllThrottles(service);

      // 时间窗口结束后都不应该执行
      jest.advanceTimersByTime(1000);
      expect(service.count1).toBe(1);
      expect(service.count2).toBe(1);
    });

    it('清理后应该重置状态，允许重新调用', () => {
      class TestService extends Service {
        callCount = 0;

        @Throttle(1000)
        throttledMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      // 第一次调用
      service.throttledMethod();
      expect(service.callCount).toBe(1);

      // 清理
      cancelThrottle(service, 'throttledMethod');

      // 清理后立即调用应该能执行（状态已重置）
      service.throttledMethod();
      expect(service.callCount).toBe(2);
    });

    it('在 Service destroy 时应该清理定时器', () => {
      class TestService extends Service {
        callCount = 0;

        @Throttle(1000)
        throttledMethod() {
          this.callCount++;
        }

        destroy() {
          cleanupAllThrottles(this);
        }
      }

      const service = new TestService();

      service.throttledMethod();
      expect(service.callCount).toBe(1);

      // 模拟 Service 销毁
      service.destroy();

      // 销毁后定时器不应该执行
      jest.advanceTimersByTime(1000);
      expect(service.callCount).toBe(1);
    });
  });

  describe('返回值处理', () => {
    it('应该返回最近一次执行的结果', () => {
      class TestService extends Service {
        counter = 0;

        @Throttle(1000)
        getValue() {
          return ++this.counter;
        }
      }

      const service = new TestService();

      const result1 = service.getValue();
      expect(result1).toBe(1);

      // 时间窗口内返回缓存的结果
      const result2 = service.getValue();
      expect(result2).toBe(1);

      // 时间窗口结束后执行并返回新结果
      jest.advanceTimersByTime(1000);
      const result3 = service.getValue();
      expect(result3).toBe(2);
    });
  });
});
