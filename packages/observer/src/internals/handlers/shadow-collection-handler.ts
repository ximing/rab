import { proxyToRaw } from '../proxy-raw-map';
import {
  registerRunningReactionForOperation,
  queueReactionsForOperation,
  hasOperationOldValueConsumer,
} from '../reaction-runner';
import type { Collection, CollectionHandlers, IteratorResult, PatchableIterator } from '../types';
import { toRawIfProxy } from '../utils';

import {
  isAnyCollectionTarget,
  isMapTarget,
  isPlainMapOrSetTarget,
  isSetTarget,
  isWeakMapTarget,
  isWeakSetTarget,
} from './collection-handler';

/*
 * 浅层集合处理器 - 用于 Map、Set、WeakMap、WeakSet
 * 与 collectionHandlers 的区别：
 * - collectionHandlers: 返回的值会被包装为 observable（深层响应式）
 * - shadowCollectionHandlers: 返回的值不会被包装，直接返回原始值（浅层响应式）
 *
 * 这样可以保持浅层响应式的特性：
 * - 集合本身的操作（add、set、delete、clear）会触发 reactions
 * - 但集合中的嵌套对象不会被转换为 observable
 *
 * 注意（浅层语义的明确后果）：set/add 会把传入的 observable proxy 解包为
 * raw 落盘，get/迭代因此返回 raw 而非存入的 proxy —— 用户经返回值直接变更
 * 完全绕过 trap，不会被追踪（无任何通知）。需要响应式嵌套值时应使用
 * deep 集合（collectionHandlers 经 observableChild 命中缓存 proxy，往返
 * 身份保持）。该行为由 collection-unwrap-iteration-and-shadow.test.ts pin 住。
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
    // 解包: 依赖注册与集合查找都必须使用 raw 身份
    key = toRawIfProxy(key);
    const target = proxyToRaw.get(this);
    if (!target || !isAnyCollectionTarget(target)) {
      return false;
    }
    // 建立 (target.key -> reaction) 的依赖
    registerRunningReactionForOperation({
      target,
      key: key as PropertyKey,
      type: 'has',
    });
    // 调用原始 Map/Set 的 has 方法
    return target.has(key as object);
  },

  // 拦截 map.get(key) 操作，建立依赖关系但不包装返回值
  get(this: Collection, key: unknown): unknown {
    // 解包: 依赖注册与集合查找都必须使用 raw 身份
    key = toRawIfProxy(key);
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isWeakMapTarget(target))) {
      return undefined;
    }
    registerRunningReactionForOperation({
      target,
      key: key as PropertyKey,
      type: 'get',
    });
    // 关键区别：直接返回原始值，不通过 observableChild 包装
    return target.get(key as object);
  },

  // 拦截 set.add(value) 操作
  add(this: Collection, key: unknown): Collection {
    // 解包: Set 的 key 就是 value, 存储与通知都必须使用 raw 身份
    key = toRawIfProxy(key);
    const target = proxyToRaw.get(this);
    if (!target || !(isSetTarget(target) || isWeakSetTarget(target))) {
      return this;
    }
    const hadKey = (target as Set<unknown> | WeakSet<object>).has(key as object);
    // forward the operation before queueing reactions
    (target as Set<unknown> | WeakSet<object>).add(key as object);
    if (!hadKey) {
      queueReactionsForOperation({
        target,
        key: key as PropertyKey,
        value: key,
        type: 'add',
      });
    }
    return this;
  },

  // 拦截 map.set(key, value) 操作
  set(this: Collection, key: unknown, value: unknown): Collection {
    // 解包: key 决定存储/依赖身份, value 必须以 raw 落盘
    key = toRawIfProxy(key);
    value = toRawIfProxy(value);
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isWeakMapTarget(target))) {
      return this;
    }
    const hadKey = (target as Map<unknown, unknown> | WeakMap<object, unknown>).has(key as object);
    const oldValue = (target as Map<unknown, unknown>).get
      ? (target as Map<unknown, unknown>).get(key)
      : undefined;
    // forward the operation before queueing reactions
    (target as Map<unknown, unknown> | WeakMap<object, unknown>).set(key as object, value);
    if (!hadKey) {
      queueReactionsForOperation({
        target,
        key: key as PropertyKey,
        value,
        type: 'add',
      });
    } else if (!Object.is(value, oldValue)) {
      queueReactionsForOperation({
        target,
        key: key as PropertyKey,
        value,
        oldValue,
        type: 'set',
      });
    }
    return this;
  },

  // 拦截 delete 操作
  delete(this: Collection, key: unknown): boolean {
    // 解包: 删除与通知都必须使用与存储一致的 raw 身份
    key = toRawIfProxy(key);
    const target = proxyToRaw.get(this);
    if (!target || !isAnyCollectionTarget(target)) {
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
      queueReactionsForOperation({
        target,
        key: key as PropertyKey,
        oldValue,
        type: 'delete',
      });
    }
    return result;
  },

  // 拦截 clear 操作
  clear(this: Collection): void {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return;
    }
    const hadItems = target.size > 0;
    // #10: 同 collectionHandlers.clear —— oldValue 拷贝仅在存在 debugger
    // 消费者时才做, 语义不变 (clear 前内容拷贝)。
    // 子类覆写 clear() 的 TOCTOU 窗口 (GG7 第 2 轮 issue #7) 同样保守:
    // constructor 非 Map/Set 时始终拷贝, 详见 collection-handler.ts 注释。
    const operation = { target, key: '' as PropertyKey, type: 'clear' as const };
    let oldTarget: Map<unknown, unknown> | Set<unknown> | undefined;
    if (hadItems && (!isPlainMapOrSetTarget(target) || hasOperationOldValueConsumer(operation))) {
      oldTarget = isMapTarget(target) ? new Map(target) : new Set(target);
    }
    // forward the operation before queueing reactions
    target.clear();
    if (hadItems) {
      queueReactionsForOperation({
        ...operation,
        oldValue: oldTarget,
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
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return;
    }
    registerRunningReactionForOperation({
      target,
      key: '' as PropertyKey,
      type: 'iterate',
    });
    // 浅层：value/key 仍是 raw。第三参必须是 proxy（this），否则经
    // map.set 写入 raw 绕过 trap（issue #191）。thisArg 用 call 转发。
    const observed = this;
    (target as Map<unknown, unknown> | Set<unknown>).forEach((value: unknown, key: unknown) => {
      callback.call(thisArg, value, key, observed as Map<unknown, unknown>);
    });
  },

  // 拦截 keys 操作
  keys(this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({
      target,
      key: '' as PropertyKey,
      type: 'iterate',
    });
    return target.keys() as IterableIterator<unknown>;
  },

  // 拦截 values 操作
  values(this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({
      target,
      key: '' as PropertyKey,
      type: 'iterate',
    });
    const iterator = target.values() as PatchableIterator<unknown>;
    // 使用 shadowPatchIterator 不包装返回值
    return shadowPatchIterator(iterator, target, false) as IterableIterator<unknown>;
  },

  // 拦截 entries 操作
  entries(this: Collection): IterableIterator<[unknown, unknown]> {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return [][Symbol.iterator]() as IterableIterator<[unknown, unknown]>;
    }
    registerRunningReactionForOperation({
      target,
      key: '' as PropertyKey,
      type: 'iterate',
    });
    const iterator = target.entries() as PatchableIterator<[unknown, unknown]>;
    // 使用 shadowPatchIterator 不包装返回值
    return shadowPatchIterator(iterator, target, true) as IterableIterator<[unknown, unknown]>;
  },

  // 拦截 Symbol.iterator 操作
  [Symbol.iterator](this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({
      target,
      key: '' as PropertyKey,
      type: 'iterate',
    });
    const iterator = target[Symbol.iterator]() as PatchableIterator<unknown>;
    // 使用 shadowPatchIterator 不包装返回值
    return shadowPatchIterator(iterator, target, isMapTarget(target)) as IterableIterator<unknown>;
  },

  // 拦截 size 属性访问
  get size(): number {
    const self = this as unknown as Collection;
    const target = proxyToRaw.get(self);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return 0;
    }
    // 迭代依赖
    registerRunningReactionForOperation({
      target,
      key: '' as PropertyKey,
      type: 'iterate',
    });
    return target.size;
  },
};
