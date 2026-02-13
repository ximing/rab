import { observable } from '@rabjs/observer';

import { cleanupAllDebounces } from './decorators/debounce';
import { cleanupAllMemos } from './decorators/memo';
import { setupEventListeners, cleanupEventListeners } from './decorators/on';
import { cleanupAllThrottles } from './decorators/throttle';
import { EventSystem, type EventScope } from './event';
import { Container } from './ioc';
import { getCurrentInstantiatingContainer } from './ioc/globals';

/**
 * 方法状态类型定义
 */
export interface MethodState {
  loading: boolean;
  error: Error | null;
}

/**
 * 提取类中所有方法的类型
 * 将方法转换为对应的状态对象类型
 */
export type ExtractMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? MethodState : never;
};

/**
 * 基础 Service 类
 * 提供自动的 loading 和 error 状态管理
 *
 * 核心特性：
 * - 默认 observable，所有属性和状态都是响应式的
 * - 所有方法默认都是 action（自动批量更新，同步和异步方法都支持）
 * - 支持使用 @SyncAction 装饰器排除特定方法
 * - 自动为所有方法创建 loading 和 error 状态
 * - 支持异步方法的状态追踪
 * - 批量更新通过 @rabjs/observer 的全局 configure 配置
 * - 完整的 TypeScript 类型推导
 * - 轻量级实现，不依赖 inversify
 *
 * @example
 * ```typescript
 * // 1. 在应用启动时配置全局 scheduler（可选）
 * import { configure } from '@rabjs/observer';
 * import { unstable_batchedUpdates } from 'react-dom';
 *
 * configure({\n *   scheduler: unstable_batchedUpdates
 * });
 *
 * // 2. 定义 Service
 * class UserService extends Service {
 *   async fetchUser(id: string) {
 *     return fetch(`/api/users/${id}`).then(r => r.json());
 *   }
 *
 *   syncData() {
 *     // 同步方法也会自动批量更新
 *     this.data = {};
 *   }
 *
 *   @SyncAction
 *   directUpdate() {
 *     // 使用 SyncAction 装饰器排除批量更新
 *   }
 * }
 *
 * // 3. 使用 Service
 * const service = new UserService();
 * // service.$model.fetchUser 会自动推导为 { loading: boolean; error: Error | null }
 * // service 本身是 observable 的，所有属性变化都会触发响应
 *
 * service.fetchUser('123').then(() => {
 *   console.log(service.$model.fetchUser.loading);
 *   console.log(service.$model.fetchUser.error);
 * });
 * ```
 */
export class Service {
  /**
   * 响应式状态对象，包含所有方法的 loading 和 error 状态
   * 类型会根据子类的方法自动推导
   */
  public $model: ExtractMethods<this> = {} as ExtractMethods<this>;
  protected _container: Container;

  constructor() {
    // 获取当前实例关联的容器（由 Container 在实例化时建立）
    // 首先尝试从 WeakMap 中获取，如果失败则从当前正在实例化的容器中获取
    let container: Container | null | undefined = Container.getContainerOf?.(this);
    if (!container) {
      container = getCurrentInstantiatingContainer();
    }
    this._container = container!;

    // this.__setupMethodInterception(this);
    // 先将实例转换为 observable
    const observableInstance = observable(this);

    // 如果有容器关联，立即将关系转移到 observable 实例
    // 这样在 __setupMethodInterception 中访问 @Inject 装饰的属性时可以获取容器
    if (container) {
      Container.setContainerOf?.(observableInstance, container);
    }

    // 然后在 observable 实例上设置方法拦截
    this.__setupMethodInterception(observableInstance);

    // 最后设置事件监听器（传递容器以确保能够正确获取）
    // 注意：这里必须传递 container，因为 observableInstance 可能还没有被正确关联到容器
    setupEventListeners(observableInstance, container!);

    // 返回 observable 实例
    return observableInstance;
  }

