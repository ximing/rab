/**
 * Throttle 装饰器配置选项
 */
import {
  createInstanceStateStore,
  findAllCleanups,
  registerInstanceStateCleanups,
  runAllCleanupsWithDetached,
} from './cleanup-registry';

/**
 * throttle 清理注册表的 prototype 键（实现见 cleanup-registry.ts —
 * 以真实 propertyKey 为键，避免字符串化方法名的 symbol 撞名/漏扫）
 */
const THROTTLE_CLEANUPS = Symbol('__rabjs_throttle_cleanups__');

/**
 * 分离调用（detached）共享状态的清理注册表，与按实例清理分表：
 * cancelThrottle(instance, key) 是单实例语义，只查 THROTTLE_CLEANUPS；
 * detached 兜底清理由 cleanupAllThrottles（destroy 路径）额外跑本表。
 */
const THROTTLE_DETACHED_CLEANUPS = Symbol('__rabjs_throttle_detached_cleanups__');

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

    // 状态必须按实例隔离（#220）；分离调用落到共享哨兵状态（#250）。
    // 存储与清理注册的共用实现见 cleanup-registry.ts
    interface ThrottleState {
      lastInvokeTime: number;
      timerId: ReturnType<typeof setTimeout> | null;
      lastArgs: any[];
      lastThis: any;
      result: any;
      /**
       * 上次 invoke 之后是否有新调用到来。invokeFunc 在 finally 中清空
       * lastArgs/lastThis（释放 payload 引用），trailing 定时器据此判断
       * 该不该补一刀 —— 否则 leading/窗口过期的立即执行后，定时器会以
       * undefined this、空参数幽灵重放用户方法。
       */
      hasPendingCall: boolean;
    }
    const states = createInstanceStateStore<ThrottleState>(() => ({
      lastInvokeTime: 0,
      timerId: null,
      lastArgs: [],
      lastThis: undefined,
      result: undefined,
      hasPendingCall: false,
    }));

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
      state.hasPendingCall = false;
    };

    // 执行函数
    const invokeFunc = (state: ThrottleState) => {
      state.lastInvokeTime = Date.now();
      // 快照本次 invoke 消费的 pending 身份：finally 的引用释放只在
      // 「invoke 期间没有更新的调用写入」时才安全 —— 用户方法体内重入
      // 调用会写入新的 lastArgs/lastThis 并武装自己的定时器，无差别
      // 清理会让那笔重入调用被静默丢弃（定时器空转）。
      const invokedArgs = state.lastArgs;
      const invokedThis = state.lastThis;
      try {
        state.result = originalMethod.apply(state.lastThis, state.lastArgs);
      } finally {
        // 触发后即释放对参数/this 的引用：detached 哨兵状态由装饰器闭包
        // 强引用、进程级驻留，不清理会把用户 payload 保留到进程结束。
        // result 保留 —— 窗口内的后续调用按节流语义返回最近一次的结果。
        if (state.lastArgs === invokedArgs && state.lastThis === invokedThis) {
          state.lastArgs = [];
          state.lastThis = undefined;
          // 消费掉 pending 标记：trailing 定时器只补「invoke 之后的新调用」
          state.hasPendingCall = false;
        } else if (!trailing && state.timerId === null) {
          // 重入写入的新 pending 在 trailing:false 下永远不会执行
          // （startTimer 不武装），没有定时器到点释放兜底 —— 立即释放，
          // 别把 payload 钉到下一次 invoke
          state.lastArgs = [];
          state.lastThis = undefined;
          state.hasPendingCall = false;
        }
      }
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
          if (state.hasPendingCall && Date.now() - state.lastInvokeTime >= wait) {
            invokeFunc(state);
          } else {
            // 到点未触发（时钟未走过窗口：legacy fake timers / 系统时钟回拨）：
            // 该 pending 按现有语义被丢弃（不重排），但必须释放 payload 引用
            state.lastArgs = [];
            state.lastThis = undefined;
            state.hasPendingCall = false;
          }
        }, wait);
      }
    };

    descriptor.value = function (this: any, ...args: any[]) {
      const state = states.get(this);
      const now = Date.now();
      const timeSinceLastInvoke = now - state.lastInvokeTime;
      const isFirstCall = state.lastInvokeTime === 0;

      state.lastArgs = args;
      state.lastThis = this;
      state.hasPendingCall = true;

      // 首次调用
      if (isFirstCall) {
        if (leading) {
          state.result = invokeFunc(state);
        }
        startTimer(state);
        if (!trailing && !leading) {
          // leading/trailing 都关闭：该调用永远不会执行，立即释放 payload
          state.lastArgs = [];
          state.lastThis = undefined;
          state.hasPendingCall = false;
        }
        return state.result;
      }

      // 在时间窗口内
      if (timeSinceLastInvoke < wait) {
        // 更新 trailing 定时器
        startTimer(state);
        if (!trailing) {
          // trailing 关闭时窗口内调用永远不会执行 —— 立即释放 payload，
          // 不把引用钉到下一次 invoke
          state.lastArgs = [];
          state.lastThis = undefined;
          state.hasPendingCall = false;
        }
        return state.result;
      }

      // 超过时间窗口，可以执行
      cancelTimer(state);
      state.result = invokeFunc(state);
      startTimer(state);
      return state.result;
    };

    // 清理函数注册：实例状态进实例表（cancelThrottle 单实例语义），
    // detached 哨兵状态进 detached 表（仅 destroy 路径连带清理）。
    // 以真实 propertyKey 为键：字符串化方法名会让同 description 的
    // symbol 方法撞名，且 cleanupAll 的字符串扫描漏掉 symbol 键。
    registerInstanceStateCleanups(
      target,
      THROTTLE_CLEANUPS,
      THROTTLE_DETACHED_CLEANUPS,
      propertyKey,
      states,
      cleanup
    );

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
  // 全部装饰层都取消：子类重装饰同名方法时各层持有独立的 pending 定时器
  // （可能经 super 调用武装），只取消最近一层会让基类层到点幽灵触发
  for (const cleanup of findAllCleanups(instance, THROTTLE_CLEANUPS, propertyKey)) {
    cleanup.call(instance);
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
  // 会漏掉继承的清理函数（#221）；注册表以真实 propertyKey 为键，
  // symbol 键不再漏扫。destroy 语义连带清理分离调用的共享状态；
  // 单实例的 cancelThrottle 不查 detached 表
  runAllCleanupsWithDetached(instance, THROTTLE_CLEANUPS, THROTTLE_DETACHED_CLEANUPS);
}
