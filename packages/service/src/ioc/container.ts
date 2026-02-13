/**
 * 容器是谁的问题，以前是全局的容器，现在是需要分层的
 * 容器分形处理是基于 React 组件 Provide 的机制做处理的
 * 底层的 Service 需要提供分层检索的能力，同时支持 注入 resolve的能力
 */

import EventEmitter from 'eventemitter3';

import { Service } from '../service';

import { globalInstanceContainerMap, setCurrentInstantiatingContainer } from './globals';
import type {
  ServiceIdentifier,
  ServiceClass,
  ServiceFactory,
  RegisterOptions,
  ContainerOptions,
  ServiceDefinition,
  ServiceScope,
} from './types';
import { ServiceScope as ServiceScopeEnum } from './types';
import { isRegisterOptions, isServiceClass } from './utils';

let containerId = 0;

/**
 * 容器类 - 专门为 Service 定制的 IoC 容器
 *
 * - 三种注册方式：
 *   1. register(ServiceClass, options?) - 使用类作为标识符
 *   2. register(identifier, ServiceClass, options?) - 使用自定义标识符
 *   3. register(identifier, lazyFunction, options?) - 使用懒加载函数（解决循环引用）
 * - 生命周期管理：支持单例（Singleton）和瞬时（Transient）作用域
 * - 树形结构：支持父子容器，子容器可继承父容器的服务
 * - 动态调整：支持动态添加/移除子容器，支持容器重新挂载
 * - 依赖注入：自动解析依赖关系
 * - 销毁管理：支持容器销毁时的清理回调
 * - 分层检索：支持从子容器向上查找服务
 * - 全局注册：支持通过名称快速获取容器实例（名称全局唯一）
 * - 实例追踪：通过 WeakMap 建立实例和容器的关系，支持通过实例获取容器
 * - 循环引用检测：防止形成循环的容器树结构
 *
 * @example
 * ```typescript
 * // 创建根容器
 * const rootContainer = new Container({ name: 'root' });
 *
 * // 注册服务 - 三种方式
 * // 方式 1: 使用类作为标识符
 * rootContainer.register(UserService);
 * rootContainer.register(TodoService, { scope: ServiceScope.Transient });
 *
 * // 方式 2: 使用自定义标识符
 * rootContainer.register('userService', UserService);
 * rootContainer.register(Symbol('todoService'), TodoService);
 *
 * // 方式 3: 使用懒加载函数（解决循环引用）
 * rootContainer.register('userService', (container) => {
 *   const todoService = container.resolve(TodoService);
 *   return new UserService(todoService);
 * });
 *
 * // 创建子容器（树形结构）
 * const childContainer = new Container({ parent: rootContainer, name: 'child' });
 *
 * // 解析服务
 * const userService = childContainer.resolve(UserService);
 * const todoService = childContainer.resolve('todoService');
 *
 * // 动态添加子容器
 * const dynamicChild = new Container({ name: 'dynamic' });
 * rootContainer.addChild(dynamicChild);
 *
 * // 通过名称快速获取容器
 * const container = Container.getByName('root');
 *
 * // 通过实例获取容器
 * const containerOfService = Container.getContainerOf(userService);
 *
 * // 销毁容器
 * childContainer.destroy();
 * ```
 */
export class Container {
  private services: Map<ServiceIdentifier, ServiceDefinition> = new Map();
  private parent?: Container;
  private children: Set<Container> = new Set();
  private name: string | Symbol;
  private destroyed: boolean = false;

  /**
   * 容器级别的事件发射器
   * 每个容器拥有独立的事件系统
   */
  public readonly events: EventEmitter;

  constructor(options?: ContainerOptions) {
    this.parent = options?.parent;
    this.name = options?.name || `Container-${containerId++}`;
    this.events = new EventEmitter();

    // 将自己添加到父容器的子容器集合中
    if (this.parent) {
      this.parent.children.add(this);
    }
  }

  /**
   * 获取容器名称
   */
  getName(): string | Symbol {
    return this.name;
  }

