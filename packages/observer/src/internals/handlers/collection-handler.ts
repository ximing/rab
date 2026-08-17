import { observableChild } from "../observable-child";
import { proxyToRaw } from "../proxy-raw-map";
import {
  registerRunningReactionForOperation,
  queueReactionsForOperation,
  hasOperationOldValueConsumer,
} from "../reaction-runner";
import {
  Collection,
  CollectionHandlers,
  IteratorResult,
  PatchableIterator,
} from "../types";
import { toRawIfProxy } from "../utils";

/*
 * #7/#9: 集合身份判定不能只靠 instanceof ——
 *   - Map/Set 子类 (class MyMap extends Map) 同 realm 下 instanceof 成立,
 *     但自定义了 Symbol.toStringTag 的子类 tag 会变, 两者取或集最稳;
 *   - 跨 realm 的 Map (vm.runInNewContext / iframe / RN 远程调试) 的
 *     instanceof 本 realm 构造函数不成立, 但 Object.prototype.toString
 *     的 tag 跨 realm 一致 ('[object Map]')。
 * */
const objectToString = Object.prototype.toString;

export function isMapTarget(target: object): target is Map<unknown, unknown> {
  return target instanceof Map || objectToString.call(target) === "[object Map]";
}

export function isSetTarget(target: object): target is Set<unknown> {
  return target instanceof Set || objectToString.call(target) === "[object Set]";
}

export function isWeakMapTarget(
  target: object
): target is WeakMap<object, unknown> {
  return (
    target instanceof WeakMap ||
    objectToString.call(target) === "[object WeakMap]"
  );
}

export function isWeakSetTarget(target: object): target is WeakSet<object> {
  return (
    target instanceof WeakSet ||
    objectToString.call(target) === "[object WeakSet]"
  );
}

