/**
 * Throttle 装饰器配置选项
 */
export interface ThrottleOptions {
  /**
   * 时间窗口（毫秒）
   */
  wait: number;
  /**
   * 是否在时间窗口开始时立即执行
   * @default true
   */
  leading?: boolean;
  /**
   * 是否在时间窗口结束时执行最后一次调用
   * @default true
   */
  trailing?: boolean;
}

/**
 * Throttle 装饰器，用于节流处理方法调用
 * 在指定时间窗口内，最多执行一次函数
 *
 * @param wait - 时间窗口（毫秒）
 * @param options - 配置选项
 *
 * @example
 * ```typescript
 * class ScrollService extends Service {
 *   @Throttle(200)
 *   handleScroll(event: Event) {
 *     // 每 200ms 最多执行一次
 *     console.log('Scroll position:', window.scrollY);
 *   }
 *
 *   @Throttle(1000, { leading: false, trailing: true })
 *   saveData(data: any) {
 *     // 时间窗口结束时执行最后一次调用
 *     return fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
 *   }
 *
 *   destroy() {
 *     // 清理所有 Throttle 定时器
 *     cleanupAllThrottles(this);
 *   }
 * }
 * ```
 */
export function Throttle(wait: number, options?: Omit<ThrottleOptions, 'wait'>): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(`@Throttle 装饰器只能用于方法，但 ${String(propertyKey)} 不是一个方法`);
    }

    const leading = options?.leading ?? true;
    const trailing = options?.trailing ?? true;

    // 使用闭包存储状态
    let lastInvokeTime = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: any[] = [];
    let lastThis: any;
    let result: any;

    // 清理函数
    const cleanup = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      lastInvokeTime = 0;
      lastArgs = [];
      lastThis = undefined;
      result = undefined;
    };

    descriptor.value = function (this: any, ...args: any[]) {
      const now = Date.now();
      const timeSinceLastInvoke = now - lastInvokeTime;
      const isFirstCall = lastInvokeTime === 0;

      lastArgs = args;
      lastThis = this;

      // 执行函数
      const invokeFunc = () => {
        lastInvokeTime = Date.now();
        result = originalMethod.apply(lastThis, lastArgs);
        return result;
      };

      // 取消定时器
      const cancelTimer = () => {
        if (timerId !== null) {
          clearTimeout(timerId);
          timerId = null;
        }
      };

      // 设置 trailing 定时器
      const startTimer = () => {
        cancelTimer();
        if (trailing) {
          timerId = setTimeout(() => {
            timerId = null;
            if (Date.now() - lastInvokeTime >= wait) {
              invokeFunc();
            }
          }, wait);
        }
      };

      // 首次调用
      if (isFirstCall) {
        if (leading) {
          result = invokeFunc();
        }
        startTimer();
        return result;
      }

      // 在时间窗口内
      if (timeSinceLastInvoke < wait) {
        // 更新 trailing 定时器
        startTimer();
        return result;
      }

      // 超过时间窗口，可以执行
      cancelTimer();
      result = invokeFunc();
      startTimer();
      return result;
    };

    // 将清理函数附加到实例上
    const cleanupMethodName = `__cleanup_throttle_${String(propertyKey)}`;
    Object.defineProperty(target, cleanupMethodName, {
      value: cleanup,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    return descriptor;
  };
}

/**
 * 手动清理指定方法的 Throttle 定时器
 * 用于需要手动控制清理的场景
 *
 * @param instance - Service 实例
 * @param propertyKey - 方法名
 *
 * @example
 * ```typescript
 * class ScrollService extends Service {
 *   @Throttle(200)
 *   handleScroll(event: Event) {
 *     console.log('Scroll position:', window.scrollY);
 *   }
 *
 *   stopScrollHandling() {
 *     cancelThrottle(this, 'handleScroll');
 *   }
 * }
 * ```
 */
export function cancelThrottle(instance: any, propertyKey: string | symbol): void {
  const cleanupMethodName = `__cleanup_throttle_${String(propertyKey)}`;
  if (typeof instance[cleanupMethodName] === 'function') {
    instance[cleanupMethodName]();
  }
}

/**
 * 清理实例上所有 Throttle 装饰器的定时器
 * 通常在 Service 销毁时调用
 *
 * @param instance - Service 实例
 *
 * @example
 * ```typescript
 * class ScrollService extends Service {
 *   @Throttle(200)
 *   handleScroll(event: Event) {
 *     console.log('Scroll position:', window.scrollY);
 *   }
 *
 *   @Throttle(1000)
 *   saveData(data: any) {
 *     return fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
 *   }
 *
 *   destroy() {
 *     cleanupAllThrottles(this);
 *   }
 * }
 * ```
 */
export function cleanupAllThrottles(instance: any): void {
  const proto = Object.getPrototypeOf(instance);
  const propertyNames = Object.getOwnPropertyNames(proto);

  propertyNames.forEach(propertyName => {
    const cleanupMethodName = `__cleanup_throttle_${propertyName}`;
    if (typeof instance[cleanupMethodName] === 'function') {
      instance[cleanupMethodName]();
    }
  });
}
