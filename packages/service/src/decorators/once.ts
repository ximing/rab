import { EventScope } from '../event';

/**
 * @Once 装饰器选项
 */
export interface OnceOptions {
  /**
   * 事件作用域
   * - 'global': 全局事件，使用全局容器的事件系统
   * - 'container': 容器级别事件，使用当前容器的事件系统（默认）
   */
  scope?: EventScope;
}

/**
 * @Once 装饰器
 * 用于在 Service 中绑定一次性事件监听器
 *
 * 核心特性：
 * - 支持全局事件（使用全局容器的事件系统）和容器级别事件（使用当前容器的事件系统）的一次性监听
 * - 事件触发一次后自动移除监听器
 * - 自动在 Service 初始化时绑定监听器
 * - 自动在 Service 销毁时移除未触发的监听器
 * - 支持多个一次性事件监听
 * - 完整的 TypeScript 类型推导
 *
 * @param eventName 事件名称
 * @param options 配置选项
 *
 * @example
 * ```typescript
 * class UserService extends Service {
 *   // 监听全局一次性事件（使用全局容器的事件系统）
 *   @Once('app:initialized', { scope: 'global' })
 *   onAppInitialized() {
 *     console.log('App initialized');
 *     this.isInitialized = true;
 *   }
 *
 *   // 监听容器级别一次性事件（使用当前容器的事件系统，默认）
 *   @Once('data:loaded')
 *   onDataLoaded(data: any) {
 *     console.log('Data loaded:', data);
 *     this.data = data;
 *   }
 *
 *   // 销毁时自动移除未触发的监听器
 *   destroy() {
 *     cleanupAllEventListeners(this);
 *   }
 * }
 * ```
 */
export function Once(eventName: string, options?: OnceOptions): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(`@Once 装饰器只能用于方法，但 ${String(propertyKey)} 不是一个方法`);
    }

    const scope = options?.scope ?? 'container';

    // 在类的原型上存储事件监听元数据
    if (!target.__eventListeners) {
      target.__eventListeners = [];
    }

    target.__eventListeners.push({
      eventName,
      propertyKey,
      scope,
      isOnce: true,
    });

    return descriptor;
  };
}
