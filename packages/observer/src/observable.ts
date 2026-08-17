import { observable as internalObservable } from "./internals/observable";
import type { ObservableOptions } from "./internals/types";

/**
 * Creates an observable proxy for the given object.
 * The returned proxy will track property access and mutations.
 *
 * @param obj - The object to make observable
 * @returns An observable proxy of the object
 *
 * @example
 * ```typescript
 * const state = observable({ count: 0 });
 * observe(() => console.log(state.count)); // Will log when count changes
 * state.count++; // Triggers the observer
 * ```
 */
export function observable<T extends object>(
  obj: T,
  options?: ObservableOptions
): T;
export function observable<T extends object>(obj?: T): T | object;
export function observable<T extends object>(
  obj: T = {} as T,
  options?: ObservableOptions
): T {
  // #6: 此前 options 在这个公开包装层被丢弃, observable(raw, options) 的
  // 自定义 proxyHandlers/collectionHandlers/reactionHandlers 从未生效。
  // 原样透传给内部实现。
  return internalObservable(obj, options);
}
