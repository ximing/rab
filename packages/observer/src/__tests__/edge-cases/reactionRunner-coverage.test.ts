/**
 * reactionRunner 边界情况测试
 * 目标: 覆盖 reactionRunner.ts 中未覆盖的代码路径
 */

import { observable } from '../../observable';
import { observe, unobserve } from '../../observer';

describe('reactionRunner - 边界情况覆盖', () => {
  describe('unobserved reaction', () => {
    test('unobserved 的 reaction 应该直接执行不建立依赖', () => {
      const obj = observable({ count: 0 });
      let callCount = 0;

      const reaction = observe(() => {
        obj.count;
        callCount++;
      });

      expect(callCount).toBe(1);

      // 取消观察
      unobserve(reaction);

      // 修改属性不应该触发 reaction
      obj.count++;
      expect(callCount).toBe(1);

      // 手动调用 unobserved 的 reaction
      reaction();
      expect(callCount).toBe(2);

      // 再次修改属性仍然不应该触发 reaction
      obj.count++;
      expect(callCount).toBe(2);
    });

    test('unobserve 后手动调用 reaction 应该能访问最新值', () => {
      const obj = observable({ count: 0 });
      let observedValue = 0;

      const reaction = observe(() => {
        observedValue = obj.count;
      });

      expect(observedValue).toBe(0);

      // 取消观察
      unobserve(reaction);

      // 修改值
      obj.count = 10;

      // 手动调用 reaction 应该能访问最新值
      reaction();
      expect(observedValue).toBe(10);
    });
  });

  describe('递归 reaction 防护', () => {
    test('reaction 不应该递归调用自己', () => {
      const obj = observable({ count: 0 });
      let callCount = 0;

      observe(() => {
        callCount++;
        obj.count;
        // 尝试在 reaction 内部修改依赖的属性
        // 由于 reaction 在栈中，不会触发自己
        if (obj.count < 5) {
          obj.count++;
        }
      });

      // 应该只执行一次初始调用
      expect(callCount).toBe(1);
      // count 应该被修改一次（在 reaction 执行期间）
      expect(obj.count).toBe(1);
    });

    test('嵌套的 reaction 应该正常工作', () => {
      const obj = observable({ a: 0, b: 0 });
      let outerCount = 0;
      let innerCount = 0;

      observe(() => {
        outerCount++;
        obj.a;

        // 内部 reaction
        observe(() => {
          innerCount++;
          obj.b;
        });
      });

      expect(outerCount).toBe(1);
      expect(innerCount).toBe(1);

      // 修改 a 应该触发外部 reaction，同时创建新的内部 reaction
      obj.a++;
      expect(outerCount).toBe(2);
      expect(innerCount).toBe(2);

      // 修改 b 应该触发所有内部 reactions（包括之前创建的）
      obj.b++;
      // 由于每次外部 reaction 执行都会创建新的内部 reaction
      // 所以现在有 2 个内部 reactions，都会被触发
      expect(innerCount).toBe(4);
    });
  });

  describe('debugger 功能', () => {
    test('reaction 的 debugger 应该被调用', () => {
      const obj = observable({ count: 0 });
      const debugOperations: any[] = [];

      observe(
        () => {
          obj.count;
        },
        {
          debugger: operation => {
            debugOperations.push(operation);
          },
        }
      );

      // 初始执行应该记录 get 操作
      expect(debugOperations.length).toBeGreaterThan(0);
      expect(debugOperations[0].type).toBe('get');

      // 修改属性应该记录 set 操作
      obj.count++;
      expect(debugOperations.length).toBeGreaterThan(1);
      const setOperation = debugOperations.find(op => op.type === 'set');
      expect(setOperation).toBeDefined();
    });

    test('debugger 不应该导致无限递归', () => {
      const obj = observable({ count: 0 });
      let debugCount = 0;

      observe(
        () => {
          obj.count;
        },
        {
          debugger: () => {
            debugCount++;
            // 在 debugger 中访问 observable 不应该触发新的 debug
            obj.count;
          },
        }
      );

      const initialDebugCount = debugCount;

      // 修改属性
      obj.count++;

      // debugger 应该被调用，但不应该无限递归
      expect(debugCount).toBeGreaterThan(initialDebugCount);
      expect(debugCount).toBeLessThan(100); // 确保没有无限递归
    });
  });

  describe('scheduler 功能', () => {
    test('函数类型的 scheduler 应该被调用', () => {
      const obj = observable({ count: 0 });
      const scheduledReactions: any[] = [];

      observe(
        () => {
          obj.count;
        },
        {
          scheduler: reaction => {
            scheduledReactions.push(reaction);
          },
        }
      );

      // 初始执行不使用 scheduler
      expect(scheduledReactions.length).toBe(0);

      // 修改属性应该使用 scheduler
      obj.count++;
      expect(scheduledReactions.length).toBe(1);

      // 手动执行 scheduled reaction
      scheduledReactions[0]();
    });

    test('对象类型的 scheduler (Set) 应该收集 reactions', () => {
      const obj = observable({ count: 0 });
      const scheduler = new Set();

      observe(
        () => {
          obj.count;
        },
        {
          scheduler,
        }
      );

      expect(scheduler.size).toBe(0);

      // 修改属性应该将 reaction 添加到 Set
      obj.count++;
      expect(scheduler.size).toBe(1);

      // 再次修改不应该重复添加
      obj.count++;
      expect(scheduler.size).toBe(1);
    });

    test('对象类型的 scheduler (自定义对象) 应该调用 add 方法', () => {
      const obj = observable({ count: 0 });
      const addedReactions: any[] = [];
      const scheduler = {
        add: (reaction: any) => {
          addedReactions.push(reaction);
        },
        delete: (reaction: any) => {
          // 在测试中 delete 方法不需要实际功能
        },
      };

      observe(
        () => {
          obj.count;
        },
        {
          scheduler,
        }
      );

      expect(addedReactions.length).toBe(0);

      // 修改属性应该调用 scheduler.add
      obj.count++;
      expect(addedReactions.length).toBe(1);
    });

    test('无 scheduler 应该同步执行 reaction', () => {
      const obj = observable({ count: 0 });
      let reactionCount = 0;

      observe(() => {
        obj.count;
        reactionCount++;
      });

      expect(reactionCount).toBe(1);

      // 修改属性应该立即同步执行 reaction
      obj.count++;
      expect(reactionCount).toBe(2);
    });
  });

  describe('栈大小优化', () => {
    test('空栈时不应该检查 reaction 是否在栈中', () => {
      const obj = observable({ count: 0 });
      let callCount = 0;

      observe(() => {
        obj.count;
        callCount++;
      });

      expect(callCount).toBe(1);

      // 修改属性应该触发 reaction（栈为空，不需要检查）
      obj.count++;
      expect(callCount).toBe(2);
    });

    test('栈不为空时应该检查 reaction 是否在栈中', () => {
      const obj = observable({ count: 0, trigger: 0 });
      let innerCallCount = 0;

      observe(() => {
        obj.trigger;
        // 在 reaction 中修改另一个属性
        observe(() => {
          obj.count;
          innerCallCount++;
        });
      });

      expect(innerCallCount).toBe(1);

      // 在外部 reaction 执行期间修改 count
      // 这应该被阻止，因为 reaction 在栈中
      obj.trigger++;
      expect(innerCallCount).toBe(2);
    });
  });

  describe('reaction 清理', () => {
    test('reaction 重新执行时应该清理旧的依赖', () => {
      const obj = observable({ flag: true, a: 0, b: 0 });
      let callCount = 0;

      observe(() => {
        callCount++;
        if (obj.flag) {
          obj.a;
        } else {
          obj.b;
        }
      });

      expect(callCount).toBe(1);

      // 修改 a 应该触发 reaction
      obj.a++;
      expect(callCount).toBe(2);

      // 切换 flag
      obj.flag = false;
      expect(callCount).toBe(3);

      // 修改 a 不应该触发 reaction（依赖已清理）
      obj.a++;
      expect(callCount).toBe(3);

      // 修改 b 应该触发 reaction
      obj.b++;
      expect(callCount).toBe(4);
    });
  });
});