  /**
   * 获取父容器
   */
  getParent(): Container | undefined {
    return this.parent;
  }

  /**
   * 获取所有子容器
   */
  getChildren(): Container[] {
    return Array.from(this.children);
  }

  /**
   * 注册服务
   *
   * 支持三种用法:
   * 1. register(ServiceClass, options?) - 使用类作为标识符和工厂
   * 2. register(identifier, ServiceClass, options?) - 使用自定义标识符
   * 3. register(identifier, lazyFunction, options?) - 使用懒加载函数（解决循环引用）
   *
   * @param identifierOrClass 服务标识符或 Service 类
   * @param classOrFactory Service 类或工厂函数（可选）
   * @param options 注册选项（可选）
   *
   * @example
   * ```typescript
   * // 用法 1: 使用类作为标识符
   * container.register(UserService);
   * container.register(UserService, { scope: ServiceScope.Singleton });
   *
   * // 用法 2: 使用自定义标识符
   * container.register('userService', UserService);
   * container.register(Symbol('userService'), UserService, { scope: ServiceScope.Transient });
   *
   * // 用法 3: 使用懒加载函数（解决循环引用）
   * container.register('userService', (container) => new UserService());
   * container.register('userService', (container) => container.resolve(AnotherService));
   * ```
   */
  register<T extends Service = Service>(
    identifierOrClass: ServiceIdentifier<T> | ServiceClass<T>,
    classOrFactory?: ServiceClass<T> | ServiceFactory<T> | RegisterOptions,
    options?: RegisterOptions
  ): this {
    if (this.destroyed) {
      throw new Error(`Cannot register service on destroyed container: ${this.name}`);
    }

    let identifier: ServiceIdentifier<T>;
    let factory: ServiceClass<T> | ServiceFactory<T>;
    let scope: ServiceScope;

    // 用法 1: register(ServiceClass, options?)
    if (
      typeof identifierOrClass === 'function' &&
      isServiceClass(identifierOrClass) &&
      (classOrFactory === undefined || isRegisterOptions(classOrFactory))
    ) {
      identifier = identifierOrClass;
      factory = identifierOrClass;
      scope = (classOrFactory as RegisterOptions)?.scope ?? ServiceScopeEnum.Singleton;
    }
    // 用法 2 和 3: register(identifier, ServiceClass | lazyFunction, options?)
    else if (classOrFactory !== undefined && typeof classOrFactory === 'function') {
      identifier = identifierOrClass;
      factory = classOrFactory as ServiceClass<T> | ServiceFactory<T>;
      scope = options?.scope ?? ServiceScopeEnum.Singleton;
    } else {
      throw new Error(
        'Invalid register arguments. Expected: register(ServiceClass, options?) or register(identifier, ServiceClass | lazyFunction, options?)'
      );
    }

    const definition: ServiceDefinition<T> = {
      identifier,
      factory,
      scope,
    };

    this.services.set(identifier, definition);
    return this;
  }

  /**
   * 注册单例服务
   */
  registerSingleton<T extends Service = Service>(
    identifierOrClass: ServiceIdentifier<T> | ServiceClass<T>,
    classOrFactory?: ServiceClass<T> | ServiceFactory<T>
  ): this {
    if (typeof identifierOrClass === 'function' && classOrFactory === undefined) {
      return this.register(identifierOrClass, { scope: ServiceScopeEnum.Singleton });
    }
    return this.register(identifierOrClass, classOrFactory!, { scope: ServiceScopeEnum.Singleton });
  }

  /**
   * 注册瞬时服务（每次解析都创建新实例）
   */
  registerTransient<T extends Service = Service>(
    identifierOrClass: ServiceIdentifier<T> | ServiceClass<T>,
    classOrFactory?: ServiceClass<T> | ServiceFactory<T>
  ): this {
    if (typeof identifierOrClass === 'function' && classOrFactory === undefined) {
      return this.register(identifierOrClass, { scope: ServiceScopeEnum.Transient });
    }
    return this.register(identifierOrClass, classOrFactory!, { scope: ServiceScopeEnum.Transient });
  }

