import { observableChild } from '../observableChild';
import { proxyToRaw } from '../proxyRawMap';
import { registerRunningReactionForOperation, queueReactionsForOperation } from '../reactionRunner';
import { Collection, CollectionHandlers, IteratorResult, PatchableIterator } from '../types';

/*
 * 当你使用 Map 或 Set 的迭代器方法(如 values(), entries(), Symbol.iterator)时,这些方法返回的是一个迭代器对象。
 * 迭代器通过 next() 方法逐个返回集合中的值。
 * 如果不 patch 迭代器,迭代器返回的值是原始对象(raw object),而不是可观察对象(observable)。
 * patchIterator 是为了确保通过迭代器访问集合元素时,返回的嵌套对象也是可观察的,从而保持深度响应式的特性。
 * 这样无论用户如何访问数据(直接 get、forEach、还是迭代器),都能正确建立响应式依赖关系。
 * 包装返回值: 每次调用 next() 时,将返回的值通过 observableChild() 转换为可观察对象
 * 区分 entries: 对于 entries() 方法,需要特殊处理,因为它返回 [key, value] 对,只需要包装 value[1](值部分)
 * */
function patchIterator<T>(
  iterator: PatchableIterator<T>,
  target: Collection,
  isEntries: boolean
): PatchableIterator<T> {
  const originalNext = iterator.next;
  iterator.next = (): IteratorResult<T> => {
    // eslint-disable-next-line prefer-const
    let { done, value } = originalNext.call(iterator);
    if (!done) {
      if (isEntries) {
        // For entries iterator, value is [key, value] tuple
        (value as [unknown, unknown])[1] = observableChild(
          (value as [unknown, unknown])[1],
          target
        );
      } else {
        // For values iterator, wrap the value
        value = observableChild(value, target) as T;
      }
    }
    return { done, value };
  };
  return iterator;
}

// collectionHandlers.js 是响应式系统中处理集合类型(Map、Set、WeakMap、WeakSet)的核心模块,负责:
// 拦截集合操作: 拦截 Map/Set 的所有方法调用
// 建立依赖关系: 追踪 reactions 对集合元素的访问
// 触发 reactions: 当集合内容变化时,触发相关 reactions
// 深度响应式: 自动包装集合中的嵌套对象为 observable
// 迭代器处理: 特殊处理迭代器,确保返回的值是 observable
export const collectionHandlers = {
  // 作用: 拦截 map.has(key) 或 set.has(value) 操作,建立依赖关系。
  has(this: Collection, key: unknown): boolean {
    // this 是 observable(Proxy),需要获取原始的 Map/Set
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
  get(this: Collection, key: unknown): unknown {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof WeakMap)) {
      return undefined;
    }
    registerRunningReactionForOperation({ target, key: key as PropertyKey, type: 'get' });
    return observableChild(target.get(key as object), target);
  },
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
    // 将回调参数中的值转换为 observable
    // 确保用户在回调中访问的是响应式的值
    const wrappedCallback = (value: unknown, key: unknown): void =>
      callback(observableChild(value, target), key, target as Map<unknown, unknown>);
    (target as Map<unknown, unknown> | Set<unknown>).forEach(wrappedCallback as any, thisArg);
  },
  keys(this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    // TODO: 考虑一下是否需要 patchIterator  对比 vue Reactive Mobx 看一下大家是怎么决策的
    return target.keys() as IterableIterator<unknown>;
  },
  values(this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    const iterator = target.values() as PatchableIterator<unknown>;
    return patchIterator(iterator, target, false) as IterableIterator<unknown>;
  },
  entries(this: Collection): IterableIterator<[unknown, unknown]> {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return [][Symbol.iterator]() as IterableIterator<[unknown, unknown]>;
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    const iterator = target.entries() as PatchableIterator<[unknown, unknown]>;
    return patchIterator(iterator, target, true) as IterableIterator<[unknown, unknown]>;
  },
  [Symbol.iterator](this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(target instanceof Map || target instanceof Set)) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({ target, key: '' as PropertyKey, type: 'iterate' });
    const iterator = target[Symbol.iterator]() as PatchableIterator<unknown>;
    return patchIterator(iterator, target, target instanceof Map) as IterableIterator<unknown>;
  },
  get size(): number {
    // In getter context, 'this' refers to the proxy (Collection instance)
    // 我们需要正确地转换它以访问proxyToRaw
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

export const createCollectionProxyHandlers = (customCollectionHandlers?: CollectionHandlers) => {
  return {
    get(target: object, key: PropertyKey, receiver: unknown): unknown {
      // instrument methods and property accessors to be reactive

      // First check custom handlers, then fall back to default collectionHandlers
      const handlersToCheck = customCollectionHandlers || collectionHandlers;

      // Check if the key exists in custom handlers
      if (
        customCollectionHandlers &&
        Object.prototype.hasOwnProperty.call(customCollectionHandlers, key)
      ) {
        return Reflect.get(customCollectionHandlers, key, receiver);
      }

      // Check if the key exists in default collectionHandlers
      if (Object.prototype.hasOwnProperty.call(collectionHandlers, key)) {
        return Reflect.get(collectionHandlers, key, receiver);
      }

      // Otherwise, get from target
      return Reflect.get(target, key, receiver);
    },
  };
};

const defaultProxyHandlers: ProxyHandler<object> = createCollectionProxyHandlers();

const globalObj: Record<string, unknown> = (
  typeof window === 'object' ? window : Function('return this')()
) as Record<string, unknown>;

// Type for handler values
type HandlerValue = ProxyHandler<object> | false;

// these stateful built-in objects can and should be wrapped by Proxies if they are part of a store
// simple ones - like arrays - ar wrapped with the normal observable Proxy
// complex ones - like Map and Set - are wrapped with a Proxy of instrumented methods
const handlers = new Map<Function, HandlerValue>([
  [Map, defaultProxyHandlers],
  [Set, defaultProxyHandlers],
  [WeakMap, defaultProxyHandlers],
  [WeakSet, defaultProxyHandlers],
  [Object, false],
  [Array, false],
  [Int8Array, false],
  [Uint8Array, false],
  [Uint8ClampedArray, false],
  [Int16Array, false],
  [Uint16Array, false],
  [Int32Array, false],
  [Uint32Array, false],
  [Float32Array, false],
  [Float64Array, false],
]);

// some (usually stateless) built-in objects can not be and should not be wrapped by Proxies
// their methods expect the object instance as the receiver ('this') instead of the Proxy wrapper
// wrapping them and calling their methods causes erros like: "TypeError: this is not a Date object."
export function shouldInstrument(obj: object | Function): boolean {
  const { constructor } = obj as { constructor: Function };

  // functions and objects in the above handlers array are safe to instrument
  if (typeof obj === 'function' || handlers.has(constructor)) {
    return true;
  }

  // other built-in objects should not be implemented
  const isBuiltIn =
    typeof constructor === 'function' &&
    constructor.name in globalObj &&
    globalObj[constructor.name] === constructor;
  return !isBuiltIn;
}

export function getHandlers(obj: object): HandlerValue {
  const { constructor } = obj as { constructor: Function };
  return handlers.get(constructor) || false;
}
