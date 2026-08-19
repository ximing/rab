import {
  getHandlers,
  shouldInstrument,
  isBuiltinCollectionPrototypeMethod,
  forwardBuiltinCollectionMethod,
} from './internals/handlers/collection-handler';
import { shadowCollectionHandlers } from './internals/handlers/shadow-collection-handler';
import { shadowProxyHandler } from './internals/handlers/shadow-proxy-handler';
import { proxyToRaw, rawToProxy } from './internals/proxy-raw-map';
import { storeObservable } from './internals/reaction-track';
import type { ProxyHandlers } from './internals/types';
import { normalizeCollectionEntries } from './internals/utils';

/**
 * 创建一个浅层响应式代理对象
 * 只在根级别提供响应式能力，不会对嵌套对象进行深层转换
 * 属性的值会被原样存储和暴露
 *
 * 实现原理：通过向 observable 传递自定义的 shadowProxyHandler 和 shadowCollectionHandlers 来实现
 * shadowProxyHandler 的关键区别是 get trap 不会对嵌套对象进行深层包装
 * shadowCollectionHandlers 的关键区别是不会对集合中的值进行包装
 *
 * @param obj - 要转换为浅层响应式的对象
 * @returns 浅层响应式代理对象
 *
 * **与 `observable(raw)` 共享底层状态的语义**（两轮对抗审查确认，刻意为之）:
 * - 同一 raw 对象可以同时存在本函数返回的 shadow 代理与 `observable(raw)`
 *   返回的 deep 代理（缓存按深度模式分桶），但两者共享同一张
 *   (raw, key) → reactions 连接表：任一代理的写入都会通知在另一个代理上
 *   建立的 reaction。
 * - 本函数不接收也不写 options；若同一 raw 存在带
 *   `reactionHandlers.transformReactions` 的 deep 代理，则**通过本代理写入
 *   的通知也会经过该 transform**（options 按 raw 键控，见 `observable` 的
 *   JSDoc）。如需隔离，请使用不同的 raw 对象。
 *
 * @example
 * ```typescript
 * // 普通对象
 * const state = shadowObservable({ user: { name: 'John' }, count: 0 });
 * observe(() => {
 *   console.log(state.count); // 响应式
 *   console.log(state.user.name); // 不响应式，user 对象本身不是 observable
 * });
 * state.count++; // 触发 observer
 * state.user.name = 'Jane'; // 不触发 observer（user 对象的属性变化不被追踪）
 * state.user = { name: 'Jane' }; // 触发 observer（根级别属性变化）
 *
 * // Map/Set 集合
 * const map = shadowObservable(new Map([['key', { value: 1 }]]));
 * observe(() => {
 *   console.log(map.size); // 响应式
 * });
 * map.set('key2', { value: 2 }); // 触发 observer
 * const val = map.get('key'); // 返回原始对象，不是 observable
 * val.value = 2; // 不触发 observer（嵌套对象的属性变化不被追踪）
 * ```
 */
export function shadowObservable<T extends object>(obj: T): T;
export function shadowObservable<T extends object>(obj?: T): T | object;
export function shadowObservable<T extends object>(obj: T = {} as T): T {
  // if it is already an observable or it should not be wrapped, return it
  if (proxyToRaw.has(obj) || !shouldInstrument(obj)) {
    return obj;
  }
  // if it already has a cached observable wrapper, return it
  // otherwise create a new shadow observable
  return (rawToProxy.get(obj) as T) || createShadowObservable(obj);
}

/**
 * 为 shadowCollectionHandlers 创建一个特殊的 get handler
 * 确保只使用 shadowCollectionHandlers 中的方法，不会回退到 collectionHandlers
 */