  /**
   * 解析服务（重载1：传入类构造函数，自动推导类型）
   * 支持分层检索：先查找当前容器，再查找父容器
   *
   * @param identifier Service 类构造函数
   * @returns 解析后的服务实例
   * @throws 如果服务未找到或容器已销毁
   *
   * @example
   * ```typescript
   * const userService = container.resolve(UserService); // 自动推导为 UserService 类型
   * ```
   */
  resolve<T extends Service>(identifier: new (...args: any[]) => T): T;

  /**
   * 解析服务（重载2：传入字符串或 Symbol，需要显式指定泛型）
   * 支持分层检索：先查找当前容器，再查找父容器
   *
   * @param identifier 服务标识符（字符串或 Symbol）
   * @returns 解析后的服务实例
   * @throws 如果服务未找到或容器已销毁
   *
   * @example
   * ```typescript
   * container.register('userService', UserService);
   * const userService = container.resolve<UserService>('userService'); // 需要显式指定泛型
   * ```
   */
  resolve<T extends Service = Service>(identifier: string | symbol): T;

  /**
   * 解析服务（实现）
   */
  resolve<T extends Service = Service>(identifier: ServiceIdentifier<T>): T {
    if (this.destroyed) {
      throw new Error(`Cannot resolve service on destroyed container: ${this.name}`);
    }

    const result = this.getServiceDefinitionWithContainer(identifier);
    if (!result) {
      throw new Error(`Service not found: ${String(identifier)} in container: ${this.name}`);
    }

    const { definition, container } = result;
    return container.instantiate(definition);
  }

  /**
   * 尝试解析服务（重载1：传入类构造函数，自动推导类型）
   * 如果不存在返回 undefined
   *
   * @param identifier Service 类构造函数
   * @returns 解析后的服务实例或 undefined
   *
   * @example
   * ```typescript
   * const userService = container.tryResolve(UserService); // 自动推导为 UserService | undefined
   * ```
   */
  tryResolve<T extends Service>(identifier: new (...args: any[]) => T): T | undefined;

  /**
   * 尝试解析服务（重载2：传入字符串或 Symbol，需要显式指定泛型）
   * 如果不存在返回 undefined
   *
   * @param identifier 服务标识符（字符串或 Symbol）
   * @returns 解析后的服务实例或 undefined
   *
   * @example
   * ```typescript
   * const userService = container.tryResolve<UserService>('userService'); // 需要显式指定泛型
   * ```
   */
  tryResolve<T extends Service = Service>(identifier: string | symbol): T | undefined;

  /**
   * 尝试解析服务（实现）
   */
  tryResolve<T extends Service = Service>(identifier: ServiceIdentifier<T>): T | undefined {
    if (this.destroyed) {
      return undefined;
    }

    const result = this.getServiceDefinitionWithContainer(identifier);
    if (!result) {
      return undefined;
    }

    try {
      const { definition, container } = result;
      return container.instantiate(definition);
    } catch {
      return undefined;
    }
  }

  /**
   * 检查服务是否已注册
   * 支持递归查找：先查找当前容器，再查找父容器
   *
   * @param identifier 服务标识符
   * @returns 如果服务已注册返回 true
   */
  has(identifier: ServiceIdentifier): boolean {
    if (this.services.has(identifier)) {
      return true;
    }

    if (this.parent) {
      return this.parent.has(identifier);
    }

    return false;
  }

  /**
   * 注销服务
   */
  unregister(identifier: ServiceIdentifier): boolean {
    if (this.destroyed) {
      return false;
    }

    const definition = this.services.get(identifier);

    return this.services.delete(identifier);
  }

