/**
 * Stack 类的完整测试套件
 * 目标: 提升 stack.ts 的测试覆盖率到 80% 以上
 */

import { Stack } from '../../internals/stack';

describe('Stack', () => {
  describe('基本操作', () => {
    test('应该正确初始化空栈', () => {
      const stack = new Stack<number>();
      expect(stack.size).toBe(0);
      expect(stack.isEmpty()).toBe(true);
    });

    test('push 应该添加元素并返回新大小', () => {
      const stack = new Stack<number>();
      expect(stack.push(1)).toBe(1);
      expect(stack.push(2)).toBe(2);
      expect(stack.push(3)).toBe(3);
      expect(stack.size).toBe(3);
    });

    test('pop 应该移除并返回栈顶元素', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      expect(stack.pop()).toBe(3);
      expect(stack.pop()).toBe(2);
      expect(stack.pop()).toBe(1);
      expect(stack.size).toBe(0);
    });

    test('pop 空栈应该返回 undefined', () => {
      const stack = new Stack<number>();
      expect(stack.pop()).toBeUndefined();
    });

    test('peek 应该返回栈顶元素但不移除', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);

      expect(stack.peek()).toBe(2);
      expect(stack.size).toBe(2);
      expect(stack.peek()).toBe(2);
    });

    test('peek 空栈应该返回 undefined', () => {
      const stack = new Stack<number>();
      expect(stack.peek()).toBeUndefined();
    });

    test('clear 应该清空栈', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      stack.clear();
      expect(stack.size).toBe(0);
      expect(stack.isEmpty()).toBe(true);
      expect(stack.peek()).toBeUndefined();
    });

    test('isEmpty 应该正确判断栈是否为空', () => {
      const stack = new Stack<number>();
      expect(stack.isEmpty()).toBe(true);

      stack.push(1);
      expect(stack.isEmpty()).toBe(false);

      stack.pop();
      expect(stack.isEmpty()).toBe(true);
    });
  });

  describe('has 和 count 方法', () => {
    test('has 应该正确检查元素是否存在', () => {
      const stack = new Stack<number>();
      expect(stack.has(1)).toBe(false);

      stack.push(1);
      expect(stack.has(1)).toBe(true);

      stack.push(2);
      expect(stack.has(2)).toBe(true);
      expect(stack.has(3)).toBe(false);
    });

    test('has 应该在 pop 后正确更新', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(1);

      expect(stack.has(1)).toBe(true);
      stack.pop();
      expect(stack.has(1)).toBe(true); // 还有一个 1
      stack.pop();
      expect(stack.has(1)).toBe(false); // 所有 1 都被移除
    });

    test('count 应该返回元素出现次数', () => {
      const stack = new Stack<number>();
      expect(stack.count(1)).toBe(0);

      stack.push(1);
      expect(stack.count(1)).toBe(1);

      stack.push(1);
      expect(stack.count(1)).toBe(2);

      stack.push(2);
      expect(stack.count(2)).toBe(1);
    });

    test('count 应该在 pop 后正确更新', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(1);
      stack.push(1);

      expect(stack.count(1)).toBe(3);
      stack.pop();
      expect(stack.count(1)).toBe(2);
      stack.pop();
      expect(stack.count(1)).toBe(1);
      stack.pop();
      expect(stack.count(1)).toBe(0);
    });
  });

  describe('迭代方法', () => {
    test('forEach 应该从栈顶到栈底遍历', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      const result: number[] = [];
      stack.forEach(value => {
        result.push(value);
      });

      expect(result).toEqual([3, 2, 1]);
    });

    test('forEach 应该传递正确的索引', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      const indices: number[] = [];
      stack.forEach((_, index) => {
        indices.push(index);
      });

      expect(indices).toEqual([0, 1, 2]);
    });

    test('forEach 应该传递栈实例', () => {
      const stack = new Stack<number>();
      stack.push(1);

      stack.forEach((_, __, stackInstance) => {
        expect(stackInstance).toBe(stack);
      });
    });

    test('forEach 应该支持自定义 this 上下文', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);

      const context = { sum: 0 };
      stack.forEach(function (this: { sum: number }, value: number) {
        this.sum += value;
      }, context);

      expect(context.sum).toBe(3);
    });

    test('values 应该返回迭代器', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      const values = Array.from(stack.values());
      expect(values).toEqual([3, 2, 1]);
    });

    test('entries 应该返回键值对迭代器', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      const entries = Array.from(stack.entries());
      expect(entries).toEqual([
        [0, 3],
        [1, 2],
        [2, 1],
      ]);
    });

    test('Symbol.iterator 应该使栈可迭代', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      const values = [...stack];
      expect(values).toEqual([3, 2, 1]);
    });

    test('for...of 应该正常工作', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      const result: number[] = [];
      for (const value of stack) {
        result.push(value);
      }

      expect(result).toEqual([3, 2, 1]);
    });
  });

  describe('转换方法', () => {
    test('toArray 应该返回从栈顶到栈底的数组', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      expect(stack.toArray()).toEqual([3, 2, 1]);
    });

    test('toArray 空栈应该返回空数组', () => {
      const stack = new Stack<number>();
      expect(stack.toArray()).toEqual([]);
    });

    test('toString 应该返回逗号分隔的字符串', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      expect(stack.toString()).toBe('3,2,1');
    });

    test('toString 空栈应该返回空字符串', () => {
      const stack = new Stack<number>();
      expect(stack.toString()).toBe('');
    });

    test('toJSON 应该返回数组', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      expect(stack.toJSON()).toEqual([3, 2, 1]);
      expect(JSON.stringify(stack)).toBe('[3,2,1]');
    });
  });

  describe('静态方法', () => {
    test('from 应该从可迭代对象创建栈', () => {
      const stack = Stack.from([1, 2, 3]);
      expect(stack.toArray()).toEqual([3, 2, 1]);
    });

    test('from 应该支持 Set', () => {
      const stack = Stack.from(new Set([1, 2, 3]));
      expect(stack.size).toBe(3);
      expect(stack.has(1)).toBe(true);
      expect(stack.has(2)).toBe(true);
      expect(stack.has(3)).toBe(true);
    });

    test('from 应该支持 Map', () => {
      const map = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      const stack = Stack.from(map);
      expect(stack.size).toBe(2);
    });

    test('from 应该支持字符串', () => {
      const stack = Stack.from('abc');
      expect(stack.toArray()).toEqual(['c', 'b', 'a']);
    });

    test('from 空可迭代对象应该创建空栈', () => {
      const stack = Stack.from([]);
      expect(stack.size).toBe(0);
      expect(stack.isEmpty()).toBe(true);
    });

    test('of 应该从参数列表创建栈', () => {
      const stack = Stack.of(1, 2, 3);
      expect(stack.toArray()).toEqual([3, 2, 1]);
    });

    test('of 无参数应该创建空栈', () => {
      const stack = Stack.of();
      expect(stack.size).toBe(0);
    });

    test('of 单个参数应该正常工作', () => {
      const stack = Stack.of(42);
      expect(stack.size).toBe(1);
      expect(stack.peek()).toBe(42);
    });
  });

  describe('边界情况', () => {
    test('应该支持对象类型', () => {
      const stack = new Stack<{ id: number }>();
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };

      stack.push(obj1);
      stack.push(obj2);

      expect(stack.has(obj1)).toBe(true);
      expect(stack.has(obj2)).toBe(true);
      expect(stack.peek()).toBe(obj2);
    });

    test('应该支持 null 和 undefined', () => {
      const stack = new Stack<null | undefined | number>();
      stack.push(null);
      stack.push(undefined);
      stack.push(1);

      expect(stack.size).toBe(3);
      expect(stack.pop()).toBe(1);
      expect(stack.pop()).toBeUndefined();
      expect(stack.pop()).toBeNull();
    });

    test('应该正确处理重复元素', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(1);
      stack.push(1);

      expect(stack.size).toBe(3);
      expect(stack.count(1)).toBe(3);
      expect(stack.has(1)).toBe(true);

      stack.pop();
      expect(stack.count(1)).toBe(2);
      expect(stack.has(1)).toBe(true);

      stack.pop();
      expect(stack.count(1)).toBe(1);
      expect(stack.has(1)).toBe(true);

      stack.pop();
      expect(stack.count(1)).toBe(0);
      expect(stack.has(1)).toBe(false);
    });

    test('clear 后应该清空计数器', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(1);
      stack.push(2);

      stack.clear();

      expect(stack.has(1)).toBe(false);
      expect(stack.has(2)).toBe(false);
      expect(stack.count(1)).toBe(0);
      expect(stack.count(2)).toBe(0);
    });

    test('大量元素操作', () => {
      const stack = new Stack<number>();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        stack.push(i);
      }

      expect(stack.size).toBe(count);

      for (let i = count - 1; i >= 0; i--) {
        expect(stack.pop()).toBe(i);
      }

      expect(stack.isEmpty()).toBe(true);
    });

    test('交替 push 和 pop', () => {
      const stack = new Stack<number>();

      stack.push(1);
      expect(stack.pop()).toBe(1);

      stack.push(2);
      stack.push(3);
      expect(stack.pop()).toBe(3);

      stack.push(4);
      expect(stack.pop()).toBe(4);
      expect(stack.pop()).toBe(2);
      expect(stack.pop()).toBeUndefined();
    });
  });

  describe('类型安全', () => {
    test('应该支持字符串类型', () => {
      const stack = new Stack<string>();
      stack.push('a');
      stack.push('b');

      expect(stack.peek()).toBe('b');
      expect(stack.toArray()).toEqual(['b', 'a']);
    });

    test('应该支持联合类型', () => {
      const stack = new Stack<string | number>();
      stack.push('a');
      stack.push(1);
      stack.push('b');
      stack.push(2);

      expect(stack.size).toBe(4);
      expect(stack.pop()).toBe(2);
      expect(stack.pop()).toBe('b');
    });

    test('应该支持复杂对象类型', () => {
      interface User {
        name: string;
        age: number;
      }

      const stack = new Stack<User>();
      const user1: User = { name: 'Alice', age: 30 };
      const user2: User = { name: 'Bob', age: 25 };

      stack.push(user1);
      stack.push(user2);

      expect(stack.peek()).toBe(user2);
      expect(stack.has(user1)).toBe(true);
    });
  });

  describe('性能优化验证', () => {
    test('has 操作应该是 O(1)', () => {
      const stack = new Stack<number>();
      const count = 10000;

      for (let i = 0; i < count; i++) {
        stack.push(i);
      }

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        stack.has(5000);
      }
      const duration = Date.now() - start;

      // has 操作应该非常快，即使栈很大
      expect(duration).toBeLessThan(100);
    });

    test('count 操作应该是 O(1)', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(1);
      stack.push(1);

      const start = Date.now();
      for (let i = 0; i < 10000; i++) {
        stack.count(1);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
