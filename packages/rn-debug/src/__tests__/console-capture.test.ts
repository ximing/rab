import { setupConsoleCapture } from '../console-capture';

describe('ConsoleCapture', () => {
  afterEach(() => {
    // 每个用例内部 restore
  });

  it('捕获 console 调用且不影响原方法', () => {
    const original = console.log;
    const capture = setupConsoleCapture();
    const calls: unknown[][] = [];
    console.log = (...args: unknown[]) => calls.push(args);
    console.log('hello', 1);
    console.log = original;

    const logs = capture.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ level: 'log', args: ['hello', 1] });
    expect(calls).toHaveLength(1);
    capture.restore();
  });

  it('按 level 过滤、按 limit 截取（最近 N 条）', () => {
    const capture = setupConsoleCapture();
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = () => {};
    console.error = () => {};
    console.warn('w1');
    console.error('e1');
    console.warn('w2');
    console.warn = originalWarn;
    console.error = originalError;

    expect(capture.getLogs({ level: 'warn' }).map(l => l.args[0])).toEqual(['w1', 'w2']);
    expect(capture.getLogs({ limit: 2 }).map(l => l.args[0])).toEqual(['e1', 'w2']);
    capture.restore();
  });

  it('容量满后丢弃最旧（环形）', () => {
    const capture = setupConsoleCapture({ capacity: 3 });
    const orig = console.log;
    console.log = () => {};
    for (let i = 0; i < 5; i++) console.log(`m${i}`);
    console.log = orig;
    expect(capture.getLogs().map(l => l.args[0])).toEqual(['m2', 'm3', 'm4']);
    capture.restore();
  });

  it('onLog 实时回调', () => {
    const seen: string[] = [];
    const capture = setupConsoleCapture({ onLog: entry => seen.push(String(entry.args[0])) });
    const orig = console.info;
    console.info = () => {};
    console.info('live');
    console.info = orig;
    expect(seen).toEqual(['live']);
    capture.restore();
  });

  it('第三方 save/restore 模式不递归且捕获继续（回归）', () => {
    const capture = setupConsoleCapture();
    // Sentry/LogBox 常见模式：save → wrap → restore
    const orig = console.log; // getter → intercept 本身
    console.log = (...args: unknown[]) => {
      (orig as (...a: unknown[]) => void)(...args);
    };
    console.log = orig; // 还原时赋回的是 intercept，不得造成 current === intercept
    expect(() => console.log('after-restore')).not.toThrow();
    expect(capture.getLogs().map(l => l.args[0])).toContain('after-restore');
    capture.restore();
  });

  it('嵌套 setup 不抛且外层捕获继续（回归）', () => {
    const outer = setupConsoleCapture();
    expect(() => {
      const inner = setupConsoleCapture();
      inner.restore();
    }).not.toThrow();
    const orig = console.log;
    console.log = () => {};
    console.log('still-works');
    console.log = orig;
    expect(outer.getLogs().map(l => l.args[0])).toContain('still-works');
    outer.restore();
  });

  it('level 完全缺失时不抛（回退 no-op）（回归）', () => {
    const proto = Object.getPrototypeOf(console) as Record<string, unknown>;
    const savedOwn = Object.getOwnPropertyDescriptor(console, 'debug');
    const savedProto = Object.getOwnPropertyDescriptor(proto, 'debug');
    if (savedOwn) delete (console as unknown as Record<string, unknown>).debug;
    if (savedProto) delete proto.debug;
    try {
      const capture = setupConsoleCapture({ capacity: 10 });
      expect(() =>
        (console as unknown as Record<string, (...a: unknown[]) => void>).debug('x')
      ).not.toThrow();
      expect(capture.getLogs().map(l => l.args[0])).toEqual(['x']);
      capture.restore();
    } finally {
      if (savedOwn) Object.defineProperty(console, 'debug', savedOwn);
      if (savedProto) Object.defineProperty(proto, 'debug', savedProto);
    }
  });

  it('restore 后不再捕获', () => {
    const capture = setupConsoleCapture();
    capture.restore();
    const orig = console.log;
    console.log = () => {};
    console.log('after');
    console.log = orig;
    expect(capture.getLogs()).toHaveLength(0);
  });
});
