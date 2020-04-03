import { useEffect } from 'react';
import { ServiceResult } from './types';
import { useDefault } from './useDefault';
import { Service } from '../../service';

export interface UseServiceInstanceOptions {
  destroyOnUnmount?: boolean;
}

export function useServiceInstance<M extends Service>(
  service: M,
  options?: UseServiceInstanceOptions
): ServiceResult<M> {
  const _options = useDefault(options, {
    destroyOnUnmount: false
  });
  useEffect(
    () => () => {
      if (_options.destroyOnUnmount) {
        // TODO
      }
    },
    [_options.destroyOnUnmount, service]
  );
  // @ts-ignore
  return service as ServiceResult<M>;
}
