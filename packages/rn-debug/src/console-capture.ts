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

/**
 * 用访问器属性 patch console：后续对 console[level] 的再赋值
 * （测试、RN polyfill、其他工具都可能这样做）只会替换“当前原方法”，
 * 拦截本身不被覆盖。restore 时还原为 patch 前的属性描述符。
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
    const ownDescriptor = Object.getOwnPropertyDescriptor(target, level);
    const proto = Object.getPrototypeOf(target) as Record<string, ConsoleFn> | null;
    const protoDescriptor = proto ? Object.getOwnPropertyDescriptor(proto, level) : undefined;
    const descriptor = ownDescriptor ?? protoDescriptor;
    let current: ConsoleFn = descriptor!.value.bind(target);

    const intercept: ConsoleFn = (...args: unknown[]) => {
      // 先调原方法，不改变原 console 行为
      current(...args);
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
        if (typeof fn === 'function') current = fn;
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
