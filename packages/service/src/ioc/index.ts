/**
 * IOC 容器模块
 * 提供依赖注入和服务管理能力
 *
 * 核心功能：
 * - 树形容器结构，支持父子容器继承
 * - 服务注册和解析，支持单例和瞬时作用域
 * - 生命周期管理，支持销毁回调
 * - 实例追踪，通过 WeakMap 建立实例和容器的关系
 * - 全局注册表，支持通过名称快速获取容器
 */

export { Container, createContainer } from './container';

export { getGlobalContainer, resetGlobalContainer } from './globals';

export { ServiceScope } from './types';

export type {
  ServiceIdentifier,
  ServiceClass,
  ServiceFactory,
  RegisterOptions,
  ContainerOptions,
  DestroyCallback,
  IContainer,
} from './types';
