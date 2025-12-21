/**
 * UniversalFinalizationRegistry - 跨平台的 FinalizationRegistry 实现
 * 参考 mobx-react-lite 实现
 */

export declare class FinalizationRegistryType<T> {
  constructor(finalize: (value: T) => void);
  register(target: object, value: T, token?: object): void;
  unregister(token: object): void;
}

declare const FinalizationRegistry: typeof FinalizationRegistryType | undefined;

export const REGISTRY_FINALIZE_AFTER = 10_000;
export const REGISTRY_SWEEP_INTERVAL = 10_000;

/**
 * 基于定时器的 FinalizationRegistry 实现
 * 用于不支持原生 FinalizationRegistry 的环境
 */
export class TimerBasedFinalizationRegistry<T> implements FinalizationRegistryType<T> {
  private registrations: Map<unknown, { value: T; registeredAt: number }> = new Map();
  private sweepTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly finalize: (value: T) => void) {}

  // token 在此实现中实际上是必需的
  register(target: object, value: T, token?: object) {
    this.registrations.set(token, {
      value,
      registeredAt: Date.now(),
    });
    this.scheduleSweep();
  }

  unregister(token: unknown) {
    this.registrations.delete(token);
  }

  // 绑定以便可以直接用作 setTimeout 回调
  sweep = (maxAge = REGISTRY_FINALIZE_AFTER) => {
    // 取消超时，以便我们可以随时强制清理
    clearTimeout(this.sweepTimeout);
    this.sweepTimeout = undefined;

    const now = Date.now();
    this.registrations.forEach((registration, token) => {
      if (now - registration.registeredAt >= maxAge) {
        this.finalize(registration.value);
        this.registrations.delete(token);
      }
    });

    if (this.registrations.size > 0) {
      this.scheduleSweep();
    }
  };

  // 绑定以便可以直接导出为 clearTimers 测试工具
  finalizeAllImmediately = () => {
    this.sweep(0);
  };

  private scheduleSweep() {
    if (this.sweepTimeout === undefined) {
      this.sweepTimeout = setTimeout(this.sweep, REGISTRY_SWEEP_INTERVAL);
    }
  }
}

/**
 * 通用的 FinalizationRegistry
 * 优先使用原生实现，否则回退到基于定时器的实现
 */
export const UniversalFinalizationRegistry =
  typeof FinalizationRegistry !== 'undefined'
    ? FinalizationRegistry
    : TimerBasedFinalizationRegistry;
