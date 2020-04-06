import { useMemo, useEffect } from 'react';
import { container, ScopeType } from '../../ioc';
import { Service } from '../../service';
import { ConstructorOf, ServiceResult } from '../../types';
import { useServiceInstance } from './useServiceInstance';

import { Transient, Singleton, Request } from '../../symbols';
import { useDefault } from './useDefault';

export interface UseServiceOptions {
  scope?: ScopeType;
  resetOnUnmount?: boolean;
}

export function useService<M extends Service>(
  serviceIdentifier: ConstructorOf<M>,
  options?: UseServiceOptions
): ServiceResult<M> {
  const _options = useDefault(options, {
    scope: Singleton,
    // do not make this params true default
    resetOnUnmount: false
  });

  const service: ServiceResult<M> = useMemo(() => {
    return container.resolveServiceInScope<M>(serviceIdentifier, _options.scope!);
  }, [_options.scope, serviceIdentifier]);

  useEffect(() => {
    // resetOnUnmount
    if (_options.scope !== Transient && _options.scope !== Request && _options.resetOnUnmount) {
      return () => {
        // TODO
        // service.dispatch('reset', service.defaultState);
      };
    }
    return undefined;
  }, [_options.resetOnUnmount, _options.scope, service]);

  const serviceInstanceOptions = useMemo(
    () => ({
      destroyOnUnmount: _options.scope === Transient || _options.scope === Request
    }),
    [_options.scope]
  );

  return useServiceInstance(service, serviceInstanceOptions);
}
