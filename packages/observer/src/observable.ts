import { observable as internalObservable } from "./internals/observable";
import type { ObservableOptions } from "./internals/types";

/**
 * Creates an observable proxy for the given object.
 * The returned proxy will track property access and mutations.
 *
 * `options` 的语义（两轮对抗审查确认，刻意为之）:
 * - **per-raw 键控**: options 按传入的 raw 对象键控存储（而非按返回的代理）。
 *   同一 raw 对象无论通过哪个代理写入（含 `shadowObservable(raw)` 创建的浅层
 *   代理），通知期的 `reactionHandlers.transformReactions` 都会生效 —— 两种
 *   代理共享同一张 (raw, key) → reactions 连接表，通知期过滤器无法、也不应
 *   区分写入路径。如需隔离，请使用不同的 raw 对象。
 * - **首次写死**: options 仅在该 raw 首次创建 deep 代理时生效；此后对同一
 *   raw 再传不同 options 会命中缓存被静默忽略（first-wins）。
 *
 * @param obj - The object to make observable
 * @param options - Optional handlers; per-raw, first-wins (see above)
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
