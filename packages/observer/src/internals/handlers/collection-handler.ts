import { observableChild } from '../observable-child';
import { proxyToRaw } from '../proxy-raw-map';
import {
  registerRunningReactionForOperation,
  queueReactionsForOperation,
  hasOperationOldValueConsumer,
} from '../reaction-runner';
import { Collection, CollectionHandlers, IteratorResult, PatchableIterator } from '../types';
import { toRawIfProxy } from '../utils';

/*
 * #7/#9: 集合身份判定不能只靠 instanceof ——
 *   - Map/Set 子类 (class MyMap extends Map) 同 realm 下 instanceof 成立,
 *     但自定义了 Symbol.toStringTag 的子类 tag 会变, 两者取或集最稳;
 *   - 跨 realm 的 Map (vm.runInNewContext / iframe / RN 远程调试) 的
 *     instanceof 本 realm 构造函数不成立, 但 Object.prototype.toString
 *     的 tag 跨 realm 一致 ('[object Map]')。
 * */
const objectToString = Object.prototype.toString;

/*
 * 模块加载时捕获本 realm 的真实 Map/Set 构造函数: clear 的 TOCTOU
 * 保守分支 (issue #7) 判 plain 集合时若在调用点解析全局绑定, 测试/用户
 * 对 globalThis.Map 的临时替换 (如 copy-construction spy) 会把 plain Map
 * 误判为子类而多付拷贝。
 * GG7 第 3 轮 issue #3: 判定改用 `Object.getPrototypeOf(target) ===
 * RealXxxConstructor.prototype` —— 不再裸读 target.constructor (自有
 * throwing 'constructor' accessor 会让 clear() 抛用户 getter 的异常),
 * 且原型不可伪造: 子类实例的直接原型是子类 prototype, 永不等于内置
 * prototype。跨 realm plain Map 的原型是远 realm 的 Map.prototype,
 * 被保守判为非 plain → clear 始终拷贝 (仅损失该场景的 #10 惰性优化,
 * 无正确性影响)。
 * */
const RealMapPrototype = Map.prototype;
const RealSetPrototype = Set.prototype;

export function isPlainMapOrSetTarget(target: object): boolean {
  const proto = Object.getPrototypeOf(target);
  return proto === RealMapPrototype || proto === RealSetPrototype;
}

export function isMapTarget(target: object): target is Map<unknown, unknown> {
  return target instanceof Map || objectToString.call(target) === '[object Map]';
}

export function isSetTarget(target: object): target is Set<unknown> {
  return target instanceof Set || objectToString.call(target) === '[object Set]';
}

export function isWeakMapTarget(target: object): target is WeakMap<object, unknown> {
  return target instanceof WeakMap || objectToString.call(target) === '[object WeakMap]';
}

export function isWeakSetTarget(target: object): target is WeakSet<object> {
  return target instanceof WeakSet || objectToString.call(target) === '[object WeakSet]';
}

export function isAnyCollectionTarget(target: object): target is Collection {
  return (
    isMapTarget(target) || isSetTarget(target) || isWeakMapTarget(target) || isWeakSetTarget(target)
  );
}

/*
 * 当你使用 Map 或 Set 的迭代器方法(如 values(), entries(), Symbol.iterator)时,这些方法返回的是一个迭代器对象。
 * 迭代器通过 next() 方法逐个返回集合中的值。
 * 如果不 patch 迭代器,迭代器返回的值是原始对象(raw object),而不是可观察对象(observable)。
 * patchIterator 是为了确保通过迭代器访问集合元素时,返回的嵌套对象也是可观察的,从而保持深度响应式的特性。
 * 这样无论用户如何访问数据(直接 get、forEach、还是迭代器),都能正确建立响应式依赖关系。
 * 包装返回值: 每次调用 next() 时,将返回的值通过 observableChild() 转换为可观察对象
 *   - value: values() / Set.keys() / Set 默认迭代
 *   - map-entries: Map.entries() / Map 默认迭代 —— 只包装 value 半边, key 保持 raw (G5)
 *   - set-entries: Set.entries() —— 两侧包成同一 child, 保持原生 k === v (#192)
 * */
type IteratorWrapMode = 'value' | 'map-entries' | 'set-entries';

