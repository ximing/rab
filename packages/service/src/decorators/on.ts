import { EventSystem, EventScope } from '../event';
import { Container } from '../ioc';
import { Service } from '../service';

/**
 * @On 装饰器选项
 */
export interface OnOptions {
  /**
   * 事件作用域
   * - 'global': 全局事件，使用全局容器的事件系统
   * - 'container': 容器级别事件，使用当前容器的事件系统（默认）
   */
  scope?: EventScope;
}

/**
 * @On 装饰器
 * 用于在 Service 中绑定事件监听器
 *
 * 核心特性：
 * - 支持全局事件（使用全局容器的事件系统）和容器级别事件（使用当前容器的事件系统）
 * - 自动在 Service 初始化时绑定监听器
 * - 自动在 Service 销毁时移除监听器
 * - 支持多个事件监听
 * - 完整的 TypeScript 类型推导
 *
 * @param eventName 事件名称
 * @param options 配置选项
 *
 * @example
 * ```typescript
 * class UserService extends Service {
 *   // 监听全局事件（使用全局容器的事件系统）
 *   @On('user:login', { scope: 'global' })
 *   onUserLogin(user: { id: number; name: string }) {
 *     console.log('User logged in:', user);
 *     this.currentUser = user;
 *   }
 *
 *   // 监听容器级别事件（使用当前容器的事件系统，默认）
 *   @On('data:update')
 *   onDataUpdate(data: any) {
 *     console.log('Data updated:', data);
 *     this.data = data;
 *   }
 *
 *   // 销毁时自动移除监听器
 *   destroy() {
 *     cleanupAllEventListeners(this);
 *   }
 * }
 * ```
 */
export function On(eventName: string, options?: OnOptions): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(`@On 装饰器只能用于方法，但 ${String(propertyKey)} 不是一个方法`);
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
      isOnce: false,
    });

    return descriptor;
  };
}

/**
 * 获取类的事件监听元数据
 * @param target 目标类
 * @returns 事件监听元数据数组
 */
export function getEventListenerMetadata(target: any): Array<{
  eventName: string;
  propertyKey: string | symbol;
  scope: EventScope;
  isOnce: boolean;
}> {
  return target.__eventListeners || [];
}

/**
 * 检查方法是否被 @On 装饰
 * @param target 目标类
 * @param propertyKey 属性名
 * @returns 是否被装饰
 */
export function isEventListener(target: any, propertyKey: string | symbol): boolean {
  const metadata = getEventListenerMetadata(target);
  return metadata.some(item => item.propertyKey === propertyKey);
}

/**
 * 为 Service 实例绑定所有事件监听器
 * 通常在 Service 初始化时自动调用
 *
 * @param service Service 实例
 * @param container 可选的容器实例，如果不提供则从 Service 实例中获取
 */
export function setupEventListeners(service: Service, container?: Container): void {
  const prototype = Object.getPrototypeOf(service);
  const metadata = getEventListenerMetadata(prototype);

  if (metadata.length === 0) {
    return;
  }

  // 获取 Service 所属的容器
  let targetContainer = container;
  if (!targetContainer) {
    targetContainer = (Container as any).getContainerOf?.(service);
  }

  // 为每个事件监听器绑定处理函数
  metadata.forEach(item => {
    const { eventName, propertyKey, scope, isOnce } = item;
    const handler = (prototype[propertyKey] as Function).bind(service);

    try {
      const emitter = EventSystem.getEmitter(scope, targetContainer);

      if (isOnce) {
        emitter.once(eventName, handler);
      } else {
        emitter.on(eventName, handler);
      }

      // 存储监听器信息以便后续移除
      if (!(service as any).__boundEventHandlers) {
        (service as any).__boundEventHandlers = [];
      }

      (service as any).__boundEventHandlers.push({
        eventName,
        handler,
        scope,
        emitter,
      });
    } catch (error) {
      throw new Error(
        `Failed to setup event listener for "${String(propertyKey)}" ` +
          `listening to event "${eventName}" with scope "${scope}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * 移除 Service 实例的所有事件监听器
 * 通常在 Service 销毁时调用
 *
 * @param service Service 实例
 */
export function cleanupEventListeners(service: Service): void {
  if (!(service as any).__boundEventHandlers) {
    return;
  }

  (service as any).__boundEventHandlers.forEach(item => {
    const { eventName, handler, emitter } = item;
    emitter.off(eventName, handler);
  });

  (service as any).__boundEventHandlers = [];
}

/**
 * 移除所有 Service 实例的事件监听器
 * 用于批量清理多个 Service 实例
 *
 * @param services Service 实例数组
 */
export function cleanupAllEventListeners(...services: Service[]): void {
  services.forEach(service => {
    cleanupEventListeners(service);
  });
}
