import { ObservableOptions } from './types';

export const proxyToRaw = new WeakMap<object, object>();
export const rawToProxy = new WeakMap<object, object>();

// stores custom proxy handlers for observables
export const rawToOptions = new WeakMap<object, ObservableOptions>();