function patchIterator<T>(
  iterator: PatchableIterator<T>,
  target: Collection,
  mode: IteratorWrapMode
): PatchableIterator<T> {
  const originalNext = iterator.next;
  iterator.next = (): IteratorResult<T> => {
    // eslint-disable-next-line prefer-const
    let { done, value } = originalNext.call(iterator);
    if (!done) {
      if (mode === 'map-entries') {
        (value as [unknown, unknown])[1] = observableChild(
          (value as [unknown, unknown])[1],
          target
        );
      } else if (mode === 'set-entries') {
        const tuple = value as [unknown, unknown];
        const wrapped = observableChild(tuple[0], target);
        tuple[0] = wrapped;
        tuple[1] = wrapped;
      } else {
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
      type: 'has',
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
      type: 'get',
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
    // GG7 第 2 轮 issue #7 (TOCTOU 窗口): 子类可以覆写 clear() 并在
    // super.clear() 之前注册新的 debugger reaction —— 该 reaction 落在
    // hasOperationOldValueConsumer 检查之后、queue 之前, 会被通知但拿不到
    // 拷贝。plain Map/Set 没有用户代码能在这个窗口运行, 维持惰性检查;
    // constructor 非 Map/Set 的 (子类 / 跨 realm) 保守视为有消费者, 始终拷贝。
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
    // 原生 forEach 是 Call(callback, thisArg, «value, key, this»)。
    // 箭头包装会丢掉 thisArg；第三参必须是 proxy（this），否则经 map.set
    // 写入 raw 绕过 trap（issue #191）。value 仍经 observableChild 包装。
    const observed = this;
    (target as Map<unknown, unknown> | Set<unknown>).forEach((value: unknown, key: unknown) => {
      const wrappedValue = observableChild(value, target);
      // Set 的 key 就是 value, 两侧必须是同一包装 (#192); Map 的 key 保持 raw (G5)
      const wrappedKey = isSetTarget(target) ? wrappedValue : key;
      callback.call(thisArg, wrappedValue, wrappedKey, observed as Map<unknown, unknown>);
    });
  },
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
    // Map keys 保持 raw (G5, 与 Vue 3 一致)。Set 的 key 就是 value,
    // 必须与 values() 包成同一 child, 否则破坏原生 keys===values (#192)。
    if (isSetTarget(target)) {
      const iterator = target.keys() as PatchableIterator<unknown>;
      return patchIterator(iterator, target, 'value') as IterableIterator<unknown>;
    }
    return target.keys() as IterableIterator<unknown>;
  },
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
    return patchIterator(iterator, target, 'value') as IterableIterator<unknown>;
  },
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
    const mode: IteratorWrapMode = isSetTarget(target) ? 'set-entries' : 'map-entries';
    return patchIterator(iterator, target, mode) as IterableIterator<[unknown, unknown]>;
  },
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
    // Map 默认迭代是 entries; Set 默认迭代是 values
    const mode: IteratorWrapMode = isMapTarget(target) ? 'map-entries' : 'value';
    return patchIterator(iterator, target, mode) as IterableIterator<unknown>;
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
      key: '' as PropertyKey,
      type: 'iterate',
    });
    return target.size;
  },
};

/*
 * GG7 第 3 轮 issue #1/#4: ES2024 Set 方法 (union/intersection/difference/
 * symmetricDifference/isSubsetOf/isSupersetOf/isDisjointFrom) 等「恰为内置
 * 集合原型成员」的函数, 不能以 proxy 为 receiver 调用 —— 内部槽位的
 * brand-check 会抛 "incompatible receiver"。所有会变更集合的原生方法
 * (set/add/delete/clear/...) 都已 instrumented, 因此凡是能通过这个恒等
 * 判定的函数必然是纯只读的原生方法, 以 raw target 为 receiver 转发是
 * 安全的 (变更无法静默绕过 trap)。用户子类自定义方法 (如 putTwice)
 * 不在任何内置原型上, 判定不命中, 仍以 proxy 为 receiver 走 trap
 * (round2 issue #6 的通知语义保持)。
 * */
const builtinCollectionPrototypes: object[] = [
  Map.prototype,
  Set.prototype,
  WeakMap.prototype,
  WeakSet.prototype,
];

export function isBuiltinCollectionPrototypeMethod(key: PropertyKey, value: unknown): boolean {
  if (typeof value !== 'function') {
    return false;
  }
  // constructor 恒等性必须保持: map.constructor === Map, 不做转发包装
  if (key === 'constructor') {
    return false;
  }
  for (const proto of builtinCollectionPrototypes) {
    if ((proto as unknown as Record<PropertyKey, unknown>)[key] === value) {
      return true;
    }
  }
  return false;
}