export function isAnyCollectionTarget(target: object): target is Collection {
  return (
    isMapTarget(target) ||
    isSetTarget(target) ||
    isWeakMapTarget(target) ||
    isWeakSetTarget(target)
  );
}

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
    // 解包: 依赖注册与集合查找都必须使用 raw 身份
    key = toRawIfProxy(key);
    // this 是 observable(Proxy),需要获取原始的 Map/Set
    const target = proxyToRaw.get(this);
    if (!target || !isAnyCollectionTarget(target)) {
      return false;
    }
    // 建立 (target.key -> reaction) 的依赖
    registerRunningReactionForOperation({
      target,
      key: key as PropertyKey,
      type: "has",
    });
    // 调用原始 Map/Set 的 has 方法
    return target.has(key as object);
  },
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
      type: "get",
    });
    return observableChild(target.get(key as object), target);
  },
  add(this: Collection, key: unknown): Collection {
    // 解包: Set 的 key 就是 value, 存储与通知都必须使用 raw 身份
    key = toRawIfProxy(key);
    const target = proxyToRaw.get(this);
    if (!target || !(isSetTarget(target) || isWeakSetTarget(target))) {
      return this;
    }
    const hadKey = (target as Set<unknown> | WeakSet<object>).has(
      key as object
    );
    // forward the operation before queueing reactions
    (target as Set<unknown> | WeakSet<object>).add(key as object);
    if (!hadKey) {
      queueReactionsForOperation({
        target,
        key: key as PropertyKey,
        value: key,
        type: "add",
      });
    }
    return this;
  },
  set(this: Collection, key: unknown, value: unknown): Collection {
    // 解包: key 决定存储/依赖身份, value 必须以 raw 落盘 (与 base set trap 对齐)。
    // 注意由此推导的迭代语义: key 以 raw 身份落盘, keys()/entries() 迭代返回的
    // 是 raw 而非传入的 proxy (value 侧经 observableChild 包装保持 proxy 身份,
    // key 侧不包装 —— 不对称但与 Vue 3 一致, Vue 也不包装 key;
    // 见 keys() 处 TODO 与 collection-unwrap-iteration-and-shadow.test.ts 的 pin)。
    key = toRawIfProxy(key);
    value = toRawIfProxy(value);
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isWeakMapTarget(target))) {
      return this;
    }
    const hadKey = (
      target as Map<unknown, unknown> | WeakMap<object, unknown>
    ).has(key as object);
    const oldValue = (target as Map<unknown, unknown>).get
      ? (target as Map<unknown, unknown>).get(key)
      : undefined;
    // forward the operation before queueing reactions
    (target as Map<unknown, unknown> | WeakMap<object, unknown>).set(
      key as object,
      value
    );
    if (!hadKey) {
      queueReactionsForOperation({
        target,
        key: key as PropertyKey,
        value,
        type: "add",
      });
    } else if (!Object.is(value, oldValue)) {
      queueReactionsForOperation({
        target,
        key: key as PropertyKey,
        value,
        oldValue,
        type: "set",
      });
    }
    return this;
  },
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
      target as
        | Map<unknown, unknown>
        | Set<unknown>
        | WeakMap<object, unknown>
        | WeakSet<object>
    ).delete(key as object);
    if (hadKey) {
      queueReactionsForOperation({
        target,
        key: key as PropertyKey,
        oldValue,
        type: "delete",
      });
    }
    return result;
  },
  clear(this: Collection): void {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return;
    }
    const hadItems = target.size > 0;
    // #10: oldValue 的全量拷贝 (new Map(target)) 是热路径 O(n) 开销, 而 oldValue
    // 的唯一消费者是 reaction.debugger (如 @rabjs/react 的 debuggerReaction)。
    // 仅当本次 clear 的操作真的会到达某个 debugger 时才付拷贝成本;
    // debugger 收到的语义不变 —— 仍是 clear 前的内容拷贝。
    const operation = { target, key: "" as PropertyKey, type: "clear" as const };
    let oldTarget: Map<unknown, unknown> | Set<unknown> | undefined;
    if (hadItems && hasOperationOldValueConsumer(operation)) {
      oldTarget = isMapTarget(target)
        ? new Map(target)
        : new Set(target);
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
  forEach(
    this: Collection,
    callback: (
      value: unknown,
      key: unknown,
      map: Map<unknown, unknown>
    ) => void,
    thisArg?: unknown
  ): void {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return;
    }
    registerRunningReactionForOperation({
      target,
      key: "" as PropertyKey,
      type: "iterate",
    });
    // 将回调参数中的值转换为 observable
    // 确保用户在回调中访问的是响应式的值
    const wrappedCallback = (value: unknown, key: unknown): void =>
      callback(
        observableChild(value, target),
        key,
        target as Map<unknown, unknown>
      );
    (target as Map<unknown, unknown> | Set<unknown>).forEach(
      wrappedCallback as any,
      thisArg
    );
  },
  keys(this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({
      target,
      key: "" as PropertyKey,
      type: "iterate",
    });
    // TODO: 考虑一下是否需要 patchIterator  对比 vue Reactive Mobx 看一下大家是怎么决策的
    // 现状（有意的不对称, G5 审查 issue #5 留档）: 集合内部只存 raw 身份,
    // values()/Symbol.iterator/entries 的 value 半边经 patchIterator 包装为
    // observable, 而 keys()/entries 的 key 半边直接返回 raw —— 用户在 reaction
    // 里 [...m.keys()] 后直接读 key 对象属性将不被追踪。与 Vue 3 (reactive 的
    // key 不包装) 一致; 若未来决定对齐 values 的深度语义, 需另行评估通知面。
    // 行为由 collection-unwrap-iteration-and-shadow.test.ts:123 pin 住。
    return target.keys() as IterableIterator<unknown>;
  },
  values(this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({
      target,
      key: "" as PropertyKey,
      type: "iterate",
    });
    const iterator = target.values() as PatchableIterator<unknown>;
    return patchIterator(iterator, target, false) as IterableIterator<unknown>;
  },
  entries(this: Collection): IterableIterator<[unknown, unknown]> {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return [][Symbol.iterator]() as IterableIterator<[unknown, unknown]>;
    }
    registerRunningReactionForOperation({
      target,
      key: "" as PropertyKey,
      type: "iterate",
    });
    const iterator = target.entries() as PatchableIterator<[unknown, unknown]>;
    return patchIterator(iterator, target, true) as IterableIterator<
      [unknown, unknown]
    >;
  },
  [Symbol.iterator](this: Collection): IterableIterator<unknown> {
    const target = proxyToRaw.get(this);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return [][Symbol.iterator]();
    }
    registerRunningReactionForOperation({
      target,
      key: "" as PropertyKey,
      type: "iterate",
    });
    const iterator = target[Symbol.iterator]() as PatchableIterator<unknown>;
    return patchIterator(
      iterator,
      target,
      isMapTarget(target)
    ) as IterableIterator<unknown>;
  },
  get size(): number {
    // In getter context, 'this' refers to the proxy (Collection instance)
    // 我们需要正确地转换它以访问proxyToRaw
    const self = this as unknown as Collection;
    const target = proxyToRaw.get(self);
    if (!target || !(isMapTarget(target) || isSetTarget(target))) {
      return 0;
    }
    // 迭代依赖
    registerRunningReactionForOperation({
      target,
      key: "" as PropertyKey,
      type: "iterate",
    });
    return target.size;
  },
};

