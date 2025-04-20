import { container, ScopeType, Singleton } from '@rabjs/ioc';
import { ConstructorOf } from './types';

export interface GetServiceOptions {
  scope?: ScopeType;
}

export const getServiceInstance = function <M>(
  serviceIdentifier: ConstructorOf<M>,
  options?: GetServiceOptions
) {
  const _options = Object.assign({ scope: Singleton }, options);
  return container.resolveInScope<M>(serviceIdentifier, _options.scope!);
};
export const getService = getServiceInstance;
