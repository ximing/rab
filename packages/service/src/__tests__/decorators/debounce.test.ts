import { Debounce, cancelDebounce, cleanupAllDebounces } from '../../decorators/debounce';
import { Service } from '../../service';

describe('Debounce 装饰器', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('基础防抖功能', () => {
    it('应该在延迟后执行最后一次调用', () => {
      class TestService extends Service {
        callCount = 0;

        @Debounce(1000)
        debouncedMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      // 快速调用多次
      service.debouncedMethod();
      service.debouncedMethod();
      service.debouncedMethod();

      // 延迟期间不执行
      expect(service.callCount).toBe(0);

      jest.advanceTimersByTime(500);
      expect(service.callCount).toBe(0);

      // 延迟结束后执行一次
      jest.advanceTimersByTime(500);
      expect(service.callCount).toBe(1);
    });

    it('应该支持 leading: true', () => {
      class TestService extends Service {
        callCount = 0;

        @Debounce(1000, { leading: true, trailing: false })
        debouncedMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      service.debouncedMethod();
      // leading: true，立即执行
      expect(service.callCount).toBe(1);

      jest.advanceTimersByTime(1000);
      // trailing: false，延迟结束不执行
      expect(service.callCount).toBe(1);
    });

    it('应该支持 maxWait 选项', () => {
      class TestService extends Service {
        callCount = 0;

        @Debounce(1000, { maxWait: 2000 })
        debouncedMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      // 持续调用
      service.debouncedMethod();
      jest.advanceTimersByTime(500);

      service.debouncedMethod();
      jest.advanceTimersByTime(500);

      service.debouncedMethod();
      jest.advanceTimersByTime(500);

      service.debouncedMethod();
      jest.advanceTimersByTime(500);

      // 超过 maxWait，强制执行
      expect(service.callCount).toBe(1);
    });
  });

  describe('清理功能', () => {
    it('cancelDebounce 应该清理指定方法的定时器', () => {
      class TestService extends Service {
        callCount = 0;

        @Debounce(1000)
        debouncedMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      service.debouncedMethod();
      expect(service.callCount).toBe(0);

      // 清理定时器
      cancelDebounce(service, 'debouncedMethod');

      // 延迟结束后不应该执行
      jest.advanceTimersByTime(1000);
      expect(service.callCount).toBe(0);
    });

    it('cleanupAllDebounces 应该清理所有 Debounce 定时器', () => {
      class TestService extends Service {
        count1 = 0;
        count2 = 0;

        @Debounce(1000)
        method1() {
          this.count1++;
        }

        @Debounce(1000)
        method2() {
          this.count2++;
        }
      }

      const service = new TestService();

      service.method1();
      service.method2();
      expect(service.count1).toBe(0);
      expect(service.count2).toBe(0);

      // 清理所有定时器
      cleanupAllDebounces(service);

      // 延迟结束后都不应该执行
      jest.advanceTimersByTime(1000);
      expect(service.count1).toBe(0);
      expect(service.count2).toBe(0);
    });

    it('清理后应该重置状态，允许重新调用', () => {
      class TestService extends Service {
        callCount = 0;

        @Debounce(1000)
        debouncedMethod() {
          this.callCount++;
        }
      }

      const service = new TestService();

      // 第一次调用
      service.debouncedMethod();
      expect(service.callCount).toBe(0);

      // 清理
      cancelDebounce(service, 'debouncedMethod');

      // 清理后立即调用应该能重新开始防抖
      service.debouncedMethod();
      jest.advanceTimersByTime(1000);
      expect(service.callCount).toBe(1);
    });

    it('在 Service destroy 时应该清理定时器', () => {
      class TestService extends Service {
        callCount = 0;

        @Debounce(1000)
        debouncedMethod() {
          this.callCount++;
        }

        destroy() {
          cleanupAllDebounces(this);
        }
      }

      const service = new TestService();

      service.debouncedMethod();
      expect(service.callCount).toBe(0);

      // 模拟 Service 销毁
      service.destroy();

      // 销毁后定时器不应该执行
      jest.advanceTimersByTime(1000);
      expect(service.callCount).toBe(0);
    });
  });

  describe('返回值处理', () => {
    it('应该返回最近一次执行的结果', () => {
      class TestService extends Service {
        counter = 0;

        @Debounce(1000, { leading: true })
        getValue() {
          return ++this.counter;
        }
      }

      const service = new TestService();

      const result1 = service.getValue();
      expect(result1).toBe(1);

      // 防抖期间返回缓存的结果
      const result2 = service.getValue();
      expect(result2).toBe(1);

      // 延迟结束后执行并返回新结果
      jest.advanceTimersByTime(1000);
      const result3 = service.getValue();
      expect(result3).toBe(2);
    });
  });
});