export const createCollectionProxyHandlers = (
  customCollectionHandlers?: CollectionHandlers
) => {
  return {
    get(target: object, key: PropertyKey, receiver: unknown): unknown {
      // instrument methods and property accessors to be reactive

      // First check custom handlers, then fall back to default collectionHandlers
      // const handlersToCheck = customCollectionHandlers || collectionHandlers;

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

const defaultProxyHandlers: ProxyHandler<object> =
  createCollectionProxyHandlers();

const globalObj: Record<string, unknown> = (
  typeof globalThis.window === "object"
    ? globalThis
    : new Function("return this")()
) as Record<string, unknown>;

// Type for handler values
type HandlerValue = ProxyHandler<object> | false;

/*
 * #7/#9: 集合路由改为按 Object.prototype.toString 的 tag 判定:
 *   - 子类 (class MyMap extends Map) 继承父类 tag, constructor 精确匹配会漏;
 *   - 跨 realm 集合的 tag 与本 realm 一致, constructor 比较会漏。
 * */
const collectionHandlersByTag = new Map<string, HandlerValue>([
  ["[object Map]", defaultProxyHandlers],
  ["[object Set]", defaultProxyHandlers],
  ["[object WeakMap]", defaultProxyHandlers],
  ["[object WeakSet]", defaultProxyHandlers],
]);

/*
 * #9: 内置对象黑名单 —— 这些对象的方法依赖内部槽位 (internal slots),
 * 以 Proxy 为 receiver 调用会抛 "this is not a Date object." /
 * "incompatible receiver" 之类的错误, 不可包装。
 * 用 tag 而不是 constructor.name in globalObj 判定: 跨 realm 的内置对象
 * (vm.runInNewContext / iframe / RN 远程调试) 的 constructor 不等于本
 * realm 的全局构造函数, 旧检测会把它们误判为可包装。
 * (子类同样继承 tag, 如 class MyDate extends Date 也安全落入黑名单。)
 * 注意: typed array 不在黑名单 —— 它们与普通数组一样走 base proxy handler
 * (索引读写经 Reflect 转发可用), 保持既有行为。
 * */
const nonInstrumentableTags = new Set([
  "[object Date]",
  "[object RegExp]",
  "[object Error]",
  "[object Promise]",
  "[object ArrayBuffer]",
  "[object SharedArrayBuffer]",
  "[object DataView]",
  "[object WeakRef]",
  "[object FinalizationRegistry]",
  "[object String]",
  "[object Number]",
  "[object Boolean]",
  "[object Symbol]",
  "[object BigInt]",
  "[object Generator]",
  "[object Map Iterator]",
  "[object Set Iterator]",
  "[object Array Iterator]",
  "[object String Iterator]",
  "[object RegExp String Iterator]",
  "[object Module]",
  "[object WebAssembly.Module]",
  "[object WebAssembly.Instance]",
  "[object WebAssembly.Memory]",
  "[object WebAssembly.Table]",
  "[object WebAssembly.Global]",
  "[object WebAssembly.Tag]",
  "[object WebAssembly.Exception]",
]);

// these stateful built-in objects can and should be wrapped by Proxies if they are part of a store
// simple ones - like arrays - ar wrapped with the normal observable Proxy
// complex ones - like Map and Set - are wrapped with a Proxy of instrumented methods
const handlers = new Map<Function, HandlerValue>([
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
  // functions are first-class observables in this system
  if (typeof obj === "function") {
    return true;
  }

  // #7/#9: 集合 (含子类与跨 realm 实例) 按 tag 路由到 instrumented 方法
  const tag = objectToString.call(obj);
  if (collectionHandlersByTag.has(tag)) {
    return true;
  }

  // #9: 依赖内部槽位的内置对象 (含跨 realm) 按 tag 拒绝包装
  if (nonInstrumentableTags.has(tag)) {
    return false;
  }

  const { constructor } = obj as { constructor: Function };

  // objects in the above handlers array are safe to instrument
  if (handlers.has(constructor)) {
    return true;
  }

  // other same-realm built-in objects should not be instrumented
  const isBuiltIn =
    typeof constructor === "function" &&
    constructor.name in globalObj &&
    globalObj[constructor.name] === constructor;
  return !isBuiltIn;
}

export function getHandlers(obj: object): HandlerValue {
  // #7/#9: tag 命中 (子类/跨 realm 同样命中) 时路由到集合 handlers
  const tagHandlers = collectionHandlersByTag.get(objectToString.call(obj));
  if (tagHandlers) {
    return tagHandlers;
  }
  const constructor = (obj as { constructor?: Function }).constructor;
  return constructor ? handlers.get(constructor) || false : false;
}
