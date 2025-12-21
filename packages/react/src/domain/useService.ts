/**
 * useService Hook - 在 React 组件中获取服务实例
 *
 * 按照 Provider 作用域链向上查找服务
 * 找到后,服务实例与 Provider 的生命周期一致
 *
 * 对于 Singleton Scope 的服务:
 * - 每次从 container 解析，返回同一实例
 *
 * 对于 Transient Scope 的服务:
 * - 服务实例会被缓存在组件 ref 中，与当前组件实例绑定
 * - 如果 ref 中存在对应实例，直接返回
 * - 否则先从 container 中 resolve，然后缓存下来再返回
 * - 只有在 Container 变化时才会重新生成
 * - 避免每次渲染都创建新实例
 */

import type { Service } from '@rabjs/service';
import { getGlobalContainer, ServiceScope } from '@rabjs/service';
import { useContext, useRef } from 'react';

import { useDomainContext } from './domainContext';
import { StrictContext } from './strictContext';
import type { ServiceIdentifier } from './types';

/**
 * useService Hook 的选项配置
 */
export interface UseServiceOptions {
  /**
   * 服务作用域（Singleton 或 Transient）
   * @deprecated 此参数已弃用，请使用其他方式指定作用域
   */
  scope?: ServiceScope;
}

/**
 * useService Hook (重载1: 传入类构造函数，自动推导类型，不指定 scope)
 *
 * @param identifier Service 类构造函数
 * @returns 服务实例
 * @throws 如果没有找到服务或不在 Provider 内部
 *
 * @example
 * ```tsx
 * const domain1Service = useService(Domain1Service); // 自动推导为 Domain1Service 类型
 * ```
 */
export function useService<T extends Service>(identifier: new (...args: any[]) => T): T;

/**
 * useService Hook (重载2: 传入字符串或 Symbol，需要显式指定泛型，不指定 scope)
 *
 * @param identifier 服务标识符（字符串或 Symbol）
 * @returns 服务实例
 * @throws 如果没有找到服务或不在 Provider 内部
 *
 * @example
 * ```tsx
 * const domain1Service = useService<Domain1Service>('domain1Service'); // 需要显式指定泛型
 * ```
 */
export function useService<T extends Service = Service>(identifier: string | symbol): T;

/**
 * useService Hook (重载3: 传入类构造函数和选项)
 *
 * @param identifier Service 类构造函数
 * @param options 选项配置
 * @returns 服务实例
 * @throws 如果没有找到服务或不在 Provider 内部
 *
 * @example
 * ```tsx
 * const domain1Service = useService(Domain1Service, { scope: ServiceScope.Transient });
 * ```
 */
export function useService<T extends Service>(
  identifier: new (...args: any[]) => T,
  options?: UseServiceOptions
): T;

/**
 * useService Hook (重载4: 传入字符串或 Symbol 和选项，需要显式指定泛型)
 *
 * @param identifier 服务标识符（字符串或 Symbol）
 * @param options 选项配置
 * @returns 服务实例
 * @throws 如果没有找到服务或不在 Provider 内部
 *
 * @example
 * ```tsx
 * const domain1Service = useService<Domain1Service>('domain1Service', { scope: ServiceScope.Transient });
 * ```
 */
export function useService<T extends Service = Service>(
  identifier: string | symbol,
  options?: UseServiceOptions
): T;

/**
 * useService Hook (实现)
 *
 * 支持两种作用域:
 * - Singleton: 每次从 container 解析，返回同一实例
 * - Transient: 实例缓存在组件 ref 中，与组件生命周期绑定
 *   - 如果 ref 中存在对应实例，直接返回
 *   - 否则先从 container 中 resolve，然后缓存下来再返回
 * */
export function useService<T extends Service = Service>(
  identifier: ServiceIdentifier<T>,
  options?: UseServiceOptions
): T {
  const { container } = useDomainContext();
  const cacheRef = useRef<Map<string | symbol | Function, T>>(new Map());
  const strictContext = useContext(StrictContext);

  try {
    const isTransient = options?.scope === ServiceScope.Transient;

    // 对于 Transient Scope，先检查 ref 缓存
    if (isTransient && cacheRef.current.has(identifier)) {
      return cacheRef.current.get(identifier)!;
    }
    // 非严格模式下,如果没有注册就在全局给他注册一下
    // 兼容旧版本的RSJS逻辑
    if (!strictContext && !container.has(identifier)) {
      getGlobalContainer().register(identifier);
    }

    // 从 container 中 resolve，再非严格模式下，也会一层一层往上找，直到找到为止
    // 所以直接兼容 非严格模式下注册到 global上的case
    let resolvedService: T;
    if (typeof identifier === 'function') {
      resolvedService = container.resolve(identifier as new (...args: any[]) => T);
    } else {
      resolvedService = container.resolve<T>(identifier as string | symbol);
    }

    // 对于 Transient Scope，缓存到 ref 中
    if (isTransient) {
      cacheRef.current.set(identifier, resolvedService);
    }

    return resolvedService;
  } catch (error) {
    const containerName =
      typeof container.getName === 'function' ? String(container.getName()) : 'unknown';
    throw new Error(
      `Failed to resolve service ${String(identifier)} in container "${containerName}". ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * useContainer Hook
 *
 * 获取当前 Provider 的容器实例
 * 用于高级场景，如手动注册服务或访问容器信息
 *
 * @returns 当前容器实例
 * @throws 如果不在 Provider 内部
 *
 * @example
 * ```tsx
 * const container = useContainer();
 * const stats = container.getStats();
 * ```
 */
export function useContainer() {
  const context = useDomainContext();

  return context.container;
}
