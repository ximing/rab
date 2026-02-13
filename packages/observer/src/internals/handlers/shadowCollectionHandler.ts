import { proxyToRaw } from '../proxyRawMap';
import { registerRunningReactionForOperation, queueReactionsForOperation } from '../reactionRunner';
import type { Collection, CollectionHandlers, IteratorResult, PatchableIterator } from '../types';

/*
 * 浅层集合处理器 - 用于 Map、Set、WeakMap、WeakSet
 * 与 collectionHandlers 的区别：
 * - collectionHandlers: 返回的值会被包装为 observable（深层响应式）
 * - shadowCollectionHandlers: 返回的值不会被包装，直接返回原始值（浅层响应式）
 *
 * 这样可以保持浅层响应式的特性：
 * - 集合本身的操作（add、set、delete、clear）会触发 reactions
 * - 但集合中的嵌套对象不会被转换为 observable
 * */

/*
 * 浅层迭代器补丁 - 不包装返回值
 * 与 patchIterator 的区别：
 * - patchIterator: 通过 observableChild 包装返回值
 * - shadowPatchIterator: 直接返回原始值
 * */
function shadowPatchIterator<T>(
  iterator: PatchableIterator<T>,
  target: Collection,
  isEntries: boolean
): PatchableIterator<T> {
  const originalNext = iterator.next;
  iterator.next = (): IteratorResult<T> => {
    // eslint-disable-next-line prefer-const
    let { done, value } = originalNext.call(iterator);
    // 关键区别：不进行包装，直接返回原始值
    // 这样保持浅层特性
    return { done, value };
  };
  return iterator;
}

export const shadowCollectionHandlers: CollectionHandlers = {
  // 拦截 map.has(key) 或 set.has(value) 操作，建立依赖关系
  has(this: Collection, key: unknown): boolean {
    const target = proxyToRaw.get(this);
    if (
      !target ||
      !(
        target instanceof Map ||
        target instanceof Set ||
        target instanceof WeakMap ||
        target instanceof WeakSet
      )
    ) {
      return false;
    }
    // 建立 (target.key -> reaction) 的依赖
    registerRunningReactionForOperation({ target, key: key as PropertyKey, type: 'has' });
    // 调用原始 Map/Set 的 has 方法
    return target.has(key as object);
  },

  // 拦截 map.get(key) 操作，建立依赖关系但不包装返回值
  get(this: Collection, key: unknown): unknown {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof WeakMap)) {
      return undefined;
    }
    registerRunningReactionForOperation({ target, key: key as PropertyKey, type: 'get' });
    // 关键区别：直接返回原始值，不通过 observableChild 包装
    return target.get(key as object);
  },

  // 拦截 set.add(value) 操作
  add(this: Collection, key: unknown): Collection {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Set || target instanceof WeakSet)) {
      return this;
    }
    const hadKey = (target as Set<unknown> | WeakSet<object>).has(key as object);
    // forward the operation before queueing reactions
    (target as Set<unknown> | WeakSet<object>).add(key as object);
    if (!hadKey) {
      queueReactionsForOperation({ target, key: key as PropertyKey, value: key, type: 'add' });
    }
    return this;
  },

  // 拦截 map.set(key, value) 操作
  set(this: Collection, key: unknown, value: unknown): Collection {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof WeakMap)) {
      return this;
    }
    const hadKey = (target as Map<unknown, unknown> | WeakMap<object, unknown>).has(key as object);
    const oldValue = (target as Map<unknown, unknown>).get
      ? (target as Map<unknown, unknown>).get(key)
      : undefined;
    // forward the operation before queueing reactions
    (target as Map<unknown, unknown> | WeakMap<object, unknown>).set(key as object, value);
    if (!hadKey) {
      queueReactionsForOperation({ target, key: key as PropertyKey, value, type: 'add' });
    } else if (value !== oldValue) {
      queueReactionsForOperation({ target, key: key as PropertyKey, value, oldValue, type: 'set' });
    }
    return this;
  },

  // 拦截 delete 操作
  delete(this: Collection, key: unknown): boolean {
    const target = proxyToRaw.get(this);
    if (
      !target ||
      !(
        target instanceof Map ||
        target instanceof Set ||
        target instanceof WeakMap ||
        target instanceof WeakSet
      )
    ) {
      return false;
    }
    const hadKey = (target as Map<unknown, unknown> | Set<unknown>).has
      ? (target as Map<unknown, unknown> | Set<unknown>).has(key)
      : false;
    const oldValue = (target as Map<unknown, unknown>).get
      ? (target as Map<unknown, unknown>).get(key)
      : undefined;
    // forward the operation before queueing reactions
    const result = (
      target as Map<unknown, unknown> | Set<unknown> | WeakMap<object, unknown> | WeakSet<object>
    ).delete(key as object);
    if (hadKey) {
      queueReactionsForOperation({ target, key: key as PropertyKey, oldValue, type: 'delete' });
    }
    return result;
  },

  // 拦截 clear 操作
  clear(this: Collection): void {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return;
    }
    const hadItems = target.size !== 0;
    const oldTarget = target instanceof Map ? new Map(target) : new Set(target);
    // forward the operation before queueing reactions
    target.clear();
    if (hadItems) {
      queueReactionsForOperation({
        target,
        key: '' as PropertyKey,
        oldValue: oldTarget,
        type: 'clear',
      });
    }
  },

  // 拦截 forEach 操作
  forEach(
    this: Collection,
    callback: (value: unknown, key: unknown, map: Map<unknown, unknown>) => void,
    thisArg?: unknown
  ): void {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return;
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    // 关键区别：不包装回调参数中的值，直接传递原始值
    (target as Map<unknown, unknown> | Set<unknown>).forEach(callback as any, thisArg);
  },

  // 拦截 keys 操作
  keys(this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    return target.keys() as IterableIterator<unknown>;
  },

  // 拦截 values 操作
  values(this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    const iterator = target.values() as PatchableIterator<unknown>;
    // 使用 shadowPatchIterator 不包装返回值
    return shadowPatchIterator(iterator, target, false) as IterableIterator<unknown>;
  },

  // 拦截 entries 操作
  entries(this: Collection): IterableIterator<[unknown, unknown]> {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return [][Symbol.iterator]() as IterableIterator<[unknown, unknown]>;
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    const iterator = target.entries() as PatchableIterator<[unknown, unknown]>;
    // 使用 shadowPatchIterator 不包装返回值
    return shadowPatchIterator(iterator, target, true) as IterableIterator<[unknown, unknown]>;
  },

  // 拦截 Symbol.iterator 操作
  [Symbol.iterator](this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    const iterator = target[Symbol.iterator]() as PatchableIterator<unknown>;
    // 使用 shadowPatchIterator 不包装返回值
    return shadowPatchIterator(
      iterator,
      target,
      target instanceof Map
    ) as IterableIterator<unknown>;
  },

  // 拦截 size 属性访问
  get size(): number {
    const self = this as unknown as Collection;
    const target = proxyToRaw.get(self);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return 0;
    }
    // 迭代依赖
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    return target.size;
  },
};
