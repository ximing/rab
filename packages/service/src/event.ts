import EventEmitter from 'eventemitter3';

import { Container, getGlobalContainer } from './ioc';

/**
 * 事件作用域类型
 * - 'global': 全局事件，使用全局容器的事件系统
 * - 'container': 容器级别事件，使用当前容器的事件系统
 */
export type EventScope = 'global' | 'container';

/**
 * 事件系统配置选项
 */
export interface EventSystemOptions {
  /**
   * 事件作用域，默认为 'container'
   */
  scope?: EventScope;
}

/**
 * 事件系统类
 * 基于 eventemitter3 实现，支持全局和容器级别的事件管理
 *
 * 核心特性：
 * - 支持全局事件（使用全局容器的事件系统）
 * - 支持容器级别事件（使用容器自己的事件系统）
 * - 自动管理事件监听器的生命周期
 * - 支持事件的发送和监听
 * - 支持一次性事件监听
 * - 支持事件监听器的移除
 *
 * @example
 * ```typescript
 * // 获取全局事件系统（使用全局容器）
 * const globalEvents = EventSystem.getGlobalEvents();
 * globalEvents.on('user:login', (user) => {
 *   console.log('User logged in:', user);
 * });
 *
 * // 获取容器级别事件系统（使用容器自己的 events）
 * const container = new Container({ name: 'app' });
 * const containerEvents = EventSystem.getContainerEvents(container);
 * containerEvents.on('data:update', (data) => {
 *   console.log('Data updated:', data);
 * });
 *
 * // 发送事件
 * globalEvents.emit('user:login', { id: 1, name: 'John' });
 * containerEvents.emit('data:update', { id: 1, value: 'new' });
 * ```
 */
export class EventSystem {
  /**
   * 获取全局事件发射器
   * 使用全局容器的事件系统
   *
   * @returns 全局事件发射器实例
   */
  static getGlobalEvents(): EventEmitter {
    return getGlobalContainer().events;
  }

  /**
   * 获取容器级别的事件发射器
   * 直接返回容器自己的 events 属性
   *
   * @param container 容器实例
   * @returns 容器级别的事件发射器实例
   */
  static getContainerEvents(container: Container): EventEmitter {
    return container.events;
  }

  /**
   * 根据作用域获取对应的事件发射器
   *
   * @param scope 事件作用域
   * @param container 容器实例（当 scope 为 'container' 时必需）
   * @returns 对应的事件发射器实例
   */
  static getEmitter(scope: EventScope, container?: Container): EventEmitter {
    if (scope === 'global') {
      return this.getGlobalEvents();
    }

    if (!container) {
      throw new Error(
        'Container is required when using "container" scope. ' +
          'Make sure the service is resolved from a container.'
      );
    }

    return this.getContainerEvents(container);
  }

  /**
   * 清理所有全局事件
   * 清理全局容器的事件监听器
   * 通常在应用关闭时调用
   */
  static clearAllGlobalEvents(): void {
    getGlobalContainer().events.removeAllListeners();
  }
}