/*
 * 转发包装: 以 raw target 为 receiver 调用原生只读方法; 参数统一解包为
 * raw (原生方法对参数同样做内部槽位 brand-check, observable proxy 参数
 * 会抛错)。这些方法 (union/intersection/...) 都完整迭代 this, 因此注册
 * iterate 依赖 —— reaction 里读取 s.union(...) 的结果会随集合变更重跑。
 * */
export function forwardBuiltinCollectionMethod(
  target: object,
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return function (this: unknown, ...args: unknown[]): unknown {
    registerRunningReactionForOperation({
      target,
      key: '' as PropertyKey,
      type: 'iterate',
    });
    return Reflect.apply(fn, target, args.map(toRawIfProxy));
  };
}

export const createCollectionProxyHandlers = (customCollectionHandlers?: CollectionHandlers) => {
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

      // Otherwise, get from target. 原生只读集合方法 (如 Set.prototype.union)
      // 以 raw target 为 receiver 转发 —— 直接返回原函数会以 proxy 为
      // receiver 调用, 内部槽位 brand-check 抛错 (GG7 第 3 轮 issue #1/#4)。
      const value = Reflect.get(target, key, receiver);
      if (isBuiltinCollectionPrototypeMethod(key, value)) {
        return forwardBuiltinCollectionMethod(target, value as (...args: unknown[]) => unknown);
      }
      return value;
    },
  };
};

const defaultProxyHandlers: ProxyHandler<object> = createCollectionProxyHandlers();

const globalObj: Record<string, unknown> = (
  typeof globalThis.window === 'object' ? globalThis : new Function('return this')()
) as Record<string, unknown>;

// Type for handler values
type HandlerValue = ProxyHandler<object> | false;

/*
 * #7/#9: 集合路由改为按 Object.prototype.toString 的 tag 判定:
 *   - 子类 (class MyMap extends Map) 继承父类 tag, constructor 精确匹配会漏;
 *   - 跨 realm 集合的 tag 与本 realm 一致, constructor 比较会漏。
 * */
const collectionHandlersByTag = new Map<string, HandlerValue>([
  ['[object Map]', defaultProxyHandlers],
  ['[object Set]', defaultProxyHandlers],
  ['[object WeakMap]', defaultProxyHandlers],
  ['[object WeakSet]', defaultProxyHandlers],
]);

/*
 * GG7 对抗审查第 2 轮加固: tag 只是对象的自述 —— Symbol.toStringTag 可被
 * 子类覆写、伪造, 其 getter 甚至可以抛错, 路由不能裸信任单一信号:
 *   - 同 realm 集合 (含自定义 toStringTag 的子类, instanceof 仍成立) 用
 *     instanceof 判定 (issue #2/#5: 只看 tag 时这类子类落 base handler 抛
 *     'incompatible receiver');
 *   - 跨 realm 集合 instanceof 失效, 只能靠 tag —— 但对伪造 tag 的普通
 *     对象 (issue #3/#8: { [Symbol.toStringTag]: 'Map' }) 再做一次
 *     duck-check, 不像集合就回落 base handler (包装为普通响应式对象);
 *   - Symbol.toStringTag getter 抛错时 (issue #3) 回落 constructor 路径,
 *     不向 observable() 调用方抛错。
 * */
function safeObjectTag(obj: object): string | undefined {
  try {
    return objectToString.call(obj);
  } catch {
    return undefined;
  }
}

function isCollectionByPrototype(obj: object): boolean {
  return (
    obj instanceof Map || obj instanceof Set || obj instanceof WeakMap || obj instanceof WeakSet
  );
}

// 跨 realm 分支的伪造 tag 防线: 方法不存在即不像集合。属性读取可能触发
// 用户 getter, 抛错时视为不通过。
// GG7 第 3 轮 issue #6: 方法还必须是原生函数 —— 真实跨 realm 集合的方法
// 来自远 realm 的 Map.prototype/set.prototype (Function.prototype.toString
// 跨 realm 一致地打印 "[native code]"); 用户类伪造 tag + 自写 get/set/has
// 不满足, 回落 base handler, 其自有属性获得正常追踪与通知。
const nativeFunctionToString = Function.prototype.toString;
function isNativeLikeFunction(fn: unknown): boolean {
  if (typeof fn !== 'function') {
    return false;
  }
  try {
    return nativeFunctionToString.call(fn).includes('[native code]');
  } catch {
    return false;
  }
}

