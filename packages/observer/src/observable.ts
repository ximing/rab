import { observable as internalObservable } from './internals/observable';

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
export function observable<T extends object>(obj: T): T;
export function observable<T extends object>(obj?: T): T | object;
export function observable<T extends object>(obj: T = {} as T): T {
  return internalObservable(obj);
}
