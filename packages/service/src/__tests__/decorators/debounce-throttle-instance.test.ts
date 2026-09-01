/**
 * @Debounce / @Throttle 每实例状态测试
 *
 * 定时器与 pending 参数必须按实例隔离：装饰器闭包在类定义时只执行
 * 一次，闭包变量是类级共享的——一个实例的调用会被另一个实例覆盖
 * 吞掉，一个实例 destroy 会取消其他实例的 pending 调用（#220）。
 */
import { Service } from '../../service';
import { Debounce, Throttle, cancelDebounce, cancelThrottle } from '../../decorators';

describe('@Debounce / @Throttle 每实例状态（#220）', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('@Debounce', () => {
    class SearchService extends Service {
      hits: string[] = [];

      @Debounce(50)
      search(keyword: string) {
        this.hits.push(keyword);
      }
    }

    it('两个实例各自防抖，互不吞掉对方的调用', () => {
      const s1 = new SearchService();
      const s2 = new SearchService();

      s1.search('one');
      s2.search('two');

      jest.advanceTimersByTime(100);

      expect(s1.hits).toEqual(['one']);
      expect(s2.hits).toEqual(['two']);
    });

    it('一个实例 destroy 不取消其他实例的 pending 调用', () => {
      const s3 = new SearchService();
      const s4 = new SearchService();

      s3.search('three');
      s4.search('four');
      s4.destroy();

      jest.advanceTimersByTime(100);

      expect(s3.hits).toEqual(['three']);
      expect(s4.hits).toEqual([]);
    });

    it('destroy 只取消自己的 pending 调用', () => {
      const s5 = new SearchService();

      s5.search('five');
      s5.destroy();

      jest.advanceTimersByTime(100);

      expect(s5.hits).toEqual([]);
    });
  });

  describe('@Throttle', () => {
    class ScrollService extends Service {
      hits: string[] = [];

      @Throttle(50, { leading: false, trailing: true })
      handleScroll(tag: string) {
        this.hits.push(tag);
      }
    }

    it('两个实例各自节流，trailing 调用互不覆盖', () => {
      const s1 = new ScrollService();
      const s2 = new ScrollService();

      s1.handleScroll('one');
      s2.handleScroll('two');

      jest.advanceTimersByTime(100);

      expect(s1.hits).toEqual(['one']);
      expect(s2.hits).toEqual(['two']);
    });

    it('一个实例 destroy 不取消其他实例的 pending 调用', () => {
      const s3 = new ScrollService();
      const s4 = new ScrollService();

      s3.handleScroll('three');
      s4.handleScroll('four');
      s4.destroy();

      jest.advanceTimersByTime(100);

      expect(s3.hits).toEqual(['three']);
      expect(s4.hits).toEqual([]);
    });
  });

  describe('分离调用（this 为空）不抛 WeakMap TypeError（#250）', () => {
    // 每个用例各自定义类：哨兵状态按装饰方法共享，跨用例复用同一个
    // 装饰过的类会让 fake timer 的时钟与 lastInvokeTime 互相污染

    it('@Debounce：this 为 undefined 时不抛错，trailing 调用照常执行', () => {
      const log: string[] = [];

      class SaveService extends Service {
        @Debounce(50)
        save(tag: string) {
          log.push(tag);
        }
      }

      const detached = Object.getOwnPropertyDescriptor(SaveService.prototype, 'save')!.value;

      expect(() => detached.call(undefined, 'a')).not.toThrow();

      jest.advanceTimersByTime(100);

      expect(log).toEqual(['a']);
    });

    it('@Debounce：分离调用之间共享防抖状态（与 WeakMap 重构前的闭包行为一致）', () => {
      const log: string[] = [];

      class SaveService extends Service {
        @Debounce(50)
        save(tag: string) {
          log.push(tag);
        }
      }

      const detached = Object.getOwnPropertyDescriptor(SaveService.prototype, 'save')!.value;

      detached.call(undefined, 'one');
      detached.call(undefined, 'two');
      detached.call(null, 'three');

      jest.advanceTimersByTime(100);

      // 只执行最后一次
      expect(log).toEqual(['three']);
    });

    it('@Debounce：分离调用与正常实例调用互不干扰', () => {
      const log: string[] = [];

      class SaveService extends Service {
        @Debounce(50)
        save(tag: string) {
          log.push(tag);
        }
      }

      const detached = Object.getOwnPropertyDescriptor(SaveService.prototype, 'save')!.value;
      const s = new SaveService();

      detached.call(undefined, 'detached');
      s.save('instance');

      jest.advanceTimersByTime(100);

      // 两处调用各自保留，互不吞掉
      expect(log).toEqual(['detached', 'instance']);
    });

    it('@Throttle：this 为 undefined 时不抛错，leading 调用立即执行', () => {
      const log: string[] = [];

      class ScrollService extends Service {
        @Throttle(50)
        handleScroll(tag: string) {
          log.push(tag);
        }
      }

      const detached = Object.getOwnPropertyDescriptor(
        ScrollService.prototype,
        'handleScroll'
      )!.value;

      expect(() => detached.call(undefined, 'one')).not.toThrow();

      expect(log).toEqual(['one']);
    });

    it('@Throttle：分离调用在节流窗口内被抑制，窗口外再次执行', () => {
      const log: string[] = [];

      class ScrollService extends Service {
        @Throttle(50)
        handleScroll(tag: string) {
          log.push(tag);
        }
      }

      const detached = Object.getOwnPropertyDescriptor(
        ScrollService.prototype,
        'handleScroll'
      )!.value;

      detached.call(undefined, 'one');
      detached.call(null, 'two');

      // leading 立即执行 'one'；'two' 在窗口内被抑制，转为 trailing
      expect(log).toEqual(['one']);

      jest.advanceTimersByTime(100);

      // trailing 定时器补发 'two'
      expect(log).toEqual(['one', 'two']);

      detached.call(undefined, 'three');
      expect(log).toEqual(['one', 'two', 'three']);
    });

    it('@Debounce：实例 destroy 连同取消分离调用的 pending 定时器', () => {
      const log: string[] = [];

      class SaveService extends Service {
        @Debounce(50)
        save(tag: string) {
          log.push(tag);
        }
      }

      const detached = Object.getOwnPropertyDescriptor(SaveService.prototype, 'save')!.value;
      const s = new SaveService();

      detached.call(undefined, 'pending');
      s.destroy();

      jest.advanceTimersByTime(100);

      // 哨兵键下的 pending 定时器也必须被取消 —— 否则销毁后仍以
      // this=undefined 触发，且 lastArgs 被保留到进程结束
      expect(log).toEqual([]);
    });

    it('@Throttle：trailing 分离调用的 pending 定时器在 destroy 后被取消', () => {
      const log: string[] = [];

      class ScrollService extends Service {
        @Throttle(50, { leading: false, trailing: true })
        handleScroll(tag: string) {
          log.push(tag);
        }
      }

      const detached = Object.getOwnPropertyDescriptor(
        ScrollService.prototype,
        'handleScroll'
      )!.value;
      const s = new ScrollService();

      detached.call(undefined, 'pending');
      s.destroy();

      jest.advanceTimersByTime(100);

      expect(log).toEqual([]);
    });
  });

  describe('symbol 命名方法的 destroy 清理', () => {
    it('@Debounce：symbol 方法的 pending 定时器在 destroy 后被取消', () => {
      const KEY = Symbol('search');
      const log: string[] = [];

      class SearchService extends Service {
        @Debounce(50)
        [KEY](keyword: string) {
          log.push(keyword);
        }
      }

      const s = new SearchService() as any;
      s[KEY]('pending');
      s.destroy();

      jest.advanceTimersByTime(100);

      // 字符串化方法名扫描漏掉 symbol 键时，定时器残留并触发
      expect(log).toEqual([]);
    });

    it('@Throttle：symbol 方法的 trailing 定时器在 destroy 后被取消', () => {
      const KEY = Symbol('scroll');
      const log: string[] = [];

      class ScrollService extends Service {
        @Throttle(50, { leading: false, trailing: true })
        [KEY](tag: string) {
          log.push(tag);
        }
      }

      const s = new ScrollService() as any;
      s[KEY]('pending');
      s.destroy();

      jest.advanceTimersByTime(100);

      expect(log).toEqual([]);
    });

    it('@Debounce：同 description 的两个 symbol 方法各自注册清理，destroy 全部取消', () => {
      const KEY1 = Symbol('a');
      const KEY2 = Symbol('a');
      const log: string[] = [];

      class MultiService extends Service {
        @Debounce(50)
        [KEY1](tag: string) {
          log.push(`k1:${tag}`);
        }

        @Debounce(50)
        [KEY2](tag: string) {
          log.push(`k2:${tag}`);
        }
      }

      const s = new MultiService() as any;
      s[KEY1]('x');
      s[KEY2]('y');
      s.destroy();

      jest.advanceTimersByTime(100);

      // 撞名时第二个键的清理注册不上，k2 的定时器残留触发
      expect(log).toEqual([]);
    });
  });
});

