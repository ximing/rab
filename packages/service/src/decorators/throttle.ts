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
      throw new TypeError(`@Throttle 装饰器只能用于方法，但 ${String(propertyKey)} 不是一个方法`);
    }

    const leading = options?.leading ?? true;
    const trailing = options?.trailing ?? true;

    // 状态必须按实例隔离：装饰器闭包在类定义时只执行一次，
    // 闭包变量是类级共享的——一个实例的调用会被另一个实例覆盖，
    // 一个实例 destroy 会取消所有实例的 pending 调用（#220）
    interface ThrottleState {
      lastInvokeTime: number;
      timerId: ReturnType<typeof setTimeout> | null;
      lastArgs: any[];
      lastThis: any;
      result: any;
    }
    const instanceStates = new WeakMap<object, ThrottleState>();
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
    const getState = (instance: any): ThrottleState => {
      const key = stateKey(instance);
      let state = instanceStates.get(key);
      if (!state) {
        state = {
          lastInvokeTime: 0,
          timerId: null,
          lastArgs: [],
          lastThis: undefined,
          result: undefined,
        };
        instanceStates.set(key, state);
      }
      return state;
    };

    // 清理函数
    const cleanup = (state: ThrottleState) => {
      if (state.timerId !== null) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
      state.lastInvokeTime = 0;
      state.lastArgs = [];
      state.lastThis = undefined;
      state.result = undefined;
    };

    // 执行函数
    const invokeFunc = (state: ThrottleState) => {
      state.lastInvokeTime = Date.now();
      state.result = originalMethod.apply(state.lastThis, state.lastArgs);
      return state.result;
    };

    // 取消定时器
    const cancelTimer = (state: ThrottleState) => {
      if (state.timerId !== null) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
    };

    // 设置 trailing 定时器
    const startTimer = (state: ThrottleState) => {
      cancelTimer(state);
      if (trailing) {
        state.timerId = setTimeout(() => {
          state.timerId = null;
          if (Date.now() - state.lastInvokeTime >= wait) {
            invokeFunc(state);
          }
        }, wait);
      }
    };

    descriptor.value = function (this: any, ...args: any[]) {
      const state = getState(this);
      const now = Date.now();
      const timeSinceLastInvoke = now - state.lastInvokeTime;
      const isFirstCall = state.lastInvokeTime === 0;

      state.lastArgs = args;
      state.lastThis = this;

      // 首次调用
      if (isFirstCall) {
        if (leading) {
          state.result = invokeFunc(state);
        }
        startTimer(state);
        return state.result;
      }

      // 在时间窗口内
      if (timeSinceLastInvoke < wait) {
        // 更新 trailing 定时器
        startTimer(state);
        return state.result;
      }

      // 超过时间窗口，可以执行
      cancelTimer(state);
      state.result = invokeFunc(state);
      startTimer(state);
      return state.result;
    };

    // 将清理函数附加到实例上（按实例清理自己的状态）。
    // 连同清理哨兵键下的分离调用状态：该条目不属于任何实例，
    // 否则实例 destroy 后 pending 定时器仍会以 this=undefined 触发，
    // lastArgs 也被保留到进程结束（#250 引入的兜底键，清理由此兜底）。
    const cleanupMethodName = `__cleanup_throttle_${String(propertyKey)}`;
    Object.defineProperty(target, cleanupMethodName, {
      value: function (this: any) {
        const state = instanceStates.get(stateKey(this));
        if (state) {
          cleanup(state);
        }
        const detachedState = instanceStates.get(detachedStateKey);
        if (detachedState) {
          cleanup(detachedState);
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
      const cleanupMethodName = `__cleanup_throttle_${propertyName}`;
      if (typeof instance[cleanupMethodName] === 'function') {
        instance[cleanupMethodName]();
      }
    }
    current = Object.getPrototypeOf(current);
  }
}
