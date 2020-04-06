import { Container as InversifyContainer, interfaces, METADATA_KEY } from 'inversify';
import { isObservable, observable } from '@nx-js/observer-util';

import { ScopeKeySymbol, Singleton, Transient, Request, ServiceObserver } from '../symbols';
import { Service } from '../service';
import { ServiceResult } from '../types';

const getObserverService = (service: any) => {
  if (service instanceof Service && !isObservable(service)) {
    const observerService = observable(service);
    Reflect.defineMetadata(ServiceObserver, observerService, service);
    return observerService;
  }
  return service;
};
export type ScopeType = symbol | string | number;

export class Container {
  private container: InversifyContainer;
  constructor(container?: InversifyContainer) {
    this.container = container || new InversifyContainer();
  }

  bind<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>): interfaces.BindingToSyntax<T> {
    return this.container.bind(serviceIdentifier);
  }

  bindScope<T>(
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    scope: ScopeType = Singleton
  ): interfaces.BindingWhenOnSyntax<T> {
    const binding = this.bind<T>(serviceIdentifier).toSelf();
    switch (scope) {
      default:
      case Singleton:
        return binding.inSingletonScope();
      case Transient:
        return binding.inTransientScope();
      case Request:
        return binding.inRequestScope();
    }
  }

  bindProvider<T>(
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    fn: interfaces.ProviderCreator<T>
  ) {
    const binding = this.bind<T>(serviceIdentifier).toProvider<T>(fn);
    return binding;
  }

  unbind(serviceIdentifier: interfaces.ServiceIdentifier<any>) {
    this.container.unbind(serviceIdentifier);
  }

  unbindAll() {
    this.container.unbindAll();
  }

  get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>) {
    return this.container.get<T>(serviceIdentifier);
  }

  getNamed<T>(
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    named: string | number | symbol
  ): T {
    return this.getTagged<T>(serviceIdentifier, METADATA_KEY.NAMED_TAG, named);
  }

  getTagged<T>(
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    key: string | number | symbol,
    value: any
  ) {
    return this.container.getTagged<T>(serviceIdentifier, key, value);
  }

  getAll<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>): T[] {
    return this.container.getAll(serviceIdentifier);
  }

  getAllTagged<T>(
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    key: string | number | symbol,
    value: any
  ): T[] {
    return this.container.getAllTagged(serviceIdentifier, key, value);
  }

  getAllNamed<T>(
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    named: string | number | symbol
  ): T[] {
    return this.getAllTagged<T>(serviceIdentifier, METADATA_KEY.NAMED_TAG, named);
  }

  rebind<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>): interfaces.BindingToSyntax<T> {
    this.unbind(serviceIdentifier);
    return this.container.bind(serviceIdentifier);
  }

  applyMiddleware(...middlewares: interfaces.Middleware[]): void {
    this.container.applyMiddleware(...middlewares);
  }

  isBound(serviceIdentifier: interfaces.ServiceIdentifier<any>): boolean {
    return this.container.isBound(serviceIdentifier);
  }

  isBoundNamed(
    serviceIdentifier: interfaces.ServiceIdentifier<any>,
    named: string | number | symbol
  ): boolean {
    return this.isBoundTagged(serviceIdentifier, METADATA_KEY.NAMED_TAG, named);
  }

  isBoundTagged(
    serviceIdentifier: interfaces.ServiceIdentifier<any>,
    key: string | number | symbol,
    value: any
  ): boolean {
    return this.container.isBoundTagged(serviceIdentifier, key, value);
  }

  isBoundInScope<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, scope: ScopeType): boolean {
    return this.isBoundTagged(serviceIdentifier, ScopeKeySymbol, scope);
  }

  registerInScope<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, scope: ScopeType): void {
    if (!this.isBoundInScope(serviceIdentifier, scope)) {
      this.bindScope(serviceIdentifier, scope).whenTargetTagged(ScopeKeySymbol, scope);
    }
  }

  resolveInScope<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, scope: ScopeType): T {
    this.registerInScope(serviceIdentifier, scope);
    return this.getTagged(serviceIdentifier, ScopeKeySymbol, scope);
  }

  resolveServiceInScope<T extends Service>(
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    scope: ScopeType
  ): ServiceResult<T> {
    this.registerInScope(serviceIdentifier, scope);
    return getObserverService(this.getTagged(serviceIdentifier, ScopeKeySymbol, scope));
  }
}

export const container = new Container();
