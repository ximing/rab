import { useEffect } from 'react';
import { ServiceResult } from '../../types';
import { useDefault } from './useDefault';
import { container } from '@rabjs/ioc';

export interface UseServiceInstanceOptions {
  destroyOnUnmount?: boolean;
}

/**
 * Hook to manage a service instance
 * @param service The service instance
 * @param options Options for the service instance
 * @returns The service instance
 *
 * This hook handles the lifecycle of a service instance, including:
 * - Destroying the service instance when the component unmounts (if destroyOnUnmount is true)
 * - Cleaning up resources associated with the service instance
 */
export function useServiceInstance<M>(
  service: ServiceResult<M>,
  options?: UseServiceInstanceOptions
): ServiceResult<M> {
  const _options = useDefault(options, {
    destroyOnUnmount: false,
  });

  useEffect(
    () => () => {
      if (_options.destroyOnUnmount) {
        // 获取服务的构造函数
        const constructor = service.constructor;

        // 从容器中解绑服务
        if (container.isBound(constructor)) {
          // 调用服务的销毁方法（如果存在）
          if (typeof (service as any).destroy === 'function') {
            (service as any).destroy();
          }

          // 从容器中解绑服务
          container.unbind(constructor);
        }
      }
    },
    [_options.destroyOnUnmount, service]
  );

  return service;
}
