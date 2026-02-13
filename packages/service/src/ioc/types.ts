/**
 * IOC 容器类型定义
 */

import type { Service } from '../service';

/**
 * 服务标识符类型
 */
export type ServiceIdentifier<T = any> = string | symbol | (new (...args: any[]) => T);

/**
 * 服务类类型
 */
export type ServiceClass<T = any> = new (...args: any[]) => T;

/**
 * 容器类型（前向引用，避免循环依赖）
 */
export interface IContainer {
  resolve<T extends Service>(identifier: new (...args: any[]) => T): T;
  resolve<T extends Service = Service>(identifier: string | symbol): T;
  tryResolve<T extends Service>(identifier: new (...args: any[]) => T): T | undefined;
  tryResolve<T extends Service = Service>(identifier: string | symbol): T | undefined;
}

/**
 * 服务工厂函数类型（用于解决循环引用）
 */
export type ServiceFactory<T = any> = (container: IContainer) => T;

/**
 * 服务作用域
 */
export enum ServiceScope {
  Singleton = 'singleton',
  Transient = 'transient',
}

/**
 * 注册选项
 */
export interface RegisterOptions {
  scope?: ServiceScope;
}

/**
 * 服务定义
 */
export interface ServiceDefinition<T = any> {
  identifier: ServiceIdentifier<T>;
  factory: ServiceClass<T> | ServiceFactory<T>;
  scope: ServiceScope;
  instance?: T;
}

/**
 * 容器配置选项
 */
export interface ContainerOptions {
  parent?: any; // 使用 any 避免循环引用
  name?: string | Symbol;
}

/**
 * 容器销毁回调
 */
export type DestroyCallback = () => void;
