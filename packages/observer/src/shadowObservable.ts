import { getHandlers, shouldInstrument } from './internals/handlers/collectionHandler';
import { shadowCollectionHandlers } from './internals/handlers/shadowCollectionHandler';
import { shadowProxyHandler } from './internals/handlers/shadowProxyHandler';
import { proxyToRaw, rawToProxy } from './internals/proxyRawMap';
import { storeObservable } from './internals/reactionTrack';
import type { ProxyHandlers } from './internals/types';

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
 * @param options - 可选的配置选项
 * @returns 浅层响应式代理对象
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

      // 否则，从 target 获取（但不要获取 Map/Set 的原生方法，因为它们需要特殊的 this 绑定）
      // 对于 Map/Set 的原生方法，我们应该返回 undefined 或抛出错误
      // 但是为了兼容性，我们返回 undefined
      return undefined;
    },
  };
}

export function createShadowObservable<T extends object>(obj: T): T {
  // 获取对象类型对应的处理器（对于集合类型会返回 defaultProxyHandlers）
  const handlers = getHandlers(obj);

  let mergedHandlers: ProxyHandlers;

  // 如果是集合类型，需要使用 shadowCollectionHandlers
  if (handlers) {
    // 对于集合类型，创建一个特殊的 get handler 来支持 shadowCollectionHandlers
    mergedHandlers = createShadowCollectionProxyHandlers() as ProxyHandlers;
  } else {
    // 对于普通对象，直接使用 shadowProxyHandler
    mergedHandlers = { ...shadowProxyHandler };
  }

  const observableProxy = new Proxy(obj, mergedHandlers as ProxyHandler<T>);

  rawToProxy.set(obj, observableProxy);
  proxyToRaw.set(observableProxy, obj);

  // init basic data structures to save and cleanup later (observable.prop -> reaction) connections
  storeObservable(obj);
  return observableProxy as T;
}
