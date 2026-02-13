/**
 * Debounce 装饰器配置选项
 */
export interface DebounceOptions {
  /**
   * 延迟时间（毫秒）
   */
  wait: number;
  /**
   * 是否在延迟开始前调用函数
   * @default false
   */
  leading?: boolean;
  /**
   * 是否在延迟结束后调用函数
   * @default true
   */
  trailing?: boolean;
  /**
   * 最大等待时间（毫秒），超过此时间必须执行一次
   */
  maxWait?: number;
}

/**
 * Debounce 装饰器，用于防抖处理方法调用
 * 在连续触发时，只在最后一次触发后的指定时间执行
 *
 * @param wait - 延迟时间（毫秒）
 * @param options - 配置选项
 *
 * @example
 * ```typescript
 * class SearchService extends Service {
 *   @Debounce(300)
 *   search(keyword: string) {
 *     // 300ms 内多次调用只执行最后一次
 *     return fetch(`/api/search?q=${keyword}`);
 *   }
 *
 *   @Debounce(500, { leading: true, trailing: false })
 *   handleInput(value: string) {
 *     // 首次立即执行，后续调用被防抖
 *   }
 *
 *   destroy() {
 *     // 清理所有 Debounce 定时器
 *     cleanupAllDebounces(this);
 *   }
 * }
 * ```
 */
export function Debounce(wait: number, options?: Omit<DebounceOptions, 'wait'>): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(`@Debounce 装饰器只能用于方法，但 ${String(propertyKey)} 不是一个方法`);
    }

    const leading = options?.leading ?? false;
    const trailing = options?.trailing ?? true;
    const maxWait = options?.maxWait;

    // 使用闭包存储状态
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let lastCallTime = 0;
    let lastInvokeTime = 0;
    let lastArgs: any[] = [];
    let lastThis: any;
    let result: any;

    // 清理函数
    const cleanup = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      lastCallTime = 0;
      lastInvokeTime = 0;
      lastArgs = [];
      lastThis = undefined;
      result = undefined;
    };

    descriptor.value = function (this: any, ...args: any[]) {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;
      const timeSinceLastInvoke = now - lastInvokeTime;

      lastCallTime = now;
      lastArgs = args;
      lastThis = this;

      // 判断是否应该立即执行
      const shouldInvoke =
        lastInvokeTime === 0 || // 首次调用
        timeSinceLastCall >= wait || // 距离上次调用超过 wait 时间
        (maxWait !== undefined && timeSinceLastInvoke >= maxWait); // 超过最大等待时间

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

      // 设置延迟执行
      const startTimer = () => {
        cancelTimer();
        timerId = setTimeout(() => {
          timerId = null;
          if (trailing) {
            invokeFunc();
          }
        }, wait);
      };

      // 首次调用且 leading 为 true
      if (shouldInvoke && leading && lastInvokeTime === 0) {
        lastInvokeTime = now;
        result = invokeFunc();
        startTimer();
        return result;
      }

      // 超过最大等待时间，强制执行
      if (maxWait !== undefined && shouldInvoke) {
        cancelTimer();
        result = invokeFunc();
        startTimer();
        return result;
      }

      // 正常防抖逻辑
      startTimer();
      return result;
    };

    // 将清理函数附加到实例上
    const cleanupMethodName = `__cleanup_debounce_${String(propertyKey)}`;
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
 * 手动清理指定方法的 Debounce 定时器
 * 用于需要手动控制清理的场景
 *
 * @param instance - Service 实例
 * @param propertyKey - 方法名
 *
 * @example
 * ```typescript
 * class SearchService extends Service {
 *   @Debounce(300)
 *   search(keyword: string) {
 *     return fetch(`/api/search?q=${keyword}`);
 *   }
 *
 *   cancelSearch() {
 *     cancelDebounce(this, 'search');
 *   }
 * }
 * ```
 */
export function cancelDebounce(instance: any, propertyKey: string | symbol): void {
  const cleanupMethodName = `__cleanup_debounce_${String(propertyKey)}`;
  if (typeof instance[cleanupMethodName] === 'function') {
    instance[cleanupMethodName]();
  }
}

/**
 * 清理实例上所有 Debounce 装饰器的定时器
 * 通常在 Service 销毁时调用
 *
 * @param instance - Service 实例
 *
 * @example
 * ```typescript
 * class SearchService extends Service {
 *   @Debounce(300)
 *   search(keyword: string) {
 *     return fetch(`/api/search?q=${keyword}`);
 *   }
 *
 *   @Debounce(500)
 *   handleInput(value: string) {
 *     console.log(value);
 *   }
 *
 *   destroy() {
 *     cleanupAllDebounces(this);
 *   }
 * }
 * ```
 */
export function cleanupAllDebounces(instance: any): void {
  const proto = Object.getPrototypeOf(instance);
  const propertyNames = Object.getOwnPropertyNames(proto);

  propertyNames.forEach(propertyName => {
    const cleanupMethodName = `__cleanup_debounce_${propertyName}`;
    if (typeof instance[cleanupMethodName] === 'function') {
      instance[cleanupMethodName]();
    }
  });
}
