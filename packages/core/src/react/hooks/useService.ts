import { useMemo, useEffect, useState, useCallback } from 'react';
import { container, ScopeType, Transient, Singleton, Request } from '@rabjs/ioc';
import { observe, unobserve } from '@rabjs/observer-util';

import { Service } from '../../service';
import { ConstructorOf, ServiceResult } from '../../types';
import { useServiceInstance } from './useServiceInstance';

import { useDefault } from './useDefault';
import scheduler from '../scheduler';

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
    resetOnUnmount: false,
  });

  const service: ServiceResult<M> = useMemo(() => {
    return container.resolveInScope<M>(serviceIdentifier, _options.scope!);
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
      destroyOnUnmount: _options.scope === Transient || _options.scope === Request,
    }),
    [_options.scope]
  );

  return useServiceInstance(service, serviceInstanceOptions);
}

export function useViewService<M extends Service, S>(
  serviceIdentifier: ConstructorOf<M>,
  selector: (service: ServiceResult<M>) => S,
  options?: UseServiceOptions
) {
  const service = useService(serviceIdentifier, options);
  const [, setState] = useState({});
  const triggerRender = useCallback(() => setState({}), []);
  const getState = useMemo(
    () =>
      observe(() => selector(service), {
        scheduler: () => {
          return scheduler.add(triggerRender);
        },
      }),
    // Adding the original Comp here is necessary to make React Hot Reload work
    // it does not affect behavior otherwise
    [selector, service]
  );
  useEffect(() => {
    return () => unobserve(getState);
  }, []);
  return [getState(), service];
}