  /**
   * 设置方法拦截，自动管理 loading 和 error 状态
   */
  private __setupMethodInterception(instance: this) {
    const prototype = Object.getPrototypeOf(instance);
    const methodNames = this.__getMethodNames(prototype);

    methodNames.forEach(methodName => {
      const originalMethod = prototype[methodName];

      if (typeof originalMethod === 'function') {
        // 初始化状态
        (instance.$model as any)[methodName] = {
          loading: false,
          error: null,
        };

        // 检查是否标记为 @SyncAction
        const isNoAction = originalMethod.__isNoAction === true;

        // 包装方法以拦截调用，绑定到 observable 实例
        const boundMethod = originalMethod.bind(instance);
        (instance as any)[methodName] = this.__createMethodWrapper(
          boundMethod,
          methodName,
          isNoAction
        );
      }
    });
  }

  /**
   * 获取类中所有方法名称（排除 constructor 和私有方法）
   * 使用 getOwnPropertyDescriptor 来避免触发 getter
   */
  private __getMethodNames(prototype: any): string[] {
    const methodNames: string[] = [];

    // 遍历原型链上的所有属性
    let current = prototype;
    while (current && current !== Object.prototype && current !== Service.prototype) {
      Object.getOwnPropertyNames(current).forEach(name => {
        if (name !== 'constructor' && !name.startsWith('_') && !methodNames.includes(name)) {
          // 使用 getOwnPropertyDescriptor 来检查属性类型，避免触发 getter
          const descriptor = Object.getOwnPropertyDescriptor(current, name);
          if (descriptor && descriptor.value && typeof descriptor.value === 'function') {
            methodNames.push(name);
          }
        }
      });
      current = Object.getPrototypeOf(current);
    }

    return methodNames;
  }

  /**
   * 创建方法包装器，用于拦截方法调用并管理状态
   * 批量更新通过 observable 的全局 configure 配置自动处理
   *
   * @param originalMethod 原始方法
   * @param methodName 方法名称
   * @param isNoAction 是否排除 Action（不使用批量更新）
   */
  private __createMethodWrapper(
    originalMethod: Function,
    methodName: string,
    isNoAction: boolean
  ): Function {
    const observableInstance = this;
    return function (this: any, ...args: any[]) {
      // 执行方法并收集结果
      let result: any;
      if (!isNoAction) {
        // 对于 Action 方法，observable 会自动处理批量更新
        result = originalMethod(...args);
      } else {
        // 对于 @SyncAction 方法，直接执行
        result = originalMethod(...args);
      }

      // 检查是否是 Promise（异步方法）
      if (result && typeof result.then === 'function') {
        const modelState = observableInstance.$model[methodName];
        // 异步方法：立即设置 loading 状态
        modelState.loading = true;
        if (modelState.error) {
          modelState.error = null;
        }

        return result
          .then((res: any) => {
            modelState.loading = false;
            return res;
          })
          .catch((err: any) => {
            modelState.loading = false;
            modelState.error = err;
            throw err;
          });
      }

      return result;
    };
  }

  /**
   * 监听事件
   *
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @param scope 事件作用域，默认为 'container'（容器级别），可选 'global'（全局）
   *
   * @example
   * ```typescript
   * class UserService extends Service {
   *   constructor(container: Container) {
   *     super(container);
   *
   *     // 监听容器级别事件（默认）
   *     this.on('user:login', (user) => {
   *       console.log('User logged in:', user);
   *     });
   *
   *     // 监听全局事件
   *     this.on('app:initialized', () => {
   *       console.log('App initialized');
   *     }, 'global');
   *   }
   * }
   * ```
   */
  public on<T = any>(
    eventName: string,
    handler: (data: T) => void,
    scope: EventScope = 'container'
  ): this {
    const emitter = EventSystem.getEmitter(scope, this._container);
    emitter.on(eventName, handler);
    return this;
  }

