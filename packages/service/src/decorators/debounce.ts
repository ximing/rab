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
      throw new TypeError(`@Debounce 装饰器只能用于方法，但 ${String(propertyKey)} 不是一个方法`);
    }

    const leading = options?.leading ?? false;
    const trailing = options?.trailing ?? true;
    const maxWait = options?.maxWait;

    // 状态必须按实例隔离：装饰器闭包在类定义时只执行一次，
    // 闭包变量是类级共享的——一个实例的调用会被另一个实例覆盖，
    // 一个实例 destroy 会取消所有实例的 pending 调用（#220）
    interface DebounceState {
      timerId: ReturnType<typeof setTimeout> | null;
      lastCallTime: number;
      lastInvokeTime: number;
      lastArgs: any[];
      lastThis: any;
      result: any;
    }
    const instanceStates = new WeakMap<object, DebounceState>();
    // 分离调用（this 为 null/undefined 或原始值，如 arr.map(service.save)、
    // 解构出来的方法、装饰在普通类上）不能作为 WeakMap 键——否则会抛
    // TypeError: Invalid value used as weak map key。退回到共享的哨兵键：
    // 所有分离调用共用一份状态，与 WeakMap 重构（#220）前类级闭包共享
    // 一份状态的行为一致（#250）
    const detachedStateKey = {};
    const stateKey = (instance: any): object =>
      instance !== null && (typeof instance === 'object' || typeof instance === 'function')
        ? instance
        : detachedStateKey;
    const getState = (instance: any): DebounceState => {
      const key = stateKey(instance);
      let state = instanceStates.get(key);
      if (!state) {
        state = {
          timerId: null,
          lastCallTime: 0,
          lastInvokeTime: 0,
          lastArgs: [],
          lastThis: undefined,
          result: undefined,
        };
        instanceStates.set(key, state);
      }
      return state;
    };

    // 清理函数
    const cleanup = (state: DebounceState) => {
      if (state.timerId !== null) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
      state.lastCallTime = 0;
      state.lastInvokeTime = 0;
      state.lastArgs = [];
      state.lastThis = undefined;
      state.result = undefined;
    };

    // 取消定时器
    const cancelTimer = (state: DebounceState) => {
      if (state.timerId !== null) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
    };

    // 执行函数
    const invokeFunc = (state: DebounceState) => {
      state.lastInvokeTime = Date.now();
      state.result = originalMethod.apply(state.lastThis, state.lastArgs);
      return state.result;
    };

    // 设置延迟执行
    const startTimer = (state: DebounceState) => {
      cancelTimer(state);
      state.timerId = setTimeout(() => {
        state.timerId = null;
        if (trailing) {
          invokeFunc(state);
        }
      }, wait);
    };

    descriptor.value = function (this: any, ...args: any[]) {
      const state = getState(this);
      const now = Date.now();
      const timeSinceLastCall = now - state.lastCallTime;
      const timeSinceLastInvoke = now - state.lastInvokeTime;

      state.lastCallTime = now;
      state.lastArgs = args;
      state.lastThis = this;

      // 判断是否应该立即执行
      const shouldInvoke =
        state.lastInvokeTime === 0 || // 首次调用
        timeSinceLastCall >= wait || // 距离上次调用超过 wait 时间
        (maxWait !== undefined && timeSinceLastInvoke >= maxWait); // 超过最大等待时间

      // 首次调用且 leading 为 true
      if (shouldInvoke && leading && state.lastInvokeTime === 0) {
        state.lastInvokeTime = now;
        state.result = invokeFunc(state);
        startTimer(state);
        return state.result;
      }

      // 超过最大等待时间，强制执行
      if (maxWait !== undefined && shouldInvoke) {
        cancelTimer(state);
        state.result = invokeFunc(state);
        startTimer(state);
        return state.result;
      }

      // 正常防抖逻辑
      startTimer(state);
      return state.result;
    };

    // 将清理函数附加到实例上（按实例清理自己的状态）
    const cleanupMethodName = `__cleanup_debounce_${String(propertyKey)}`;
    Object.defineProperty(target, cleanupMethodName, {
      value: function (this: any) {
        const state = instanceStates.get(stateKey(this));
        if (state) {
          cleanup(state);
        }
      },
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
  // 沿原型链上溯：装饰器成员可能定义在任意基类上，只扫直接原型
  // 会漏掉继承的清理方法（#221）
  const seen = new Set<string>();
  let current = Object.getPrototypeOf(instance);
  while (current && current !== Object.prototype) {
    for (const propertyName of Object.getOwnPropertyNames(current)) {
      if (seen.has(propertyName)) {
        continue;
      }
      seen.add(propertyName);
      const cleanupMethodName = `__cleanup_debounce_${propertyName}`;
      if (typeof instance[cleanupMethodName] === 'function') {
        instance[cleanupMethodName]();
      }
    }
    current = Object.getPrototypeOf(current);
  }
}
