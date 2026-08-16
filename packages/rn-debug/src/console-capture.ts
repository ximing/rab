import { safeSerialize } from './serialize';

export interface ConsoleLogEntry {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  args: unknown[];
  time: number;
}

export interface ConsoleCapture {
  getLogs(filter?: { level?: ConsoleLogEntry['level']; limit?: number }): ConsoleLogEntry[];
  restore(): void;
}

const LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;

type ConsoleFn = (...args: unknown[]) => void;

const noop: ConsoleFn = () => {};

/**
 * 用访问器属性 patch console：后续对 console[level] 的再赋值
 * （测试、RN polyfill、Sentry/LogBox 等 save/restore 工具都可能这样做）
 * 通过 setter 替换“当前原方法”，拦截本身不被覆盖。restore 时还原为
 * patch 前的属性描述符。
 *
 * setter 语义（save/restore 兼容）：
 * - 赋入普通函数 → 记录历史，替换当前原方法（包裹）
 * - 赋入的值 === intercept 自身（即调用方此前经 getter 读到的引用）→
 *   视为第三方 restore，弹历史回到上一个原方法，避免 current === intercept
 *   导致的无限递归
 */
export function setupConsoleCapture(options: {
  capacity?: number;
  onLog?: (entry: ConsoleLogEntry) => void;
} = {}): ConsoleCapture {
  const capacity = options.capacity ?? 500;
  const buffer: ConsoleLogEntry[] = [];
  const restoreFns: Array<() => void> = [];

  for (const level of LEVELS) {
    const target = console as unknown as Record<string, ConsoleFn>;
    const proto = Object.getPrototypeOf(target) as Record<string, ConsoleFn> | null;
    const ownDescriptor = Object.getOwnPropertyDescriptor(target, level);
    const protoDescriptor = proto ? Object.getOwnPropertyDescriptor(proto, level) : undefined;
    const descriptor = ownDescriptor ?? protoDescriptor;

    // 初始原方法：value 缺失（own 描述符是访问器——嵌套 setup 场景）时读 getter；
    // level 完全缺失时回退 no-op，保证 setup 不抛。
    let current: ConsoleFn;
    if (descriptor && typeof descriptor.value === 'function') {
      current = descriptor.value.bind(target);
    } else if (descriptor && typeof descriptor.get === 'function') {
      const got = descriptor.get.call(target);
      current = typeof got === 'function' && got !== noop ? got.bind(target) : noop;
    } else {
      current = noop;
    }

    const history: ConsoleFn[] = [];
    let calling = false;
    const intercept: ConsoleFn = (...args: unknown[]) => {
      if (calling) return; // 自递归保险丝
      calling = true;
      try {
        current(...args);
      } finally {
        calling = false;
      }
      const serialized = safeSerialize(args);
      const entry: ConsoleLogEntry = {
        level,
        args: (serialized.ok ? serialized.data : []) as unknown[],
        time: Date.now(),
      };
      buffer.push(entry);
      if (buffer.length > capacity) buffer.shift();
      options.onLog?.(entry);
    };

    Object.defineProperty(target, level, {
      configurable: true,
      get: () => intercept,
      set: (fn: ConsoleFn) => {
        if (typeof fn !== 'function') return;
        if (fn === intercept) {
          // 第三方把经 getter 读到的 intercept 赋回来（restore）：弹回上一个原方法
          const prev = history.pop();
          if (prev) current = prev;
          return;
        }
        history.push(current);
        current = fn;
      },
    });

    restoreFns.push(() => {
      if (ownDescriptor) {
        Object.defineProperty(target, level, ownDescriptor);
      } else {
        delete target[level];
      }
    });
  }

  return {
    getLogs(filter) {
      let logs: ConsoleLogEntry[] = buffer;
      if (filter?.level) logs = logs.filter((l) => l.level === filter.level);
      const limit = filter?.limit;
      return limit ? logs.slice(-limit) : [...logs];
    },
    restore() {
      for (const fn of restoreFns) fn();
    },
  };
}
