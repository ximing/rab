import {
  useMemo,
  useEffect,
  useRef,
  useContext,
  createContext,
  FC,
  ReactNode,
  createElement,
} from 'react';
import { container, ScopeType, Transient, Singleton, Request } from '@rabjs/ioc';

import { ConstructorOf, ServiceResult } from '../../types';
import { useServiceInstance } from './useServiceInstance';

import { useDefault } from './useDefault';

// 创建一个Context用于Request作用域
const RequestScopeContext = createContext<{ scopeId: string | null }>({ scopeId: null });

// 创建一个Provider组件，用于提供Request作用域
export const RequestScopeProvider: FC<{ scopeId: string; children: ReactNode }> = ({
  scopeId,
  children,
}) => {
  return createElement(RequestScopeContext.Provider, { value: { scopeId } }, children);
};

// 用于跟踪Request作用域的引用计数
const requestScopeRefCounts = new Map<string, number>();
// 用于跟踪Request作用域的服务实例
const requestScopeInstances = new Map<string, any>();

export interface UseServiceOptions {
  scope?: ScopeType;
  resetOnUnmount?: boolean;
  requestScopeId?: string;
}

/**
 * Hook to use a service instance
 * @param serviceIdentifier The service class constructor
 * @param options Options for the service
 * @returns A service instance with $model property for tracking loading and error states
 *
 * The returned service has a $model property with the following structure:
 * ```typescript
 * $model: {
 *   [methodName: string]: {
 *     loading: boolean;
 *     error: Error | null;
 *   }
 * }
 * ```
 *
 * This property is automatically populated for all async methods in the service.
 *
 * ## Lifecycle Options
 *
 * - **Singleton** (default): The service is a singleton, shared across the entire application
 * - **Transient**: Each component gets its own service instance, unique within the component's lifecycle
 * - **Request**: The service is unique within a specific scope (e.g., a component tree)
 *   - Use `RequestScopeProvider` to define a scope
 *   - Or provide a `requestScopeId` to manually specify a scope
 */
export function useService<M>(
  serviceIdentifier: ConstructorOf<M>,
  options?: UseServiceOptions
): ServiceResult<M> {
  const _options = useDefault(options, {
    scope: Singleton,
    resetOnUnmount: false,
    requestScopeId: undefined,
  });

  // 获取Request作用域的ID
  const { scopeId: contextScopeId } = useContext(RequestScopeContext);
  const requestScopeId = _options.requestScopeId || contextScopeId;

  // 为Transient作用域创建一个唯一的ID
  const transientId = useRef<string | null>(null);
  if (_options.scope === Transient && !transientId.current) {
    transientId.current = Math.random().toString(36).substring(2, 15);
  }

  // 使用useRef来跟踪组件是否已卸载
  const isUnmounted = useRef(false);

  // 对于Request作用域，增加引用计数
  useEffect(() => {
    if (_options.scope === Request && requestScopeId) {
      const currentCount = requestScopeRefCounts.get(requestScopeId) || 0;
      requestScopeRefCounts.set(requestScopeId, currentCount + 1);

      return () => {
        if (isUnmounted.current) return;

        const count = requestScopeRefCounts.get(requestScopeId) || 1;
        requestScopeRefCounts.set(requestScopeId, count - 1);

        if (count - 1 === 0) {
          const instance = requestScopeInstances.get(requestScopeId);
          if (instance) {
            if (typeof (instance as any).destroy === 'function') {
              (instance as any).destroy();
            }

            if (container.isBound(serviceIdentifier)) {
              container.unbind(serviceIdentifier);
            }

            requestScopeInstances.delete(requestScopeId);
          }
        }
      };
    }
    return undefined;
  }, [_options.scope, requestScopeId, serviceIdentifier]);

  // 在组件卸载时设置标志
  useEffect(() => {
    return () => {
      isUnmounted.current = true;
    };
  }, []);

  const service: ServiceResult<M> = useMemo(() => {
    let scopeId: ScopeType;

    if (_options.scope === Request && requestScopeId) {
      scopeId = requestScopeId;
    } else if (_options.scope === Transient && transientId.current) {
      scopeId = transientId.current;
    } else {
      scopeId = _options.scope;
    }

    const instance = container.resolveInScope<ServiceResult<M>>(serviceIdentifier, scopeId);

    if (_options.scope === Request && requestScopeId) {
      requestScopeInstances.set(requestScopeId, instance);
    }

    return instance;
  }, [_options.scope, requestScopeId, transientId.current, serviceIdentifier]);

  useEffect(() => {
    if (_options.scope !== Transient && _options.scope !== Request && _options.resetOnUnmount) {
      return () => {
        if (isUnmounted.current) return;
        // TODO: Implement reset logic
      };
    }
    return undefined;
  }, [_options.resetOnUnmount, _options.scope, service]);

  const shouldDestroyOnUnmount =
    _options.scope === Transient || (_options.scope === Request && !requestScopeId);

  const serviceInstanceOptions = useMemo(
    () => ({
      destroyOnUnmount: shouldDestroyOnUnmount,
    }),
    [shouldDestroyOnUnmount]
  );

  return useServiceInstance(service, serviceInstanceOptions);
}