function createShadowCollectionProxyHandlers() {
  return {
    get(target: object, key: PropertyKey, receiver: unknown): unknown {
      // 只检查 shadowCollectionHandlers 中的方法
      if (
        shadowCollectionHandlers &&
        Object.prototype.hasOwnProperty.call(shadowCollectionHandlers, key)
      ) {
        // 直接返回 shadowCollectionHandlers 中的属性
        // 对于 getter（如 size），需要使用 Reflect.get 来正确调用 getter
        const descriptor = Object.getOwnPropertyDescriptor(shadowCollectionHandlers, key);
        if (descriptor && descriptor.get) {
          // 这是一个 getter，需要使用 Reflect.get 来调用它，并传入 receiver 作为 this
          return Reflect.get(shadowCollectionHandlers, key, receiver);
        }
        // 这是一个普通属性或方法，直接返回
        return (shadowCollectionHandlers as unknown as Record<PropertyKey, unknown>)[key];
      }

      // 否则，从 target 原生获取 (constructor / toString / Symbol.toStringTag 等)。
      // 修复: 之前这里返回 undefined, 导致 map.constructor === undefined、
      // String(map) 抛 TypeError, duck-typing 检测和序列化全挂。
      const value = Reflect.get(target, key, receiver);
      // GG7 对抗审查第 2 轮 issue #6: 未知 key 的函数不能一律 bind 到 raw ——
      // 集合子类的自定义方法 (如 putTwice 内部 this.set) 一旦 bind(raw),
      // 其变更会走原生 Map.prototype.set, 静默绕过全部 trap (数据变了、
      // reaction 不通知)。改为以 proxy 为 receiver 调用 (与 deep 模式的
      // 语义一致): 自定义方法内的 this.set 走 instrumented trap。
      // GG7 第 3 轮 issue #1/#4 修正: 恰为内置集合原型成员的函数 (ES2024
      // Set 方法 union/intersection/... 未在 shadowCollectionHandlers 中)
      // 依赖内部槽位, 以 proxy 为 receiver 会抛 "incompatible receiver"
      // —— 这类纯只读原生方法以 raw target 为 receiver 转发 (变更类原生
      // 方法均已 instrumented, 不存在静默绕过)。用户自定义方法不在内置
      // 原型上, 判定不命中, 保持 proxy receiver。
      // constructor 除外: 保持 map.constructor === Map 的恒等性。
      if (
        typeof value === 'function' &&
        key !== 'constructor' &&
        isBuiltinCollectionPrototypeMethod(key, value)
      ) {
        return forwardBuiltinCollectionMethod(target, value as (...args: unknown[]) => unknown);
      }
      if (typeof value === 'function' && key !== 'constructor') {
        const fn = value as (this: unknown, ...args: unknown[]) => unknown;
        return function (this: unknown, ...args: unknown[]): unknown {
          return Reflect.apply(fn, receiver, args);
        };
      }
      return value;
    },
  };
}

export function createShadowObservable<T extends object>(obj: T): T {
  // 集合在包装前已有的 proxy key/value 条目统一归一化为 raw
  // （不变量『集合内部只持有 raw 身份』，详见 utils.normalizeCollectionEntries）
  normalizeCollectionEntries(obj);
  // 获取对象类型对应的处理器（对于集合类型会返回 defaultProxyHandlers）
  const handlers = getHandlers(obj);

  // 如果是集合类型，需要使用 shadowCollectionHandlers
  const mergedHandlers: ProxyHandlers = handlers
    ? (createShadowCollectionProxyHandlers() as ProxyHandlers) // 对于集合类型，创建一个特殊的 get handler 来支持 shadowCollectionHandlers
    : { ...shadowProxyHandler }; // 对于普通对象，直接使用 shadowProxyHandler

  const observableProxy = new Proxy(obj, mergedHandlers as ProxyHandler<T>);

  rawToProxy.set(obj, observableProxy);
  proxyToRaw.set(observableProxy, obj);

  // init basic data structures to save and cleanup later (observable.prop -> reaction) connections
  storeObservable(obj);
  return observableProxy as T;
}