function passesCollectionDuckCheck(obj: object, tag: string): boolean {
  const o = obj as Record<string, unknown>;
  try {
    switch (tag) {
      case '[object Map]':
      case '[object WeakMap]':
        return (
          isNativeLikeFunction(o.get) && isNativeLikeFunction(o.set) && isNativeLikeFunction(o.has)
        );
      case '[object Set]':
      case '[object WeakSet]':
        return (
          isNativeLikeFunction(o.add) &&
          isNativeLikeFunction(o.has) &&
          isNativeLikeFunction(o.delete)
        );
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function getCollectionRouteHandlers(obj: object): ProxyHandler<object> | undefined {
  // 函数是一等 observable, 走 base 路径, 不参与集合路由
  if (typeof obj === 'function') {
    return undefined;
  }
  // 同 realm 集合 (含自定义 toStringTag 的子类 —— 其 tag 已不是
  // '[object Map]' 等) 以 instanceof 优先判定
  if (isCollectionByPrototype(obj)) {
    return defaultProxyHandlers;
  }
  // 跨 realm 集合: instanceof 失效, 靠 tag + duck-check
  const tag = safeObjectTag(obj);
  if (tag !== undefined && collectionHandlersByTag.has(tag)) {
    if (passesCollectionDuckCheck(obj, tag)) {
      return defaultProxyHandlers;
    }
    // 伪造 tag 的非集合对象: 回落 base handler (与 tag 路由引入前一致)
  }
  return undefined;
}

/*
 * GG7 第 3 轮 issue #2/#5: 黑名单 tag 的「用户子类」carve-out。
 * 用户子类 (class MyDate extends Date / class AppError extends Error) 的
 * 自有数据属性是普通属性, base handler 包装完全可用 (子类自有字段的
 * 响应式不因黑名单静默丢失)。判定必须同时满足两个条件:
 *   1. constructor 既非内置名、也非 globalObj 的精确命中 ——
 *      同 realm 原生子类 (new TypeError / new Date) 的 constructor 名
 *      精确命中全局, 不放行 (与 HEAD 行为一致: 返回 raw);
 *   2. 原型链必达本 realm 对应的内置 prototype (Error.prototype 等) ——
 *      跨 realm 原生实例 (vm.runInNewContext 的 TypeError/Date/...) 的
 *      constructor 名会命中全局但构造函数不等 (条件 1 意外通过), 靠这条
 *      原型链限定把它挡回黑名单 (issue #2 的根因, #9 契约: 跨 realm 内置
 *      不被包装, observable(d) === d)。
 * 迭代器 / Generator / WebAssembly 等 tag 的原型没有安全的公开获取途径,
 * 不做 carve-out, 维持黑名单拒绝。
 * */
const blacklistTagLocalPrototypes = new Map<string, object | undefined>([
  ['[object Date]', Date.prototype],
  ['[object RegExp]', RegExp.prototype],
  ['[object Error]', Error.prototype],
  ['[object Promise]', Promise.prototype],
  ['[object ArrayBuffer]', ArrayBuffer.prototype],
  [
    '[object SharedArrayBuffer]',
    typeof SharedArrayBuffer === 'function' ? SharedArrayBuffer.prototype : undefined,
  ],
  ['[object DataView]', DataView.prototype],
  ['[object WeakRef]', typeof WeakRef === 'function' ? WeakRef.prototype : undefined],
  [
    '[object FinalizationRegistry]',
    typeof FinalizationRegistry === 'function' ? FinalizationRegistry.prototype : undefined,
  ],
  ['[object String]', String.prototype],
  ['[object Number]', Number.prototype],
  ['[object Boolean]', Boolean.prototype],
  ['[object Symbol]', Symbol.prototype],
  ['[object BigInt]', BigInt.prototype],
]);

/*
 * #9: 内置对象黑名单 —— 这些对象的方法依赖内部槽位 (internal slots),
 * 以 Proxy 为 receiver 调用会抛 "this is not a Date object." /
 * "incompatible receiver" 之类的错误, 不可包装。
 * 用 tag 而不是 constructor.name in globalObj 判定: 跨 realm 的内置对象
 * (vm.runInNewContext / iframe / RN 远程调试) 的 constructor 不等于本
 * realm 的全局构造函数, 旧检测会把它们误判为可包装。
 * (子类同样继承 tag, 如 class MyDate extends Date 也落入黑名单; 用户
 * 子类的 carve-out 见 blacklistTagLocalPrototypes 注释 —— 子类自有
 * 属性是普通属性, base 包装可用; 原生实例无论同/跨 realm 均拒绝包装。)
 * TypedArray / DataView 不走这张 tag 表, 见 shouldInstrument 的
 * ArrayBuffer.isView 早退 (issue #190)。
 * */
const nonInstrumentableTags = new Set([
  '[object Date]',
  '[object RegExp]',
  '[object Error]',
  '[object Promise]',
  '[object ArrayBuffer]',
  '[object SharedArrayBuffer]',
  '[object DataView]',
  '[object WeakRef]',
  '[object FinalizationRegistry]',
  '[object String]',
  '[object Number]',
  '[object Boolean]',
  '[object Symbol]',
  '[object BigInt]',
  '[object Generator]',
  '[object Map Iterator]',
  '[object Set Iterator]',
  '[object Array Iterator]',
  '[object String Iterator]',
  '[object RegExp String Iterator]',
  '[object Module]',
  '[object WebAssembly.Module]',
  '[object WebAssembly.Instance]',
  '[object WebAssembly.Memory]',
  '[object WebAssembly.Table]',
  '[object WebAssembly.Global]',
  '[object WebAssembly.Tag]',
  '[object WebAssembly.Exception]',
]);

// these stateful built-in objects can and should be wrapped by Proxies if they are part of a store
// simple ones - like arrays - ar wrapped with the normal observable Proxy
// complex ones - like Map and Set - are wrapped with a Proxy of instrumented methods
const handlers = new Map<Function, HandlerValue>([
  [Object, false],
  [Array, false],
]);

// some (usually stateless) built-in objects can not be and should not be wrapped by Proxies
// their methods expect the object instance as the receiver ('this') instead of the Proxy wrapper
// wrapping them and calling their methods causes erros like: "TypeError: this is not a Date object."
export function shouldInstrument(obj: object | Function): boolean {
  // functions are first-class observables in this system
  if (typeof obj === 'function') {
    return true;
  }

  // issue #190: TypedArray / DataView 的 length、buffer、fill/set/迭代
  // 都走内部槽 brand-check, Proxy 当 this 会抛 incompatible receiver。
  // ArrayBuffer.isView 覆盖全部 TypedArray (含 BigInt64/Float16 及以后
  // 新增)、DataView、跨 realm 与 TypedArray 子类; 与 Date 一样不包装。
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function') {
    try {
      if (ArrayBuffer.isView(obj)) {
        return false;
      }
    } catch {
      // isView 抛错时不据此拒绝, 落到后面的 tag / constructor 路径
    }
  }

  // #7/#9: 集合 (含子类与跨 realm 实例) 路由到 instrumented 方法
  // (instanceof 或集 + tag duck-check, 见 getCollectionRouteHandlers)
  if (getCollectionRouteHandlers(obj) !== undefined) {
    return true;
  }

  const tag = safeObjectTag(obj);

  // #9: 依赖内部槽位的内置对象 (含跨 realm) 按 tag 拒绝包装
  if (tag !== undefined && nonInstrumentableTags.has(tag)) {
    /*
     * 用户子类 carve-out (见 blacklistTagLocalPrototypes 注释): 子类自有
     * 数据属性是普通属性, 放行 base 包装; 原生实例 (同 realm 或跨 realm)
     * 被两个条件挡回黑名单。自有 constructor accessor 抛错时保守拒绝
     * (不放行包装, 也不向 observable() 调用方抛用户的异常)。
     * */
    const localPrototype = blacklistTagLocalPrototypes.get(tag);
    if (localPrototype !== undefined) {
      let constructor: unknown;
      try {
        constructor = (obj as { constructor?: unknown }).constructor;
      } catch {
        return false;
      }
      if (
        typeof constructor === 'function' &&
        !(constructor.name in globalObj && globalObj[constructor.name] === constructor) &&
        localPrototype.isPrototypeOf(obj)
      ) {
        return true;
      }
    }
    return false;
  }

  const { constructor } = obj as { constructor: Function };

  // objects in the above handlers array are safe to instrument
  if (handlers.has(constructor)) {
    return true;
  }

  // other same-realm built-in objects should not be instrumented
  const isBuiltIn =
    typeof constructor === 'function' &&
    constructor.name in globalObj &&
    globalObj[constructor.name] === constructor;
  return !isBuiltIn;
}

export function getHandlers(obj: object): HandlerValue {
  // #7/#9: 集合路由 (instanceof 或集 + tag duck-check) 命中时返回集合
  // handlers; 伪造 tag 的普通对象回落 constructor 路径 (base handler)
  const routeHandlers = getCollectionRouteHandlers(obj);
  if (routeHandlers) {
    return routeHandlers;
  }
  const constructor = (obj as { constructor?: Function }).constructor;
  return constructor ? handlers.get(constructor) || false : false;
}
