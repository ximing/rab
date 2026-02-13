import { baseProxyHandler } from './handlers/baseProxyHandler';
import {
  createCollectionProxyHandlers,
  getHandlers,
  shouldInstrument,
} from './handlers/collectionHandler';
import { proxyToRaw, rawToOptions, rawToProxy } from './proxyRawMap';
import { storeObservable } from './reactionTrack';
import type { ObservableOptions, ProxyHandlers } from './types';

export function observable<T extends object>(obj: T, options?: ObservableOptions): T;
export function observable<T extends object>(obj?: T, options?: ObservableOptions): T | object;
export function observable<T extends object>(obj: T = {} as T, options?: ObservableOptions): T {
  // if it is already an observable or it should not be wrapped, return it
  if (proxyToRaw.has(obj) || !shouldInstrument(obj)) {
    return obj;
  }
  // if it already has a cached observable wrapper, return it
  // otherwise create a new observable
  return (rawToProxy.get(obj) as T) || createObservable(obj, options);
}

export function createObservable<T extends object>(obj: T, options?: ObservableOptions): T {
  // Merge handlers, with custom handlers taking precedence
  const handlers = getHandlers(obj) || baseProxyHandler;
  const mergedHandlers: ProxyHandlers = { ...(handlers as ProxyHandlers) };

  // Override with custom handlers if provided
  if (options?.proxyHandlers) {
    Object.assign(mergedHandlers, options.proxyHandlers);
  }

  // For collection handlers, we need to wrap them in a special get handler
  // that properly delegates to the collection handlers object
  if (options?.collectionHandlers) {
    Object.assign(mergedHandlers, createCollectionProxyHandlers(options.collectionHandlers));
  }

  const observableProxy = new Proxy(obj, mergedHandlers as ProxyHandler<T>);

  rawToProxy.set(obj, observableProxy);
  proxyToRaw.set(observableProxy, obj);

  if (options) {
    rawToOptions.set(obj, options);
  }

  // init basic data structures to save and cleanup later (observable.prop -> reaction) connections
  storeObservable(obj);
  return observableProxy as T;
}
