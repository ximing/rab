/**
 * Debounce 装饰器配置选项
 */
import {
  createInstanceStateStore,
  findAllCleanups,
  registerInstanceStateCleanups,
  runAllCleanupsWithDetached,
} from './cleanup-registry';

/**
 * debounce 清理注册表的 prototype 键（实现见 cleanup-registry.ts —
 * 以真实 propertyKey 为键，避免字符串化方法名的 symbol 撞名/漏扫）
 */
const DEBOUNCE_CLEANUPS = Symbol('__rabjs_debounce_cleanups__');

/**
 * 分离调用（detached）共享状态的清理注册表，与按实例清理分表：
 * cancelDebounce(instance, key) 是单实例语义，只查 DEBOUNCE_CLEANUPS；
 * detached 兜底清理由 cleanupAllDebounces（destroy 路径）额外跑本表。
 */
const DEBOUNCE_DETACHED_CLEANUPS = Symbol('__rabjs_debounce_detached_cleanups__');

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

    // 状态必须按实例隔离（#220）；分离调用落到共享哨兵状态（#250）。
    // 存储与清理注册的共用实现见 cleanup-registry.ts
    interface DebounceState {
      timerId: ReturnType<typeof setTimeout> | null;
      lastCallTime: number;
      lastInvokeTime: number;
      lastArgs: any[];
      lastThis: any;
      result: any;
      /**
       * 上次 invoke 之后是否有新调用到来。invokeFunc 在 finally 中清空
       * lastArgs/lastThis（释放 payload 引用），lastArgs.length 无法再区分
       * 「无参调用」与「已消费」，trailing 定时器据此判断该不该补一刀 ——
       * 否则 leading/maxWait 立即执行后，定时器会以 undefined this、空参数
       * 幽灵重放用户方法。
       */
      hasPendingCall: boolean;
    }
    const states = createInstanceStateStore<DebounceState>(() => ({
      timerId: null,
      lastCallTime: 0,
      lastInvokeTime: 0,
      lastArgs: [],
      lastThis: undefined,
      result: undefined,
      hasPendingCall: false,
    }));

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
      state.hasPendingCall = false;
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
        // result 保留 —— 窗口内的后续调用按防抖语义返回最近一次的结果。
        if (state.lastArgs === invokedArgs && state.lastThis === invokedThis) {
          state.lastArgs = [];
          state.lastThis = undefined;
          // 消费掉 pending 标记：trailing 定时器只补「invoke 之后的新调用」
          state.hasPendingCall = false;
        }
      }
      return state.result;
    };

    // 设置延迟执行
    const startTimer = (state: DebounceState) => {
      cancelTimer(state);
      state.timerId = setTimeout(() => {
        state.timerId = null;
        if (trailing && state.hasPendingCall) {
          invokeFunc(state);
        } else {
          // trailing 关闭（或无 pending）：这笔被抑制的调用按语义永远不会
          // 执行 —— 必须释放 payload 引用，否则实例状态把它钉到下一次
          // invoke，detached 哨兵状态更是驻留到进程结束
          state.lastArgs = [];
          state.lastThis = undefined;
          state.hasPendingCall = false;
        }
      }, wait);
    };

    descriptor.value = function (this: any, ...args: any[]) {
      const state = states.get(this);
      const now = Date.now();
      const timeSinceLastCall = now - state.lastCallTime;
      const timeSinceLastInvoke = now - state.lastInvokeTime;

      state.lastCallTime = now;
      state.lastArgs = args;
      state.lastThis = this;
      state.hasPendingCall = true;

      // 判断是否应该立即执行
      const shouldInvoke =
        state.lastInvokeTime === 0 || // 首次调用
        timeSinceLastCall >= wait || // 距离上次调用超过 wait 时间
        (maxWait !== undefined && timeSinceLastInvoke >= maxWait); // 超过最大等待时间

      // leading 边沿：每轮 burst 的首次调用（含实例生命周期的第一次）都
      // 立即执行 —— 门条件若只看 lastInvokeTime === 0，静默期后的新一轮
      // burst 只剩 trailing 兜底，trailing:false 时该调用被永久丢弃
      if (shouldInvoke && leading) {
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

    // 清理函数注册：实例状态进实例表（cancelDebounce 单实例语义），
    // detached 哨兵状态进 detached 表（仅 destroy 路径连带清理）。
    // 以真实 propertyKey 为键：字符串化方法名会让同 description 的
    // symbol 方法撞名，且 cleanupAll 的字符串扫描漏掉 symbol 键。
    registerInstanceStateCleanups(
      target,
      DEBOUNCE_CLEANUPS,
      DEBOUNCE_DETACHED_CLEANUPS,
      propertyKey,
      states,
      cleanup
    );

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
  // 全部装饰层都取消：子类重装饰同名方法时各层持有独立的 pending 定时器
  // （可能经 super 调用武装），只取消最近一层会让基类层到点幽灵触发
  for (const cleanup of findAllCleanups(instance, DEBOUNCE_CLEANUPS, propertyKey)) {
    cleanup.call(instance);
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
  // 会漏掉继承的清理函数（#221）；注册表以真实 propertyKey 为键，
  // symbol 键不再漏扫。destroy 语义连带清理分离调用的共享状态；
  // 单实例的 cancelDebounce 不查 detached 表
  runAllCleanupsWithDetached(instance, DEBOUNCE_CLEANUPS, DEBOUNCE_DETACHED_CLEANUPS);
}
