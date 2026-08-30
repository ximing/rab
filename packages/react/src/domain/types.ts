/**
 * @domain 类型定义
 *
 * 支持基于 React Provider 的依赖注入系统
 * - Provider 包装组件，为子组件提供服务容器
 * - useService Hook，按作用域链查找服务实例
 * - 生命周期绑定，服务实例与 Provider 生命周期一致
 * - 作用域隔离，同一作用域链下每个服务只能在一个地方注册
 */

import type { Container, ServiceIdentifier, ServiceFactory, ServiceClass } from '@rabjs/service';

// 重新导出从 @rabjs/service 导入的类型，供 domain 模块内部使用

/**
 * 服务定义
 * 支持两种形式:
 * 1. 完整定义: { identifier, factory }
 * 2. 简化定义: 直接传入 Service 类,identifier 和 factory 都使用该类
 */
export type ServiceDefinition<T = any> =
  | {
      identifier: ServiceIdentifier<T>;
      factory: ServiceFactory<T> | ServiceClass<T> | T;
    }
  | ServiceClass<T>;

/**
 * Domain 上下文值
 */
export interface DomainContextValue {
  /**
   * 当前容器
   */
  container: Container;
}

export { type ServiceIdentifier, type ServiceFactory, type ServiceClass } from '@rabjs/service';
