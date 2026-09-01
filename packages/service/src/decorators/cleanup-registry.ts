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