describe('cancelDebounce / cancelThrottle 不连带取消分离调用', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancelDebounce(instance, key) 只取消该实例自己的 pending 调用', () => {
    const hits: string[] = [];

    class SaveService extends Service {
      @Debounce(50)
      save(payload: string) {
        // 方法体不触碰 this，支持分离调用形态（#250）
        hits.push(payload);
      }
    }

    const instance = new SaveService();
    const detached = Object.getOwnPropertyDescriptor(SaveService.prototype, 'save')!
      .value as Function;

    // 分离调用挂起（如 emitter.on('save', service.save) 形态）
    detached.call(undefined, 'detached-payload');
    // 只意图取消实例自己的 pending 调用
    instance.save('instance-payload');
    cancelDebounce(instance, 'save');

    jest.advanceTimersByTime(100);

    // 实例自己的被取消；与本实例无关的分离调用不受影响
    expect(hits).toEqual(['detached-payload']);
  });

  it('cancelThrottle(instance, key) 只取消该实例自己的 pending 调用', () => {
    const hits: string[] = [];

    class ScrollService extends Service {
      @Throttle(50, { leading: false, trailing: true })
      onScroll(payload: string) {
        hits.push(payload);
      }
    }

    const instance = new ScrollService();
    const detached = Object.getOwnPropertyDescriptor(ScrollService.prototype, 'onScroll')!
      .value as Function;

    detached.call(undefined, 'detached-payload');
    instance.onScroll('instance-payload');
    cancelThrottle(instance, 'onScroll');

    jest.advanceTimersByTime(100);

    expect(hits).toEqual(['detached-payload']);
  });

  it('destroy 仍连带清理分离调用状态（有意的兜底语义）', () => {
    const hits: string[] = [];

    class SaveService extends Service {
      @Debounce(50)
      save(payload: string) {
        hits.push(payload);
      }
    }

    const instance = new SaveService();
    const detached = Object.getOwnPropertyDescriptor(SaveService.prototype, 'save')!
      .value as Function;

    detached.call(undefined, 'detached-payload');
    instance.destroy();

    jest.advanceTimersByTime(100);

    expect(hits).toEqual([]);
  });
});

