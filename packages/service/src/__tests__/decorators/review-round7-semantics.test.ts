/**
 * review round 7：整体复查发现的节流/防抖语义致命缺陷
 *
 * 1. @Throttle leading:false 持续调用流饿死 —— 两处重排：
 *    (a) lastInvokeTime 恒为 0 让每次调用都重判 isFirstCall 并重排 trailing
 *        定时器，调用不停止定时器就永远不到点，方法一次都不执行；
 *    (b) 首次 trailing 之后 lastInvokeTime 已非 0，后续调用走进窗口过期
 *        分支，该分支 cancelTimer 再重排一个完整 wait，持续流把截止永远
 *        推到「下一次调用 + wait」，只响那一次。
 * 2. @Throttle leading:false 窗口外调用被同步执行 —— 窗口过期分支无视
 *    leading:false 直接 invokeFunc，违反「leading:false 绝不同步执行」。
 * 3. @Debounce leading:false + maxWait 首次调用被同步执行 —— maxWait 分支
 *    的 shouldInvoke 把 lastInvokeTime===0（首次调用）也算进去。
 * 4. @Debounce/@Throttle 方法体内重入调用的同步嵌套执行 —— leading 边沿 /
 *    wait:0 下重入调用被立即嵌套 invoke，无条件自调方法直接栈溢出。
 * 5. @Throttle trailing 定时器回调用 Date.now()-lastInvokeTime 再比一次
 *    wait：定时器略早触发 / 时钟回拨 / Date.now 冻结时把窗口内最后一次
 *    调用静默丢掉。wait 已由 setTimeout 保证，到点只应看 hasPendingCall。
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

    // 节流语义：调用流持续期间每个窗口至少执行一次，不得全部积压到流停止后。
    // >0 不够：首次 trailing 之后 lastInvokeTime 已非 0，后续调用走进
    // 「窗口过期」分支；若该分支 cancelTimer 再重排一个完整 wait，定时器
    // 被永远推到「下一次调用 + wait」，流不停止就只响那一次。
    expect(service.hits.length).toBeGreaterThanOrEqual(3);
  });

  it('leading:false 首次 trailing 之后持续调用流不得饿死', () => {
    // 间隔远小于 wait，保证「lastInvoke+wait」与「武装时刻+wait」之间
    // 一定还能再进来一次调用 —— 这是窗口过期分支误 cancel 的触发条件
    class TestService extends Service {
      hits: number[] = [];

      @Throttle(50, { leading: false })
      onEvent(n: number) {
        this.hits.push(n);
      }
    }

    const service = new TestService();

    for (let i = 0; i < 10; i++) {
      service.onEvent(i);
      jest.advanceTimersByTime(20);
    }

    // 200ms / 50ms 至少 3 个窗口。饿死回归：只有 t≈50 的第一次 trailing
    expect(service.hits.length).toBeGreaterThanOrEqual(3);
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

describe('review round 7：@Throttle trailing 补刀 / leading:true 持续流', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('leading:true 持续调用流在首次 trailing 之后不得饿死', () => {
    class TestService extends Service {
      hits: number[] = [];

      @Throttle(50)
      onEvent(n: number) {
        this.hits.push(n);
      }
    }

    const service = new TestService();
    for (let i = 0; i < 10; i++) {
      service.onEvent(i);
      jest.advanceTimersByTime(20);
    }

    // 200ms / 50ms 至少 3 个窗口；默认 leading+trailing 每个窗口都应响
    expect(service.hits.length).toBeGreaterThanOrEqual(3);
  });

  it('trailing 定时器到点必须补刀，不得再要求 Date.now 走过完整 wait', () => {
    // 生产代码若在 timer 回调里写 `Date.now() - lastInvokeTime >= wait`，
    // 定时器略早触发、时钟回拨、或 Date.now 被冻结时，会把窗口内最后一次
    // 调用静默丢掉（leading 已执行、trailing pending 被 releasePayload）。
    // wait 已经由 setTimeout 本身保证，到点只应看 hasPendingCall。
    const frozenNow = 1_000_000;
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(frozenNow);

    class TestService extends Service {
      hits: number[] = [];

      @Throttle(50)
      onEvent(n: number) {
        this.hits.push(n);
      }
    }

    try {
      const service = new TestService();
      service.onEvent(1); // leading 立即执行
      service.onEvent(2); // 窗口内 pending，应由 trailing 补刀
      expect(service.hits).toEqual([1]);

      jest.advanceTimersByTime(50);
      expect(service.hits).toEqual([1, 2]);
    } finally {
      dateNow.mockRestore();
    }
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
