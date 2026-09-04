/**
 * review round 7：整体复查发现的节流/防抖语义致命缺陷
 *
 * 1. @Throttle leading:false 持续调用流饿死 —— lastInvokeTime 恒为 0 让
 *    每次调用都重判 isFirstCall 并重排 trailing 定时器，调用不停止定时器
 *    就永远不到点，方法在持续事件流中一次都不执行。
 * 2. @Throttle leading:false 窗口外调用被同步执行 —— 窗口过期分支无视
 *    leading:false 直接 invokeFunc，违反「leading:false 绝不同步执行」。
 * 3. @Debounce leading:false + maxWait 首次调用被同步执行 —— maxWait 分支
 *    的 shouldInvoke 把 lastInvokeTime===0（首次调用）也算进去。
 * 4. @Debounce/@Throttle 方法体内重入调用的同步嵌套执行 —— leading 边沿 /
 *    wait:0 下重入调用被立即嵌套 invoke，无条件自调方法直接栈溢出。
 */
import { Debounce } from '../../decorators/debounce';
import { Throttle } from '../../decorators/throttle';
import { Service } from '../../service';

describe('review round 7：@Throttle leading:false 语义', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('持续调用流不得饿死：每个窗口至少触发一次', () => {
    class TestService extends Service {
      hits: number[] = [];

      @Throttle(50, { leading: false })
      onEvent(n: number) {
        this.hits.push(n);
      }
    }

    const service = new TestService();

    // 每 40ms 一次（间隔 < wait=50），持续 10 次 —— 经典 scroll/resize 形态
    for (let i = 0; i < 10; i++) {
      service.onEvent(i);
      jest.advanceTimersByTime(40);
    }

    // 节流语义：调用流持续期间每个窗口至少执行一次，不得全部积压到流停止后
    expect(service.hits.length).toBeGreaterThan(0);
  });

  it('窗口外调用不得同步执行（只能经 trailing 定时器）', () => {
    class TestService extends Service {
      hits = 0;

      @Throttle(50, { leading: false })
      save() {
        this.hits++;
      }
    }

    const service = new TestService();

    service.save();
    jest.advanceTimersByTime(50); // trailing 触发首次
    expect(service.hits).toBe(1);

    jest.advanceTimersByTime(60); // t=110，窗口已过
    service.save(); // leading:false —— 不得同步执行
    expect(service.hits).toBe(1);

    jest.advanceTimersByTime(50); // trailing 兜底
    expect(service.hits).toBe(2);
  });

  it('@Throttle(0) 方法体内重入调用不得同步嵌套执行', () => {
    class TestService extends Service {
      hits: string[] = [];

      @Throttle(0)
      save(tag: string) {
        this.hits.push(tag);
        if (tag === 'a') {
          this.save('b'); // 重入调用：wait=0 下旧实现会同步嵌套 invoke
        }
      }
    }

    const service = new TestService();
    service.save('a');
    expect(service.hits).toEqual(['a']);

    jest.advanceTimersByTime(0);
    expect(service.hits).toEqual(['a', 'b']);
  });
});

describe('review round 7：@Debounce maxWait / leading 语义', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('leading:false + maxWait：首次调用不得同步执行', () => {
    class TestService extends Service {
      hits = 0;

      @Debounce(100, { leading: false, maxWait: 5000 })
      save() {
        this.hits++;
      }
    }

    const service = new TestService();
    service.save();
    // leading:false —— 首次调用只能武装定时器，不得同步执行
    expect(service.hits).toBe(0);

    jest.advanceTimersByTime(100); // trailing 到点
    expect(service.hits).toBe(1);
  });

  it('leading:false + maxWait：持续防抖没有后续调用也必须在 maxWait 到点强制触发', () => {
    class TestService extends Service {
      hits: number[] = [];

      @Debounce(1000, { leading: false, maxWait: 2000 })
      save(n: number) {
        this.hits.push(n);
      }
    }

    const service = new TestService();

    // 每 500ms 一次（间隔 < wait=1000），trailing 被不断推迟；
    // maxWait=2000 必须从 burst 起点封顶，不得依赖「再来一次调用」才检查
    for (let i = 0; i < 4; i++) {
      service.save(i);
      jest.advanceTimersByTime(500);
    }

    // t=2000：距 burst 起点（t=0）已达 maxWait，无第 5 次调用也必须已触发
    expect(service.hits).toEqual([3]);
  });

  it('leading 边沿：方法体同步耗时超过 wait 时的重入调用不得同步嵌套执行', () => {
    const hits: string[] = [];

    class TestService extends Service {
      @Debounce(50, { leading: true })
      save(tag: string) {
        hits.push(tag);
        if (tag === 'outer') {
          jest.setSystemTime(Date.now() + 60); // 方法体同步耗时超过 wait
          this.save('reentrant'); // 重入调用：旧实现会走 leading 边沿同步嵌套 invoke
        }
      }
    }

    const service = new TestService();
    service.save('outer');
    expect(hits).toEqual(['outer']);

    jest.advanceTimersByTime(50); // 重入调用的 trailing 兜底
    expect(hits).toEqual(['outer', 'reentrant']);
  });
});
