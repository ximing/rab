import { baseProxyHandler } from "./handlers/base-proxy-handler";
import {
  createCollectionProxyHandlers,
  getHandlers,
  shouldInstrument,
} from "./handlers/collection-handler";
import { proxyToRaw, rawToOptions, deepRawToProxy } from "./proxy-raw-map";
import { storeObservable } from "./reaction-track";
import { normalizeCollectionEntries } from "./utils";
import type { ObservableOptions, ProxyHandlers } from "./types";

export function observable<T extends object>(
  obj: T,
  options?: ObservableOptions
): T;
export function observable<T extends object>(
  obj?: T,
  options?: ObservableOptions
): T | object;
export function observable<T extends object>(
  obj: T = {} as T,
  options?: ObservableOptions
): T {
  // if it is already an observable or it should not be wrapped, return it
  if (proxyToRaw.has(obj) || !shouldInstrument(obj)) {
    return obj;
  }
  // if it already has a cached observable wrapper, return it
  // otherwise create a new observable
  // (#6: deep 模式只查 deep 自己的缓存桶, 不与 shadow 模式串扰)
  return (deepRawToProxy.get(obj) as T) || createObservable(obj, options);
}

export function createObservable<T extends object>(
  obj: T,
  options?: ObservableOptions
): T {
  // 集合在包装前已有的 proxy key/value 条目统一归一化为 raw
  // （不变量『集合内部只持有 raw 身份』，详见 utils.normalizeCollectionEntries）
  normalizeCollectionEntries(obj);
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
    Object.assign(
      mergedHandlers,
      createCollectionProxyHandlers(options.collectionHandlers)
    );
  }

  const observableProxy = new Proxy(obj, mergedHandlers as ProxyHandler<T>);

  deepRawToProxy.set(obj, observableProxy);
  proxyToRaw.set(observableProxy, obj);

  if (options) {
    rawToOptions.set(obj, options);
  }

  // init basic data structures to save and cleanup later (observable.prop -> reaction) connections
  storeObservable(obj);
  return observableProxy as T;
}
