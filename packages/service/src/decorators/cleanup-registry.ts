/**
 * 装饰器清理函数的按原型注册表。
 *
 * 背景：此前清理函数以字符串化方法名挂在原型上
 * （__cleanup_memo_${String(key)} 等），有两个结构性缺陷：
 * - 两个同 description 的 symbol 键（Symbol('a') vs Symbol('a')）撞名，
 *   共享一个闭包 —— 交叉清理 + 第二个键的清理永远注册不上；
 * - cleanupAll 系 API 靠 getOwnPropertyNames 反查方法名，symbol 键
 *   天然漏扫，destroy 后其定时器/reaction 残留。
 *
 * 注册表以真实 propertyKey 为键，两类缺陷同时消除。
 * memo / throttle / debounce 三个装饰器共用一套实现，各持有一个
 * 独立的 registryKey（互不占名）。
 */

export type CleanupFn = (this: any) => void;
export type CleanupRegistry = Map<string | symbol, CleanupFn>;

/**
 * 装饰器的「按实例状态 + detached 哨兵」存储（@Debounce/@Throttle 共用）。
 *
 * 状态必须按实例隔离：装饰器闭包在类定义时只执行一次，闭包变量是类级
 * 共享的（#220）。分离调用（this 为 null/undefined 或原始值，如
 * arr.map(service.save)、解构出来的方法、装饰在普通类上）不能作为
 * WeakMap 键 —— 否则会抛 TypeError: Invalid value used as weak map key，
 * 退回到共享的哨兵键：所有分离调用共用一份状态，与 WeakMap 重构前的
 * 类级闭包共享一份状态的行为一致（#250）。
 */
export interface InstanceStateStore<T> {
  /** 取实例对应的状态，没有则创建；分离调用落到共享哨兵状态 */
  get(instance: any): T;
  /** 只查不建（清理路径用，避免为从未调用过的实例白建状态） */
  lookup(instance: any): T | undefined;
  /** 共享哨兵状态（undefined 说明从未发生分离调用） */
  detached(): T | undefined;
}

export function createInstanceStateStore<T>(createState: () => T): InstanceStateStore<T> {
  const instanceStates = new WeakMap<object, T>();
  const detachedStateKey = {};
  const stateKey = (instance: any): object =>
    instance !== null && (typeof instance === 'object' || typeof instance === 'function')
      ? instance
      : detachedStateKey;
  return {
    get(instance: any): T {
      const key = stateKey(instance);
      let state = instanceStates.get(key);
      if (!state) {
        state = createState();
        instanceStates.set(key, state);
      }
      return state;
    },
    lookup(instance: any): T | undefined {
      return instanceStates.get(stateKey(instance));
    },
    detached(): T | undefined {
      return instanceStates.get(detachedStateKey);
    },
  };
}

/**
 * 把「实例状态清理 + detached 哨兵清理」注册进两张表：
 * - 实例表（instanceRegistryKey）：cancel*(instance, key) 单实例 API 只查它；
 * - detached 表（detachedRegistryKey）：哨兵状态是类级共享的，单实例 cancel
 *   不得连带取消与本实例无关的 pending 分离调用；只有 cleanupAll*
 *   （destroy 路径）经 runAllCleanupsWithDetached 连带清理 —— 否则实例
 *   destroy 后 pending 定时器仍会以 this=undefined 触发。代价与 #220 前的
 *   类级共享状态一致：任一实例销毁会取消该方法尚未到达的分离调用。
 */
export function registerInstanceStateCleanups<T>(
  target: any,
  instanceRegistryKey: symbol,
  detachedRegistryKey: symbol,
  propertyKey: string | symbol,
  store: InstanceStateStore<T>,
  cleanup: (state: T) => void
): void {
  const registry = getOrCreateCleanupRegistry(target, instanceRegistryKey);
  chainCleanup(registry, propertyKey, function (this: any) {
    const state = store.lookup(this);
    if (state) {
      cleanup(state);
    }
  });
  const detachedRegistry = getOrCreateCleanupRegistry(target, detachedRegistryKey);
  chainCleanup(detachedRegistry, propertyKey, function () {
    const state = store.detached();
    if (state) {
      cleanup(state);
    }
  });
}

/**
 * 注册一个 propertyKey 的清理函数；同 key 已有清理时组合而非跳过 ——
 * 同一方法被同类型装饰器重复装饰（@Debounce(50) @Debounce(100)）时
 * 每层装饰器持有独立的实例状态 store 与定时器，只保留第一层的清理
 * 会让其余层的 pending 定时器在 destroy 后残留并幽灵触发。
 */
function chainCleanup(
  registry: CleanupRegistry,
  propertyKey: string | symbol,
  cleanup: CleanupFn
): void {
  const existing = registry.get(propertyKey);
  if (!existing) {
    registry.set(propertyKey, cleanup);
    return;
  }
  registry.set(propertyKey, function (this: any) {
    existing.call(this);
    cleanup.call(this);
  });
}

/**
 * destroy 路径：先清全部实例状态，再连带清 detached 哨兵状态。
 */
export function runAllCleanupsWithDetached(
  instance: any,
  instanceRegistryKey: symbol,
  detachedRegistryKey: symbol
): void {
  runAllCleanups(instance, instanceRegistryKey);
  runAllCleanups(instance, detachedRegistryKey);
}

/**
 * 读取 target 自己（而非原型链上继承而来）的注册表，没有则创建。
 * 必须在当前原型上建独立注册表：直接写继承来的表会把子类装饰的
 * 成员注册进基类。
 */
export function getOrCreateCleanupRegistry(target: any, registryKey: symbol): CleanupRegistry {
  let registry = Object.prototype.hasOwnProperty.call(target, registryKey)
    ? (target[registryKey] as CleanupRegistry)
    : undefined;
  if (!registry) {
    registry = new Map();
    Object.defineProperty(target, registryKey, {
      value: registry,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
  return registry;
}

/**
 * 沿原型链查找指定 key 的清理函数（就近优先：子类覆盖基类）
 */
export function findCleanup(
  instance: any,
  registryKey: symbol,
  propertyKey: string | symbol
): CleanupFn | undefined {
  let current = Object.getPrototypeOf(instance);
  while (current && current !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(current, registryKey)) {
      const fn = (current[registryKey] as CleanupRegistry).get(propertyKey);
      if (fn) {
        return fn;
      }
    }
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}

/**
 * 沿原型链收集并执行该 registryKey 下的全部清理函数。
 * 装饰器成员可能定义在任意基类上，只扫直接原型会漏掉继承的清理（#221）；
 * 同名 key 就近去重（子类遮蔽基类）。
 *
 * @returns 被清理的 propertyKey 列表（按收集顺序），供调用方做后续通知
 */
export function runAllCleanups(instance: any, registryKey: symbol): (string | symbol)[] {
  const seen = new Set<string | symbol>();
  const cleanups: CleanupFn[] = [];
  const cleanedKeys: (string | symbol)[] = [];
  let current = Object.getPrototypeOf(instance);
  while (current && current !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(current, registryKey)) {
      for (const [propertyKey, cleanup] of current[registryKey] as CleanupRegistry) {
        if (seen.has(propertyKey)) {
          continue;
        }
        seen.add(propertyKey);
        cleanups.push(cleanup);
        cleanedKeys.push(propertyKey);
      }
    }
    current = Object.getPrototypeOf(current);
  }
  for (const cleanup of cleanups) {
    cleanup.call(instance);
  }
  return cleanedKeys;
}