/**
 * 幽灵尾调用回归：invokeFunc 在 finally 中清空 lastArgs/lastThis 后，
 * leading/maxWait 路径紧接着 startTimer 武装的 trailing 定时器到点仍会
 * 无条件 invokeFunc —— 以 this=undefined、空参数重放用户方法（轻则
 * TypeError 甩进定时器回调，重则方法被多执行一次）。trailing 只应在
 * 「上次 invoke 之后又有新调用」时触发（lodash 语义）。
 */
describe('@Debounce / @Throttle 无幽灵尾调用', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('@Debounce leading：单次调用后定时器不再重放', () => {
    const calls: Array<{ self: unknown; args: unknown[] }> = [];

    class SaveService extends Service {
      @Debounce(50, { leading: true })
      save(...args: unknown[]) {
        calls.push({ self: this, args });
      }
    }

    const s = new SaveService();
    s.save('f1');
    expect(calls).toEqual([{ self: s, args: ['f1'] }]);

    jest.advanceTimersByTime(200);
    expect(calls).toHaveLength(1);
  });

  it('@Debounce maxWait：单次调用强制触发后不再重放', () => {
    const calls: Array<{ self: unknown; args: unknown[] }> = [];

    class SaveService extends Service {
      @Debounce(50, { maxWait: 200 })
      save(...args: unknown[]) {
        calls.push({ self: this, args });
      }
    }

    const s = new SaveService();
    s.save('f1');
    expect(calls).toHaveLength(1);

    jest.advanceTimersByTime(300);
    expect(calls).toHaveLength(1);
  });

  it('@Debounce leading：窗口内的后续调用仍触发 trailing（正向对照）', () => {
    const calls: unknown[][] = [];

    class SaveService extends Service {
      @Debounce(50, { leading: true })
      save(...args: unknown[]) {
        calls.push(args);
      }
    }

    const s = new SaveService();
    s.save('f1'); // leading 立即执行
    jest.advanceTimersByTime(20);
    s.save('f2'); // 窗口内的新调用 → trailing 应以最新参数执行

    jest.advanceTimersByTime(100);
    expect(calls).toEqual([['f1'], ['f2']]);
  });

  it('@Throttle（默认 leading）：单次调用后定时器不再重放', () => {
    const calls: Array<{ self: unknown; args: unknown[] }> = [];

    class ScrollService extends Service {
      @Throttle(50)
      onScroll(...args: unknown[]) {
        calls.push({ self: this, args });
      }
    }

    const s = new ScrollService();
    s.onScroll('y1');
    expect(calls).toEqual([{ self: s, args: ['y1'] }]);

    jest.advanceTimersByTime(200);
    expect(calls).toHaveLength(1);
  });

  it('@Throttle：窗口过期后的立即执行不再被定时器重放', () => {
    const calls: unknown[][] = [];

    class ScrollService extends Service {
      @Throttle(50)
      onScroll(...args: unknown[]) {
        calls.push(args);
      }
    }

    const s = new ScrollService();
    s.onScroll('y1');
    jest.advanceTimersByTime(100); // 窗口过期（顺带验证无幽灵调用）
    s.onScroll('y2'); // 立即执行路径
    expect(calls).toEqual([['y1'], ['y2']]);

    jest.advanceTimersByTime(200);
    expect(calls).toEqual([['y1'], ['y2']]);
  });

  it('@Throttle：窗口内的后续调用仍触发 trailing（正向对照）', () => {
    const calls: unknown[][] = [];

    class ScrollService extends Service {
      @Throttle(50)
      onScroll(...args: unknown[]) {
        calls.push(args);
      }
    }

    const s = new ScrollService();
    s.onScroll('y1'); // leading 立即执行
    jest.advanceTimersByTime(20);
    s.onScroll('y2'); // 窗口内 → trailing 以最新参数执行

    jest.advanceTimersByTime(100);
    expect(calls).toEqual([['y1'], ['y2']]);
  });
});
