/*
 * 容器是谁的问题，以前是全局的容器，现在是需要分层的
 * 容器分形处理是基于 React 组件 Provide 的机制做处理的
 * 底层的 Service 需要提供分层检索的能力，同时支持 注入 resolve的能力
 */

import { Container } from './ioc';
import type { ServiceIdentifier, ServiceClass, ServiceFactory, RegisterOptions } from './ioc';
import { getGlobalContainer } from './ioc/globals';
import { Service } from './service';

// 导出核心 Service 类和类型
export { Service } from './service';
export type { MethodState, ExtractMethods } from './service';

// 导出装饰器
export {
  Action,
  SyncAction,
  Inject,
  getInjectMetadata,
  isInjected,
  Debounce,
  cancelDebounce,
  cleanupAllDebounces,
  Throttle,
  cancelThrottle,
  cleanupAllThrottles,
  Memo,
  invalidateMemo,
  cleanupAllMemos,
  On,
  Once,
  getEventListenerMetadata,
  isEventListener,
  setupEventListeners,
  cleanupEventListeners,
  cleanupAllEventListeners,
} from './decorators';
export type {
  InjectOptions,
  DebounceOptions,
  ThrottleOptions,
  MemoOptions,
  OnOptions,
  OnceOptions,
} from './decorators';

// 导出事件系统
export { EventSystem } from './event';
export type { EventScope, EventSystemOptions } from './event';

// 导出 IOC 容器
export * from './ioc';

export type { ServiceIdentifier, ServiceFactory, ContainerOptions, DestroyCallback } from './ioc';

export { getGlobalContainer };

/**
 * 全局注册服务
 * 支持三种用法:
 * 1. register(ServiceClass, options?, container?) - 使用类作为标识符和工厂
 * 2. register(identifier, ServiceClass, options?, container?) - 使用自定义标识符
 * 3. register(identifier, lazyFunction, options?, container?) - 使用懒加载函数（解决循环引用）
 *
 * 如果不传入容器，默认使用全局容器
 *
 * @example
 * ```typescript
 * // 用法 1: 使用类作为标识符
 * register(UserService);
 * register(UserService, { scope: 'singleton' });
 *
 * // 用法 2: 使用自定义标识符
 * register('userService', UserService);
 * register(Symbol('userService'), UserService, { scope: 'transient' });
 *
 * // 用法 3: 使用懒加载函数（解决循环引用）
 * register('userService', (container) => new UserService());
 *
 * // 指定容器
 * const container = new Container({ name: 'custom' });
 * register(UserService, undefined, container);
 * register('userService', UserService, { scope: 'singleton' }, container);
 * ```
 */
export function register<T extends Service = Service>(
  identifierOrClass: ServiceIdentifier<T> | ServiceClass<T>,
  classOrFactoryOrOptions?: ServiceClass<T> | ServiceFactory<T> | RegisterOptions,
  optionsOrContainer?: RegisterOptions | Container,
  container?: Container
): Container {
  // 确定实际的容器
  let targetContainer = container;
  let actualOptions: RegisterOptions | undefined;

  // 处理参数重载
  if (optionsOrContainer instanceof Container) {
    targetContainer = optionsOrContainer;
  } else if (
    optionsOrContainer &&
    typeof optionsOrContainer === 'object' &&
    !('factory' in optionsOrContainer)
  ) {
    actualOptions = optionsOrContainer as RegisterOptions;
  }

  // 如果没有指定容器，使用全局容器
  const finalContainer = targetContainer || getGlobalContainer();

  // 调用容器的 register 方法
  if (actualOptions) {
    finalContainer.register(identifierOrClass, classOrFactoryOrOptions as any, actualOptions);
  } else {
    finalContainer.register(identifierOrClass, classOrFactoryOrOptions as any);
  }

  return finalContainer;
}

/**
 * 全局解析服务
 * 支持两种用法:
 * 1. resolve(ServiceClass, container?) - 使用类构造函数，自动推导类型
 * 2. resolve(identifier, container?) - 使用字符串或 Symbol，需要显式指定泛型
 *
 * 如果不传入容器，默认使用全局容器
 *
 * @example
 * ```typescript
 * // 用法 1: 使用类作为标识符
 * const userService = resolve(UserService); // 自动推导为 UserService 类型
 *
 * // 用法 2: 使用自定义标识符
 * const userService = resolve<UserService>('userService');
 *
 * // 指定容器
 * const container = new Container({ name: 'custom' });
 * const userService = resolve(UserService, container);
 * const userService2 = resolve<UserService>('userService', container);
 * ```
 */
export function resolve<T extends Service = Service>(
  identifier: ServiceIdentifier<T> | (new (...args: any[]) => T),
  container?: Container
): T {
  // 如果没有指定容器，使用全局容器
  const targetContainer = container || getGlobalContainer();

  // 调用容器的 resolve 方法
  return targetContainer.resolve(identifier as any);
}

/**
 * 检查服务是否已注册
 * 支持两种用法:
 * 1. has(ServiceClass, container?) - 使用类构造函数
 * 2. has(identifier, container?) - 使用字符串或 Symbol
 *
 * 如果不传入容器，默认使用全局容器
 *
 * @example
 * ```typescript
 * // 用法 1: 使用类作为标识符
 * if (has(UserService)) {
 *   const userService = resolve(UserService);
 * }
 *
 * // 用法 2: 使用自定义标识符
 * if (has('userService')) {
 *   const userService = resolve<UserService>('userService');
 * }
 *
 * // 指定容器
 * const container = new Container({ name: 'custom' });
 * if (has(UserService, container)) {
 *   const userService = resolve(UserService, container);
 * }
 * ```
 */
export function has(identifier: ServiceIdentifier, container?: Container): boolean {
  // 如果没有指定容器，使用全局容器
  const targetContainer = container || getGlobalContainer();

  // 调用容器的 has 方法
  return targetContainer.has(identifier);
}
