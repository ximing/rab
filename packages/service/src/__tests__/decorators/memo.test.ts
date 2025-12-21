/**
 * Memo 装饰器测试
 */

import { Service } from '../../service';
import { Memo, invalidateMemo, cleanupAllMemos } from '../../decorators/memo';

describe('@Memo 装饰器', () => {
  describe('基础功能', () => {
    it('应该缓存 getter 的计算结果', () => {
      let computeCount = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get computed() {
          computeCount++;
          return this.data * 2;
        }
      }

      const service = new TestService();

      // 第一次访问，应该计算
      expect(service.computed).toBe(20);
      expect(computeCount).toBe(1);

      // 第二次访问，应该使用缓存
      expect(service.computed).toBe(20);
      expect(computeCount).toBe(1);

      // 第三次访问，仍然使用缓存
      expect(service.computed).toBe(20);
      expect(computeCount).toBe(1);
    });

    it('应该在依赖变化时重新计算', () => {
      let computeCount = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get computed() {
          computeCount++;
          return this.data * 2;
        }
      }

      const service = new TestService();

      // 第一次访问
      expect(service.computed).toBe(20);
      expect(computeCount).toBe(1);

      // 修改依赖
      service.data = 20;

      // 再次访问，应该重新计算
      expect(service.computed).toBe(40);
      expect(computeCount).toBe(2);

      // 再次访问，使用新的缓存
      expect(service.computed).toBe(40);
      expect(computeCount).toBe(2);
    });

    it('应该支持多个依赖', () => {
      let computeCount = 0;

      class TestService extends Service {
        a = 10;
        b = 20;

        @Memo()
        get sum() {
          computeCount++;
          return this.a + this.b;
        }
      }

      const service = new TestService();

      expect(service.sum).toBe(30);
      expect(computeCount).toBe(1);

      // 修改第一个依赖
      service.a = 15;
      expect(service.sum).toBe(35);
      expect(computeCount).toBe(2);

      // 修改第二个依赖
      service.b = 25;
      expect(service.sum).toBe(40);
      expect(computeCount).toBe(3);
    });

    it('应该支持复杂对象依赖', () => {
      let computeCount = 0;

      class TestService extends Service {
        users = [
          { id: 1, name: 'Alice', age: 25 },
          { id: 2, name: 'Bob', age: 30 },
        ];

        @Memo()
        get totalAge() {
          computeCount++;
          return this.users.reduce((sum, user) => sum + user.age, 0);
        }
      }

      const service = new TestService();

      expect(service.totalAge).toBe(55);
      expect(computeCount).toBe(1);

      // 修改数组
      service.users.push({ id: 3, name: 'Charlie', age: 35 });
      expect(service.totalAge).toBe(90);
      expect(computeCount).toBe(2);

      // 修改数组元素
      service.users[0]!.age = 30;
      expect(service.totalAge).toBe(95);
      expect(computeCount).toBe(3);
    });
  });

  describe('多个实例独立缓存', () => {
    it('不同实例应该有独立的缓存', () => {
      let computeCount1 = 0;
      let computeCount2 = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get computed() {
          // 使用实例标识来区分计数
          if (this.data === 10) {
            computeCount1++;
          } else {
            computeCount2++;
          }
          return this.data * 2;
        }
      }

      const service1 = new TestService();
      const service2 = new TestService();
      service2.data = 20;

      // 访问第一个实例
      expect(service1.computed).toBe(20);
      expect(computeCount1).toBe(1);

      // 访问第二个实例
      expect(service2.computed).toBe(40);
      expect(computeCount2).toBe(1);

      // 再次访问，应该使用各自的缓存
      expect(service1.computed).toBe(20);
      expect(service2.computed).toBe(40);
      expect(computeCount1).toBe(1);
      expect(computeCount2).toBe(1);
    });
  });

  describe('多个 Memo getter', () => {
    it('应该支持多个 @Memo getter', () => {
      let computeCount1 = 0;
      let computeCount2 = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get computed1() {
          computeCount1++;
          return this.data * 2;
        }

        @Memo()
        get computed2() {
          computeCount2++;
          return this.data * 3;
        }
      }

      const service = new TestService();

      // 访问第一个 getter
      expect(service.computed1).toBe(20);
      expect(computeCount1).toBe(1);
      expect(computeCount2).toBe(0);

      // 访问第二个 getter
      expect(service.computed2).toBe(30);
      expect(computeCount1).toBe(1);
      expect(computeCount2).toBe(1);

      // 修改依赖
      service.data = 20;

      // 两个 getter 都应该重新计算
      expect(service.computed1).toBe(40);
      expect(service.computed2).toBe(60);
      expect(computeCount1).toBe(2);
      expect(computeCount2).toBe(2);
    });
  });

  describe('链式依赖', () => {
    it('应该支持 getter 依赖原始响应式数据', () => {
      let computeCount1 = 0;
      let computeCount2 = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get doubled() {
          computeCount1++;
          return this.data * 2;
        }

        @Memo()
        get quadrupled() {
          computeCount2++;
          // 直接依赖原始数据，而不是依赖另一个 memo getter
          return this.data * 4;
        }
      }

      const service = new TestService();

      // 访问两个 getter
      expect(service.doubled).toBe(20);
      expect(service.quadrupled).toBe(40);
      expect(computeCount1).toBe(1);
      expect(computeCount2).toBe(1);

      // 再次访问，使用缓存
      expect(service.doubled).toBe(20);
      expect(service.quadrupled).toBe(40);
      expect(computeCount1).toBe(1);
      expect(computeCount2).toBe(1);

      // 修改原始数据
      service.data = 20;

      // 两个 getter 都会重新计算
      expect(service.doubled).toBe(40);
      expect(service.quadrupled).toBe(80);
      expect(computeCount1).toBe(2);
      expect(computeCount2).toBe(2);
    });

    it('memo getter 可以依赖另一个 memo getter，但需要注意缓存行为', () => {
      let computeCount1 = 0;
      let computeCount2 = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get doubled() {
          computeCount1++;
          return this.data * 2;
        }

        @Memo()
        get quadrupled() {
          computeCount2++;
          return this.doubled * 2;
        }
      }

      const service = new TestService();

      // 初始访问
      expect(service.quadrupled).toBe(40);
      expect(computeCount1).toBe(1);
      expect(computeCount2).toBe(1);

      // 修改数据后，quadrupled 的缓存不会自动失效
      // 因为它依赖的是 doubled 的返回值，而不是 doubled 的缓存状态
      service.data = 20;

      // 需要先访问 doubled 来更新它的缓存
      expect(service.doubled).toBe(40);
      expect(computeCount1).toBe(2);

      // 然后手动失效 quadrupled 的缓存
      invalidateMemo(service, 'quadrupled');

      // 现在访问 quadrupled 会得到正确的值
      expect(service.quadrupled).toBe(80);
      expect(computeCount2).toBe(2);
    });
  });

  describe('错误处理', () => {
    it('应该抛出错误如果不是用于 getter', () => {
      expect(() => {
        class TestService extends Service {
          // @ts-expect-error - 故意测试错误情况
          @Memo()
          notAGetter = 10;
        }
        new TestService();
      }).toThrow('@Memo 装饰器只能用于 getter 方法');
    });

    it('应该正确处理 getter 中的错误', () => {
      class TestService extends Service {
        shouldThrow = true;

        @Memo()
        get computed() {
          if (this.shouldThrow) {
            throw new Error('计算错误');
          }
          return 42;
        }
      }

      const service = new TestService();

      // 第一次访问应该抛出错误
      expect(() => service.computed).toThrow('计算错误');

      // 修复错误条件
      service.shouldThrow = false;

      // 再次访问应该成功
      expect(service.computed).toBe(42);
    });
  });

  describe('手动失效缓存', () => {
    it('应该支持手动失效缓存', () => {
      let computeCount = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get computed() {
          computeCount++;
          return this.data * 2;
        }
      }

      const service = new TestService();

      expect(service.computed).toBe(20);
      expect(computeCount).toBe(1);

      // 手动失效缓存
      invalidateMemo(service, 'computed');

      // 再次访问应该重新计算
      expect(service.computed).toBe(20);
      expect(computeCount).toBe(2);
    });
  });

  describe('清理所有缓存', () => {
    it('应该清理实例上所有 Memo 缓存', () => {
      let computeCount1 = 0;
      let computeCount2 = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get computed1() {
          computeCount1++;
          return this.data * 2;
        }

        @Memo()
        get computed2() {
          computeCount2++;
          return this.data * 3;
        }
      }

      const service = new TestService();

      expect(service.computed1).toBe(20);
      expect(service.computed2).toBe(30);
      expect(computeCount1).toBe(1);
      expect(computeCount2).toBe(1);

      // 清理所有缓存
      cleanupAllMemos(service);

      // 再次访问应该重新计算
      expect(service.computed1).toBe(20);
      expect(service.computed2).toBe(30);
      expect(computeCount1).toBe(2);
      expect(computeCount2).toBe(2);
    });
  });

  describe('与 observable 数组的集成', () => {
    it('应该正确追踪 observable 数组的变化', () => {
      let computeCount = 0;

      class TestService extends Service {
        items = [1, 2, 3]; // Service 会自动将其转换为 observable

        @Memo()
        get sum() {
          computeCount++;
          return this.items.reduce((a, b) => a + b, 0);
        }
      }

      const service = new TestService();

      expect(service.sum).toBe(6);
      expect(computeCount).toBe(1);

      // 添加元素
      service.items.push(4);
      expect(service.sum).toBe(10);
      expect(computeCount).toBe(2);

      // 删除元素
      service.items.pop();
      expect(service.sum).toBe(6);
      expect(computeCount).toBe(3);

      // 修改元素
      service.items[0] = 10;
      expect(service.sum).toBe(15);
      expect(computeCount).toBe(4);
    });
  });

  describe('性能测试', () => {
    it('缓存应该显著减少计算次数', () => {
      let computeCount = 0;

      class TestService extends Service {
        data = 10;

        @Memo()
        get expensive() {
          computeCount++;
          // 模拟昂贵的计算
          let result = this.data;
          for (let i = 0; i < 1000; i++) {
            result = Math.sqrt(result + i);
          }
          return result;
        }
      }

      const service = new TestService();

      // 多次访问
      for (let i = 0; i < 100; i++) {
        service.expensive;
      }

      // 应该只计算一次
      expect(computeCount).toBe(1);

      // 修改依赖
      service.data = 20;

      // 再次多次访问
      for (let i = 0; i < 100; i++) {
        service.expensive;
      }

      // 应该只计算两次
      expect(computeCount).toBe(2);
    });
  });
});
