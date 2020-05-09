import { Service } from './service';
import { ConstructorOf } from './types';
import { container, ScopeType } from './ioc';
import { Singleton } from './symbols';

export interface GetServiceOptions {
  scope?: ScopeType;
}

export const getServiceInstance = function<M extends Service>(
  serviceIdentifier: ConstructorOf<M>,
  options?: GetServiceOptions
) {
  const _options = Object.assign({ scope: Singleton }, options);
  return container.resolveServiceInScope<M>(serviceIdentifier, _options.scope!);
};