  /**
   * 监听一次性事件（触发一次后自动移除）
   *
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @param scope 事件作用域，默认为 'container'（容器级别），可选 'global'（全局）
   *
   * @example
   * ```typescript
   * class UserService extends Service {
   *   constructor(container: Container) {
   *     super(container);
   *
   *     // 监听容器级别一次性事件
   *     this.once('data:loaded', (data) => {
   *       console.log('Data loaded:', data);
   *     });
   *
   *     // 监听全局一次性事件
   *     this.once('app:ready', () => {
   *       console.log('App ready');
   *     }, 'global');
   *   }
   * }
   * ```
   */
  public once<T = any>(
    eventName: string,
    handler: (data: T) => void,
    scope: EventScope = 'container'
  ): this {
    const emitter = EventSystem.getEmitter(scope, this._container);
    emitter.once(eventName, handler);
    return this;
  }

  /**
   * 移除事件监听器
   *
   * @param eventName 事件名称
   * @param handler 事件处理函数（可选，如果不提供则移除该事件的所有监听器）
   * @param scope 事件作用域，默认为 'container'（容器级别），可选 'global'（全局）
   *
   * @example
   * ```typescript
   * class UserService extends Service {
   *   private loginHandler = (user: any) => {
   *     console.log('User logged in:', user);
   *   };
   *
   *   constructor(container: Container) {
   *     super(container);
   *     this.on('user:login', this.loginHandler);
   *   }
   *
   *   destroy() {
   *     // 移除特定监听器
   *     this.off('user:login', this.loginHandler);
   *
   *     // 移除事件的所有监听器
   *     this.off('user:login');
   *
   *     super.destroy();
   *   }
   * }
   * ```
   */
  public off(eventName: string, handler?: Function, scope: EventScope = 'container'): this {
    const emitter = EventSystem.getEmitter(scope, this._container);
    if (handler) {
      emitter.off(eventName, handler as any);
    } else {
      emitter.removeAllListeners(eventName);
    }
    return this;
  }

  /**
   * 发送事件
   *
   * @param eventName 事件名称
   * @param data 事件数据（可选）
   * @param scope 事件作用域，默认为 'container'（容器级别），可选 'global'（全局）
   *
   * @example
   * ```typescript
   * class UserService extends Service {
   *   login(username: string, password: string) {
   *     // 登录逻辑...
   *     const user = { id: 1, name: username };
   *
   *     // 发送容器级别事件
   *     this.emit('user:login', user);
   *
   *     // 发送全局事件
   *     this.emit('app:user-logged-in', user, 'global');
   *   }
   *
   *   logout() {
   *     // 登出逻辑...
   *     this.emit('user:logout');
   *   }
   * }
   * ```
   */
  public emit<T = any>(eventName: string, data?: T, scope: EventScope = 'container'): this {
    const emitter = EventSystem.getEmitter(scope, this._container);
    emitter.emit(eventName, data);
    return this;
  }

  /**
   * 销毁 Service 实例，清理所有装饰器绑定的事件和资源
   *
   * 清理内容包括：
   * - @On 和 @Once 装饰器绑定的事件监听器
   * - @Debounce 装饰器的定时器
   * - @Throttle 装饰器的定时器
   * - @Memo 装饰器的缓存和响应式追踪
   *
   * @example
   * ```typescript
   * class UserService extends Service {
   *   @On('user:login')
   *   onUserLogin(user: any) {
   *     this.currentUser = user;
   *   }
   *
   *   @Debounce(300)
   *   search(keyword: string) {
   *     return fetch(`/api/search?q=${keyword}`);
   *   }
   *
   *   @Memo()
   *   get totalAge() {
   *     return this.users.reduce((sum, user) => sum + user.age, 0);
   *   }
   * }
   *
   * const service = new UserService();
   * // ... 使用 service ...
   * service.destroy(); // 清理所有资源
   * ```
   */
  public destroy(): void {
    // 清理 @On 和 @Once 装饰器的事件监听器
    cleanupEventListeners(this);

    // 清理 @Debounce 装饰器的定时器
    cleanupAllDebounces(this);

    // 清理 @Throttle 装饰器的定时器
    cleanupAllThrottles(this);

    // 清理 @Memo 装饰器的缓存和响应式追踪
    cleanupAllMemos(this);
  }
}