  /**
   * 销毁容器
   * - 销毁所有子容器
   * - 调用所有 Service 实例的 destroy 方法
   * - 清理所有服务实例
   * - 清理容器级别的事件监听器
   * - 从全局注册表中移除
   */
  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    // 先销毁所有子容器
    const childrenArray = Array.from(this.children);
    for (const child of childrenArray) {
      child.destroy();
    }

    // 销毁所有已实例化的 Service 实例
    for (const definition of this.services.values()) {
      if (definition.instance && typeof definition.instance === 'object') {
        const instance = definition.instance as any;
        // 检查实例是否有 destroy 方法
        if (typeof instance.destroy === 'function') {
          try {
            instance.destroy();
          } catch (error) {
            console.error(
              `Error destroying service instance: ${String(definition.identifier)}`,
              error
            );
          }
        }
      }
    }

    // 清理容器级别的事件监听器
    this.events.removeAllListeners();

    // 清理引用
    this.services.clear();
    this.children.clear();

    // 从原有的父容器中移除自己（不调用 removeParent 以避免检查 destroyed 状态）
    if (this.parent) {
      this.parent.children.delete(this);
      this.parent = undefined;
    }
  }

  /**
   * 检查容器是否已销毁
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * 创建子容器
   */
  createChild(name?: string | Symbol): Container {
    if (this.destroyed) {
      throw new Error(`Cannot create child container on destroyed container: ${this.name}`);
    }

    return new Container({
      parent: this,
      name: (name ?? `${this.name}-child-${this.children.size}`)!,
    });
  }

  /**
   * 动态添加一个现有的容器成为当前容器的子节点
   *
   * 支持以下场景：
   * 1. 将一个独立的容器添加为子容器
   * 2. 将一个容器从其原有的父容器中移除，并添加到当前容器
   * 3. 支持链式调用
   *
   * @param child 要添加的子容器
   * @returns 返回当前容器实例，支持链式调用
   * @throws 如果当前容器已销毁、子容器已销毁、或会形成循环引用
   *
   * @example
   * ```typescript
   * // 创建两个独立的容器
   * const parentContainer = new Container({ name: 'parent' });
   * const childContainer = new Container({ name: 'child' });
   *
   * // 动态添加子容器
   * parentContainer.addChild(childContainer);
   *
   * // 链式调用
   * const anotherChild = new Container({ name: 'another' });
   * parentContainer.addChild(childContainer).addChild(anotherChild);
   *
   * // 将容器从原有的父容器中移除，并添加到新的父容器
   * const newParent = new Container({ name: 'newParent' });
   * newParent.addChild(childContainer); // childContainer 会自动从 parentContainer 中移除
   * ```
   */
  addChild(child: Container): this {
    if (this.destroyed) {
      throw new Error(`Cannot add child to destroyed container: ${this.name}`);
    }

    if (child.destroyed) {
      throw new Error(`Cannot add destroyed container as child: ${child.name}`);
    }

    // 检查是否会形成循环引用
    if (this.isDescendantOf(child)) {
      throw new Error(
        `Cannot add container as child: would create circular reference. ` +
          `Current container "${this.name}" is already a descendant of "${child.name}"`
      );
    }

    // 如果子容器已有父容器，先从原有的父容器中移除
    if (child.parent) {
      child.parent.children.delete(child);
    }

    // 设置新的父容器
    child.parent = this;

    // 添加到子容器集合
    this.children.add(child);

    return this;
  }

  /**
   * 从当前容器中移除一个子容器
   *
   * @param child 要移除的子容器
   * @returns 如果移除成功返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * const parentContainer = new Container({ name: 'parent' });
   * const childContainer = new Container({ name: 'child' });
   *
   * parentContainer.addChild(childContainer);
   * parentContainer.removeChild(childContainer); // 返回 true
   * ```
   */
  removeChild(child: Container): boolean {
    if (child.parent !== this) {
      return false;
    }

    child.parent = undefined;
    return this.children.delete(child);
  }

  /**
   * 移除当前容器的 parent 绑定关系
   * 将容器变为根容器（无父容器）
   *
   * 支持以下场景：
   * 1. 将容器从其父容器中分离
   * 2. 将容器变为独立的根容器
   * 3. 支持链式调用
   *
   * @returns 返回当前容器实例，支持链式调用
   * @throws 如果当前容器已销毁
   *
   * @example
   * ```typescript
   * const parentContainer = new Container({ name: 'parent' });
   * const childContainer = new Container({ parent: parentContainer, name: 'child' });
   *
   * // 移除 parent 绑定关系
   * childContainer.removeParent();
   * expect(childContainer.getParent()).toBeUndefined();
   * expect(parentContainer.getChildren()).not.toContain(childContainer);
   *
   * // 链式调用
   * childContainer.removeParent().addChild(anotherContainer);
   * ```
   */
  removeParent(): this {
    if (this.destroyed) {
      throw new Error(`Cannot remove parent of destroyed container: ${this.name}`);
    }

    // 从原有的父容器中移除自己
    if (this.parent) {
      this.parent.children.delete(this);
      this.parent = undefined;
    }

    return this;
  }

  /**
   * 更换容器的父容器
   *
   * 支持以下场景：
   * 1. 将容器从一个父容器移动到另一个父容器
   * 2. 将容器从有父容器的状态变为无父容器（根容器）
   * 3. 将无父容器的容器设置一个新的父容器
   * 4. 支持链式调用
   *
   * @param newParent 新的父容器，如果为 undefined 则将容器变为根容器
   * @returns 返回当前容器实例，支持链式调用
   * @throws 如果当前容器已销毁、新父容器已销毁、或会形成循环引用
   *
   * @example
   * ```typescript
   * const root = new Container({ name: 'root' });
   * const parent1 = new Container({ name: 'parent1' });
   * const parent2 = new Container({ name: 'parent2' });
   * const child = new Container({ parent: parent1, name: 'child' });
   *
   * // 将 child 从 parent1 移动到 parent2
   * child.setParent(parent2);
   * expect(child.getParent()).toBe(parent2);
   * expect(parent1.getChildren()).not.toContain(child);
   * expect(parent2.getChildren()).toContain(child);
   *
   * // 将 child 变为根容器
   * child.setParent(undefined);
   * expect(child.getParent()).toBeUndefined();
   *
   * // 链式调用
   * child.setParent(parent1).setParent(parent2);
   * ```
   */
  setParent(newParent: Container | undefined): this {
    if (this.destroyed) {
      throw new Error(`Cannot change parent of destroyed container: ${this.name}`);
    }

    if (newParent && newParent.destroyed) {
      throw new Error(`Cannot set destroyed container as parent: ${newParent.name}`);
    }

    // 检查是否会形成循环引用
    if (newParent && newParent.isDescendantOf(this)) {
      throw new Error(
        `Cannot set parent: would create circular reference. ` +
          `New parent "${newParent.name}" is already a descendant of "${this.name}"`
      );
    }

    // 从原有的父容器中移除自己
    if (this.parent) {
      this.parent.children.delete(this);
    }

    // 设置新的父容器
    this.parent = newParent;

    // 添加到新父容器的子容器集合
    if (newParent) {
      newParent.children.add(this);
    }

    return this;
  }

  /**
   * 获取容器的完整路径（用于调试）
   */
  getPath(): string | Symbol {
    if (!this.parent) {
      return this.name;
    }
    return `${this.parent.getPath()} > ${this.name}`;
  }

  /**
   * 获取所有已注册的服务标识符
   */
  getServiceIdentifiers(): ServiceIdentifier[] {
    return Array.from(this.services.keys());
  }

  /**
   * 通过 Service 实例获取对应的容器（静态方法）
   * 使用 WeakMap 存储实例和容器的关系，自动清理已销毁的实例
   *
   * @param instance Service 实例
   * @returns 容器实例，如果不存在返回 undefined
   *
   * @example
   * ```typescript
   * const userService = container.resolve('userService');
   * const containerOfService = Container.getContainerOf(userService);
   * ```
   */
  static getContainerOf(instance: object): Container | undefined {
    return globalInstanceContainerMap.get(instance);
  }

  /**
   * 将实例与容器关联（内部方法）
   * 在实例化时自动调用，建立 WeakMap 关系
   *
   * @param instance Service 实例
   * @param container 容器实例
   */
  static setContainerOf(instance: object, container: Container): void {
    globalInstanceContainerMap.set(instance, container);
  }

  /**
   * 私有方法：获取服务定义（支持分层查找）
   */
  private getServiceDefinition(identifier: ServiceIdentifier): ServiceDefinition | undefined {
    // 先查找当前容器
    if (this.services.has(identifier)) {
      return this.services.get(identifier);
    }

    // 再查找父容器
    if (this.parent) {
      return this.parent.getServiceDefinition(identifier);
    }

    return undefined;
  }

  /**
   * 私有方法：获取服务定义及其所在的容器（支持分层查找）
   * 返回找到定义的容器，以便在该容器上实例化
   */
  private getServiceDefinitionWithContainer(
    identifier: ServiceIdentifier
  ): { definition: ServiceDefinition; container: Container } | undefined {
    // 先查找当前容器
    if (this.services.has(identifier)) {
      return {
        definition: this.services.get(identifier)!,
        container: this,
      };
    }

    // 再查找父容器
    if (this.parent) {
      return this.parent.getServiceDefinitionWithContainer(identifier);
    }

    return undefined;
  }

  /**
   * 受保护方法：实例化服务
   * 由 resolve/tryResolve 调用，在找到服务定义的容器上执行实例化
   */
  protected instantiate<T = any>(definition: ServiceDefinition<T>): T {
    // 如果已经有实例且是单例，直接返回
    if (definition.scope === ServiceScopeEnum.Singleton && definition.instance) {
      return definition.instance;
    }

    let instance: T;

    // 判断是否是工厂函数
    if (typeof definition.factory === 'function') {
      // 检查是否是 Service 类（继承自 Service）
      if (isServiceClass(definition.factory)) {
        // 设置当前正在实例化的容器，以便在 Service 构造函数中获取
        setCurrentInstantiatingContainer(this);
        try {
          // 调用构造函数
          instance = new (definition.factory as any)(this);
          Container.setContainerOf(instance as Service, this);
        } finally {
          // 清除当前正在实例化的容器
          setCurrentInstantiatingContainer(null);
        }
      } else {
        try {
          setCurrentInstantiatingContainer(this);
          // 是工厂函数
          instance = (definition.factory as ServiceFactory<T>)(this);
          // 验证工厂函数返回的实例必须是 Service 的实例
          if (instance && typeof instance === 'object') {
            if (!(instance instanceof Service)) {
              throw new Error(
                `Factory function must return a Service instance. ` +
                  `Got ${instance.constructor?.name || typeof instance} instead. ` +
                  `Identifier: ${String(definition.identifier)}`
              );
            }
            Container.setContainerOf(instance, this);
          } else {
            throw new Error(
              `Factory function must return a Service instance. ` +
                `Got ${typeof instance} instead. ` +
                `Identifier: ${String(definition.identifier)}`
            );
          }
        } finally {
          setCurrentInstantiatingContainer(null);
        }
      }
    } else {
      throw new Error('Invalid factory type. Expected ServiceClass or ServiceFactory.');
    }

    // 如果是单例，缓存实例
    if (definition.scope === ServiceScopeEnum.Singleton) {
      definition.instance = instance;
    }

    return instance;
  }

  /**
   * 检查当前容器是否是指定容器的后代
   * 用于检测循环引用
   *
   * @param ancestor 要检查的容器
   * @returns 如果当前容器是指定容器的后代返回 true
   *
   * @private
   */
  private isDescendantOf(ancestor: Container): boolean {
    let current: Container | undefined = this;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
}

/**
 * 创建全局容器实例
 */
export const createContainer = (name?: string): Container => {
  return new Container({ name });
};
