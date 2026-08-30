/**
 * cleanupAll* 原型链遍历测试
 *
 * cleanupAllMemos/Debounces/Throttles 只扫直接原型，基类上定义的
 * 装饰器成员在子类实例 destroy 时永远不会被清理（#221）。
 */
import { observe, unobserve } from '@rabjs/observer';
import { Service } from '../../service';
import { Memo, Debounce } from '../../decorators';

describe('cleanupAll* 沿原型链清理（#221）', () => {
  describe('@Memo 基类继承', () => {
    class Base extends Service {
      n = 1;

      @Memo()
      get doubled() {
        return this.n * 2;
      }
    }
    class Child extends Base {}

    it('子类实例 destroy 后 memo reaction 不再运行', () => {
      const child = new Child();
      const seen: number[] = [];
      const reaction = observe(() => {
        seen.push(child.doubled);
      });
      expect(seen).toEqual([2]);

      child.destroy();
      child.n = 5;

      expect(seen).toEqual([2]);
      unobserve(reaction);
    });
  });

  describe('@Debounce 基类继承', () => {
    class Base extends Service {
      hits: string[] = [];

      @Debounce(50)
      save(tag: string) {
        this.hits.push(tag);
      }
    }
    class Child extends Base {}

    it('子类实例 destroy 后 pending 定时器被取消', () => {
      jest.useFakeTimers();
      try {
        const child = new Child();
        child.save('x');
        child.destroy();

        jest.advanceTimersByTime(100);
        expect(child.hits).toEqual([]);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('多级继承', () => {
    class L1 extends Service {
      n = 1;

      @Memo()
      get tripled() {
        return this.n * 3;
      }
    }
    class L2 extends L1 {}
    class L3 extends L2 {}

    it('孙类实例 destroy 后 memo reaction 不再运行', () => {
      const inst = new L3();
      const seen: number[] = [];
      const reaction = observe(() => {
        seen.push(inst.tripled);
      });
      expect(seen).toEqual([3]);

      inst.destroy();
      inst.n = 5;

      expect(seen).toEqual([3]);
      unobserve(reaction);
    });
  });
});
