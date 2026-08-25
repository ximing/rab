/**
 * IOC 容器工具函数
 */

import { Service } from '../service';

import type { RegisterOptions } from './types';

/**
 * 判断是否是 RegisterOptions
 */
export function isRegisterOptions(obj: any): obj is RegisterOptions {
  return (
    obj &&
    typeof obj === 'object' &&
    !isServiceClass(obj) &&
    (obj.scope === undefined || obj.scope === 'singleton' || obj.scope === 'transient')
  );
}

/**
 * 判断是否是 Service 类（继承自 Service）
 * 这是判断是否为类而非工厂函数的更精确方法
 *
 * @param func 要检查的函数
 * @returns 如果是 Service 子类返回 true
 *
 * @example
 * ```typescript
 * class UserService extends Service {}
 * isServiceClass(UserService); // true
 * isServiceClass((container) => new UserService()); // false
 * ```
 */
export function isServiceClass(func: any): boolean {
  if (typeof func !== 'function') {
    return false;
  }

  try {
    // 检查是否是 Service 的子类
    return func.prototype instanceof Service;
  } catch {
    return false;
  }
}

/**
 * 判断是否是类（构造函数）
 * 保留此函数用于向后兼容，但推荐使用 isServiceClass
 *
 * @deprecated 推荐使用 isServiceClass 代替
 */
export function isClass(func: Function): boolean {
  // 检查是否有 prototype 且 prototype 不是 Object.prototype
  if (typeof func !== 'function') {
    return false;
  }

  // 检查函数字符串表示是否包含 'class' 关键字
  const str = func.toString();
  if (str.startsWith('class ')) {
    return true;
  }

  return false;
}
