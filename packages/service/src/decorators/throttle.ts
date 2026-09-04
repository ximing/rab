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
      /**
       * 方法体正在执行中。重入调用不得同步嵌套 invoke（防栈溢出），
       * 降级为记录 pending + 武装 trailing 定时器。
       */
      invoking: boolean;
    }
    const states = createInstanceStateStore<ThrottleState>(() => ({
      lastInvokeTime: 0,
      timerId: null,
      lastArgs: [],
      lastThis: undefined,
      result: undefined,
      hasPendingCall: false,
      invoking: false,
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

    // 取消定时器
    const cancelTimer = (state: ThrottleState) => {
      if (state.timerId !== null) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
    };

    // 释放 pending 调用的 payload 引用（args/this + pending 标记）。
    // 被抑制/已消费的调用必须及时释放：实例状态把 payload 钉到下一次
    // invoke，detached 哨兵状态更是驻留到进程结束
    const releasePayload = (state: ThrottleState) => {
      state.lastArgs = [];
      state.lastThis = undefined;
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
      state.invoking = true;
      try {
        state.result = originalMethod.apply(state.lastThis, state.lastArgs);
      } finally {
        state.invoking = false;
        // result 保留 —— 窗口内的后续调用按节流语义返回最近一次的结果
        if (state.lastArgs === invokedArgs && state.lastThis === invokedThis) {
          // 消费掉 pending 标记：trailing 定时器只补「invoke 之后的新调用」
          releasePayload(state);
        } else if (!trailing && state.timerId === null) {
          // 重入写入的新 pending 在 trailing:false 下永远不会执行
          // （startTimer 不武装），没有定时器到点释放兜底 —— 立即释放，
          // 别把 payload 钉到下一次 invoke
          releasePayload(state);
        }
      }
      return state.result;
    };

    // 设置 trailing 定时器
    const startTimer = (state: ThrottleState) => {
      // 已有 pending 定时器时不重排：节流窗口以「武装时刻」为界，若每次
      // 窗口内调用都把定时器顺延一个 wait，间隔 < wait 的持续调用流会让
      // 定时器永远不到点 —— leading:false 时方法被无限期饿死。
      // 窗口过期/首次调用路径已先行 cancelTimer/invoke，timerId 为 null，
      // 这里才武装新窗口。
      if (state.timerId !== null) {
        return;
      }
      if (trailing) {
        state.timerId = setTimeout(() => {
          state.timerId = null;
          // wait 由 setTimeout 本身保证。不要再用 Date.now()-lastInvokeTime
          // 复检：定时器略早触发、时钟回拨、或 Date.now 被冻结时，那次
          // 比较会把窗口内最后一次调用静默丢掉。leading 立即执行后若无
          // 新调用，hasPendingCall 已是 false，不会双触发。
          if (state.hasPendingCall) {
            invokeFunc(state);
          } else {
            releasePayload(state);
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

      // 方法体内重入：不得同步嵌套 invoke（wait:0 / 窗口恰好在执行期内
      // 过期时会无限同步递归直至栈溢出）—— 降级为记录 pending，由
      // trailing 定时器补刀（trailing:false 时由 invokeFunc 的 finally
      // 释放 payload）
      if (state.invoking) {
        startTimer(state);
        return state.result;
      }

      // 首次调用
      if (isFirstCall) {
        if (leading) {
          state.result = invokeFunc(state);
        }
        startTimer(state);
        if (!trailing && !leading) {
          // leading/trailing 都关闭：该调用永远不会执行，立即释放 payload
          releasePayload(state);
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
          releasePayload(state);
        }
        return state.result;
      }

      // 超过时间窗口：leading 开启才允许同步执行（leading:false 的任何
      // 调用都不得同步执行 —— 由 trailing 定时器到点补刀）
      if (leading) {
        cancelTimer(state);
        state.result = invokeFunc(state);
        startTimer(state);
      } else {
        // 已有 trailing 定时器时不得 cancel 再重排：定时器以「武装时刻 + wait」
        // 为截止，武装发生在 lastInvoke 之后，因此 lastInvoke+wait 到
        // 武装+wait 之间的调用都会落入本分支；每次 cancel + 重排一个完整
        // wait，持续调用流会把截止永远推到「下一次调用 + wait」，首次
        // trailing 之后方法再也不执行。startTimer 在 timerId 非空时是空操作。
        startTimer(state);
      }
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
