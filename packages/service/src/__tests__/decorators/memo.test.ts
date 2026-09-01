/**
 * Memo 装饰器测试
 */

import { observe, unobserve, batch } from '@rabjs/observer';
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

    it('memo getter 依赖另一个 memo getter 时，依赖变化后链式缓存自动失效', () => {
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

      // 修改数据后链式缓存自动失效（#248 同步失效钩子 + scheduler notify
      // 链 + 版本快照链校验）：doubled 的 scheduler -> notify(instance,
      // 'doubled') -> quadrupled 读路径链校验判负 -> 重算。
      // 不需要「先访问 doubled 再手动 invalidateMemo」的旧用法。
      service.data = 20;

      expect(service.quadrupled).toBe(80);
      expect(computeCount1).toBe(2);
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

  describe('外层 observe / 依赖通知（#196）', () => {
    it('observe 读 @Memo getter 后，依赖变化必须重跑外层 reaction', () => {
      class TestService extends Service {
        name = 'a';

        @Memo()
        get label() {
          return this.name.toUpperCase();
        }
      }

      const service = new TestService();
      const seen: string[] = [];
      const reaction = observe(() => {
        seen.push(service.label);
      });
      expect(seen).toEqual(['A']);

      service.name = 'b';
      expect(seen).toEqual(['A', 'B']);
      expect(service.label).toBe('B');

      unobserve(reaction);
    });

    it('observe 读 @Memo getter 后，invalidateMemo 必须重跑外层 reaction（#199）', () => {
      let external = 1;

      class TestService extends Service {
        @Memo()
        get label() {
          return `label:${external}`;
        }
      }

      const service = new TestService();
      const seen: string[] = [];
      const reaction = observe(() => {
        seen.push(service.label);
      });
      expect(seen).toEqual(['label:1']);

      external = 2;
      invalidateMemo(service, 'label');
      expect(seen).toEqual(['label:1', 'label:2']);
      expect(service.label).toBe('label:2');

      unobserve(reaction);
    });

    it('invalidateMemo 未被 observe 读过的 getter 时不通知任何人', () => {
      let external = 1;

      class TestService extends Service {
        @Memo()
        get label() {
          return `label:${external}`;
        }
      }

      const service = new TestService();
      expect(() => invalidateMemo(service, 'label')).not.toThrow();
      expect(service.label).toBe('label:1');
    });
  });

  describe('@Memo getter 抛错后的外层 observe 恢复（#247）', () => {
    it('getter 抛错一次后，外层 observe 在依赖恢复时必须重新触发', () => {
      class TestService extends Service {
        n = 1;

        @Memo()
        get bad() {
          if (this.n === 2) {
            throw new Error('transient');
          }
          return this.n;
        }
      }

      const service = new TestService();
      const seen: any[] = [];
      const reaction = observe(() => {
        try {
          seen.push(service.bad);
        } catch {
          seen.push('ERR');
        }
      });
      expect(seen).toEqual([1]);

      // 进入抛错状态：外层重跑并读到错误
      service.n = 2;
      expect(seen).toEqual([1, 'ERR']);

      // 依赖恢复：外层必须被唤醒并读到新值
      service.n = 3;
      expect(seen).toEqual([1, 'ERR', 3]);
      expect(service.bad).toBe(3);

      unobserve(reaction);
    });

    it('首次读取即抛错时，外层 observe 也能在依赖恢复后重新触发', () => {
      class TestService extends Service {
        n = 2;

        @Memo()
        get bad() {
          if (this.n === 2) {
            throw new Error('transient');
          }
          return this.n;
        }
      }

      const service = new TestService();
      const seen: any[] = [];
      const reaction = observe(() => {
        try {
          seen.push(service.bad);
        } catch {
          seen.push('ERR');
        }
      });
      expect(seen).toEqual(['ERR']);

      service.n = 3;
      expect(seen).toEqual(['ERR', 3]);

      unobserve(reaction);
    });
  });

  describe('batch 内读取 @Memo getter（#248）', () => {
    it('batch 内读取必须返回最新值，而不是过期缓存', () => {
      class TestService extends Service {
        items: number[] = [];

        @Memo()
        get total() {
          return this.items.reduce((a, b) => a + b, 0);
        }
      }

      const service = new TestService();
      expect(service.total).toBe(0); // warm cache

      let midBatch = -1;
      batch(() => {
        service.items.push(5);
        midBatch = service.total;
      });

      expect(midBatch).toBe(5);
      expect(service.total).toBe(5);
    });

    it('batch 内多次修改与读取都保持一致', () => {
      class TestService extends Service {
        items: number[] = [];

        @Memo()
        get total() {
          return this.items.reduce((a, b) => a + b, 0);
        }
      }

      const service = new TestService();
      expect(service.total).toBe(0);

      const reads: number[] = [];
      batch(() => {
        service.items.push(5);
        reads.push(service.total);
        service.items.push(3);
        reads.push(service.total);
      });

      expect(reads).toEqual([5, 8]);
      expect(service.total).toBe(8);
    });

    it('batch 中途的读取不得丢失对外层 observe 的通知', () => {
      class TestService extends Service {
        items: number[] = [];

        @Memo()
        get total() {
          return this.items.reduce((a, b) => a + b, 0);
        }
      }

      const service = new TestService();
      const seen: number[] = [];
      const reaction = observe(() => {
        seen.push(service.total);
      });
      expect(seen).toEqual([0]);

      batch(() => {
        service.items.push(5);
        // 中途读取会触发重算；flush 时外层仍必须收到唤醒
        expect(service.total).toBe(5);
      });

      expect(seen).toEqual([0, 5]);
      unobserve(reaction);
    });
  });

  describe('cleanupAllMemos 通知（#255）', () => {
    it('cleanupAllMemos 默认通知外层 observe，观察者能读到重置后的新值', () => {
      let external = 1;

      class TestService extends Service {
        @Memo()
        get a() {
          return `a:${external}`;
        }

        @Memo()
        get b() {
          return `b:${external}`;
        }
      }

      const service = new TestService();
      const seen: string[] = [];
      const reaction = observe(() => {
        seen.push(`${service.a}|${service.b}`);
      });
      expect(seen).toEqual(['a:1|b:1']);

      external = 2;
      cleanupAllMemos(service);

      // 一次 cleanupAllMemos 只唤醒外层一次（batch 合并），读到重置后的新值
      expect(seen).toEqual(['a:1|b:1', 'a:2|b:2']);

      unobserve(reaction);
    });

    it('Service.destroy 保持静默：destroy 不唤醒外层 observe', () => {
      let external = 1;

      class TestService extends Service {
        @Memo()
        get label() {
          return `label:${external}`;
        }
      }

      const service = new TestService();
      const seen: string[] = [];
      const reaction = observe(() => {
        seen.push(service.label);
      });
      expect(seen).toEqual(['label:1']);

      external = 2;
      service.destroy();

      // destroy 是销毁路径：不唤醒（可能已卸载的）外层 UI
      expect(seen).toEqual(['label:1']);

      unobserve(reaction);
    });

    it('symbol 命名的 @Memo 也必须被 cleanupAllMemos 清理并通知', () => {
      let external = 1;
      const KEY = Symbol('label');

      class TestService extends Service {
        @Memo()
        get [KEY]() {
          return `s:${external}`;
        }
      }

      const service = new TestService();
      const seen: string[] = [];
      const reaction = observe(() => {
        seen.push(service[KEY]);
      });
      expect(seen).toEqual(['s:1']);

      external = 2;
      cleanupAllMemos(service);

      // getOwnPropertyNames 不含 symbol 键 —— 漏扫会让 symbol memo 的
      // reaction 在 destroy 后仍然存活
      expect(seen).toEqual(['s:1', 's:2']);

      unobserve(reaction);
    });

    it('notify flush 中 reaction 抛错不得中断 cleanupAllMemos（清理 API 必须免抛）', () => {
      let external = 1;

      class TestService extends Service {
        @Memo()
        get a() {
          return `a:${external}`;
        }
      }

      const service = new TestService();
      // 挂载中的观察者：首次正常，cleanup 后重跑时抛错
      let shouldThrow = false;
      const reaction = observe(() => {
        void service.a;
        if (shouldThrow) {
          throw new Error('observer-exploded');
        }
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        external = 2;
        shouldThrow = true;
        // flush 会重抛首个 reaction 错误 —— 作为清理 API 不得把它抛给调用方
        expect(() => cleanupAllMemos(service)).not.toThrow();
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
        unobserve(reaction);
      }
    });
  });

  describe('@Memo 链式依赖 mid-batch 读取（#248 链式补全）', () => {
    it('A memo 依赖 B memo，batch 内修改 B 的底层依赖后读 A 必须是最新值', () => {
      class TestService extends Service {
        items: number[] = [];

        @Memo()
        get total() {
          return this.items.reduce((a, b) => a + b, 0);
        }

        @Memo()
        get label() {
          return `total=${this.total}`;
        }
      }

      const service = new TestService();
      expect(service.label).toBe('total=0'); // warm both caches

      let midBatch = '';
      batch(() => {
        service.items.push(5);
        midBatch = service.label;
      });

      expect(midBatch).toBe('total=5');
      expect(service.label).toBe('total=5');
    });

    it('三级链 A→B→C，batch 内修改 C 的底层依赖后读 A 必须是最新值', () => {
      class TestService extends Service {
        n = 1;

        @Memo()
        get c() {
          return this.n * 2;
        }

        @Memo()
        get b() {
          return this.c + 1;
        }

        @Memo()
        get a() {
          return this.b + 1;
        }
      }

      const service = new TestService();
      expect(service.a).toBe(4); // warm: c=2, b=3, a=4

      let midBatch = -1;
      batch(() => {
        service.n = 10;
        midBatch = service.a; // c=20, b=21, a=22
      });

      expect(midBatch).toBe(22);
      expect(service.a).toBe(22);
    });

    it('链式 memo 在 batch 外仍保持缓存语义（不重复计算）', () => {
      let computeB = 0;
      let computeA = 0;

      class TestService extends Service {
        n = 1;

        @Memo()
        get b() {
          computeB++;
          return this.n * 2;
        }

        @Memo()
        get a() {
          computeA++;
          return this.b + 1;
        }
      }

      const service = new TestService();
      expect(service.a).toBe(3);
      expect(service.a).toBe(3);
      expect(computeA).toBe(1);
      expect(computeB).toBe(1);

      service.n = 2;
      expect(service.a).toBe(5);
      expect(service.a).toBe(5);
      expect(computeA).toBe(2);
      expect(computeB).toBe(2);
    });

    it('getter 依赖对象属性，delete 该属性后重新计算', () => {
      class TestService extends Service {
        dict: Record<string, number> = { a: 1 };

        @Memo()
        get a() {
          return this.dict.a;
        }
      }

      const service = new TestService();
      expect(service.a).toBe(1);

      delete service.dict.a;
      expect(service.a).toBeUndefined();
    });

    it('getter 依赖 Map 元素，map.delete 后重新计算', () => {
      class TestService extends Service {
        map = new Map<string, number>([['a', 1]]);

        @Memo()
        get a() {
          return this.map.get('a');
        }
      }

      const service = new TestService();
      expect(service.a).toBe(1);

      service.map.delete('a');
      expect(service.a).toBeUndefined();
    });

    it('batch 内 invalidateMemo(B) 后读链式 A 必须是重算后的值', () => {
      let factor = 1;

      class TestService extends Service {
        n = 1;

        @Memo()
        get b() {
          return this.n * factor;
        }

        @Memo()
        get a() {
          return this.b + 1;
        }
      }

      const service = new TestService();
      expect(service.a).toBe(2); // warm

      factor = 10;
      let midBatch = -1;
      batch(() => {
        // notify(instance,'b') 会同步打在 A 的 debugger 上 → A 同步失效
        invalidateMemo(service, 'b');
        midBatch = service.a; // b=10, a=11
      });

      expect(midBatch).toBe(11);
    });

    it('batch 中途重算后，flush 不得强制二次重算（不纯 getter 前后值一致 / 不多算）', () => {
      let computes = 0;

      class TestService extends Service {
        items: number[] = [];

        @Memo()
        get total() {
          computes++;
          // 末尾拼接计算序号：若 flush 再强制重算一次，值就会发散
          return this.items.reduce((a, b) => a + b, 0) * 1000 + computes;
        }
      }

      const service = new TestService();
      expect(service.total).toBe(1); // warm: 0*1000+1

      let midBatch = -1;
      batch(() => {
        service.items.push(5);
        midBatch = service.total; // 重算一次: 5*1000+2
      });
      const postBatch = service.total;

      expect(midBatch).toBe(5002);
      // flush 的 scheduler 若盲目 computed=false，这里会变成 5003 —
      // 值发散 + 一次浪费的 getter 执行
      expect(postBatch).toBe(5002);
      expect(computes).toBe(2);
    });

    it('链式场景：mid-batch 重算不得被上游的 flush notify 二次失效（不纯 getter 前后一致）', () => {
      // A→B 链。batch 内写 B 的底层依赖后读 A：A 基于重算后的 B 重算。
      // flush 时 B 的 scheduler 无条件 notify(instance, 'b') —— 若该 notify
      // 把 A 标脏，batch 后再读 A 会被迫第三次计算，不纯 getter 前后值发散。
      // 链 notify 由 memoDeps 的版本快照裁决，不走 dirty 记账。
      let bComputes = 0;
      let aComputes = 0;

      class TestService extends Service {
        items: number[] = [];

        @Memo()
        get b() {
          bComputes++;
          return this.items.reduce((acc, x) => acc + x, 0) * 1000 + bComputes;
        }

        @Memo()
        get a() {
          aComputes++;
          return this.b * 10 + aComputes;
        }
      }

      const service = new TestService();
      expect(service.a).toBe(11); // b=0*1000+1=1, a=1*10+1=11

      let midBatch = -1;
      batch(() => {
        service.items.push(5);
        midBatch = service.a; // B 重算: 5*1000+2=5002; A 重算: 5002*10+2=50022
      });
      const postBatch = service.a;

      expect(midBatch).toBe(50022);
      expect(postBatch).toBe(50022);
      expect(aComputes).toBe(2);
      expect(bComputes).toBe(2);
    });

    it('链式场景：上游在 A 上次计算之后被单独重算，A 不得供出陈旧缓存（版本快照）', () => {
      // A→B 链。batch 内写 B 依赖后只读 B（B 重算、版本前进），不读 A。
      // flush 的 notify 不标脏 A（链 notify 跳过）——A 必须靠版本快照
      // 察觉 B 已重算，否则供出采纳旧版 B 的陈旧缓存。
      class TestService extends Service {
        x = 1;

        @Memo()
        get b() {
          return this.x * 2;
        }

        @Memo()
        get a() {
          return this.b + 1;
        }
      }

      const service = new TestService();
      expect(service.a).toBe(3); // A 采纳 B v1 (b=2)

      batch(() => {
        service.x = 5;
        void service.b; // B 重算 (b=10)，A 未参与
      });

      expect(service.a).toBe(11); // 不是陈旧的 3
    });
  });

  describe('@Memo 链式中间环节抛错后的自愈', () => {
    it('B 抛错传播到 A；依赖恢复后 A、B 都自动愈合并返回正确值', () => {
      class TestService extends Service {
        x = 1;

        @Memo()
        get b(): number {
          if (this.x < 0) {
            throw new Error('b-boom');
          }
          return this.x * 2;
        }

        @Memo()
        get a(): number {
          return this.b + 1;
        }
      }

      const service = new TestService();
      expect(service.a).toBe(3); // x=1 -> b=2 -> a=3

      // 进入抛错状态
      service.x = -1;
      expect(() => service.a).toThrow('b-boom');
      expect(() => service.b).toThrow('b-boom');

      // 依赖恢复：两个 memo 都应自愈，不需要任何手动失效
      service.x = 5;
      expect(service.b).toBe(10);
      expect(service.a).toBe(11);
      // 缓存恢复语义：再读不重算
      expect(service.a).toBe(11);
    });

    it('batch 内读到抛错中的链，恢复后 batch 外读取仍正确', () => {
      class TestService extends Service {
        x = 1;

        @Memo()
        get b(): number {
          if (this.x < 0) {
            throw new Error('b-boom');
          }
          return this.x * 2;
        }

        @Memo()
        get a(): number {
          return this.b + 1;
        }
      }

      const service = new TestService();
      expect(service.a).toBe(3);

      let batchReadError: unknown;
      batch(() => {
        service.x = -1;
        try {
          void service.a;
        } catch (e) {
          batchReadError = e;
        }
      });
      expect((batchReadError as Error).message).toBe('b-boom');

      service.x = 7;
      expect(service.a).toBe(15); // b=14 -> a=15
    });
  });

  describe('链式边的归属判定', () => {
    it('getter 计算窗口内其他 reaction 读到的 memo 不记为本 memo 的链式边', () => {
      let aComputes = 0;

      class TestService extends Service {
        x = 1;
        y = 0;
        z = 1;

        @Memo()
        get c() {
          return this.z * 10;
        }

        @Memo()
        get a() {
          aComputes++;
          // 不纯 getter：计算期间写 y。y 有存活 observer R（见下），
          // 写会同步触发 R 重跑 —— R 读 c 的时刻 collectingMemo 仍是
          // a.state，没有归属校验时 c 会被误记为 a 的链式依赖
          this.y = this.x;
          return this.x + 100;
        }
      }

      const service = new TestService();
      // R 依赖 y 和 c：a 的 getter 写 y 时 R 同步重跑并读 c
      observe(() => {
        void service.y;
        void service.c;
      });

      expect(service.a).toBe(101);
      expect(aComputes).toBe(1);

      // c 的上游变化：a 并不真的依赖 c（aComputes 不得增加）。
      // 误记边时，c 重算导致版本快照失配，a 被强制重算
      service.z = 2;
      void service.c;

      expect(service.a).toBe(101);
      expect(aComputes).toBe(1);
    });
  });

  describe('同 description 的 symbol 键 @Memo 清理隔离', () => {
    it('invalidateMemo 不交叉影响另一个同 description 的 symbol 键', () => {
      const KEY1 = Symbol('a');
      const KEY2 = Symbol('a');
      let c1 = 0;
      let c2 = 0;

      class TestService extends Service {
        x = 1;

        @Memo()
        get [KEY1]() {
          c1++;
          return `k1:${this.x}`;
        }

        @Memo()
        get [KEY2]() {
          c2++;
          return `k2:${this.x}`;
        }
      }

      const service = new TestService();
      expect(service[KEY1]).toBe('k1:1');
      expect(service[KEY2]).toBe('k2:1');
      expect(c1).toBe(1);
      expect(c2).toBe(1);

      invalidateMemo(service, KEY2);

      // KEY1 未被触碰（不得被交叉失效）；KEY2 已失效、重读重算
      expect(service[KEY1]).toBe('k1:1');
      expect(c1).toBe(1);
      expect(service[KEY2]).toBe('k2:1');
      expect(c2).toBe(2);
    });

    it('Service.destroy 清理同 description 的第二个 symbol 键（reaction 不残留）', () => {
      const KEY1 = Symbol('a');
      const KEY2 = Symbol('a');

      class TestService extends Service {
        x = 1;

        @Memo()
        get [KEY1]() {
          return `k1:${this.x}`;
        }

        @Memo()
        get [KEY2]() {
          return `k2:${this.x}`;
        }
      }

      const service = new TestService();
      let outerRuns = 0;
      observe(() => {
        outerRuns++;
        void service[KEY2];
      });
      expect(outerRuns).toBe(1);

      // 清理注册表若以字符串化方法名（__cleanup_memo_Symbol(a)）组织，
      // 两个 symbol 共享一个闭包 —— destroy 只清掉 KEY1，KEY2 的
      // reaction 残留，下面的写会通过 notify 唤醒外层 observe
      service.destroy();
      const runsAfterDestroy = outerRuns;
      service.x = 2;
      expect(outerRuns).toBe(runsAfterDestroy);
    });
  });

  describe('isDebugging 重入窗口（用户 debugger 内的嵌套写）', () => {
    it('用户 debugger 执行期间写 memo 依赖不丢失失效', () => {
      class TestService extends Service {
        x = 1;
        y = 0;

        @Memo()
        get doubled() {
          return this.x * 2;
        }
      }

      const service = new TestService();
      expect(service.doubled).toBe(2);

      // 用户 reaction 带 debugger（如 devtools 钩子）：debugger 执行期间
      // 写 service.x（memo 的依赖）—— 嵌套写落在 isDebugging 重入窗口内。
      observe(() => void service.y, {
        debugger: operation => {
          if (operation.type === 'set' && operation.key === 'y') {
            service.x = 10;
          }
        },
      });

      service.y = 1;
      // memo 的同步失效钩子声明了 reentrantSafe（只翻转布尔、不写
      // observable），重入窗口内仍送达；否则这里供出陈旧缓存 2 且
      // flush 没有任何兜底
      expect(service.doubled).toBe(20);
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
