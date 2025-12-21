import { proxyToRaw } from './proxyRawMap';

export const hasOwnProperty = Object.prototype.hasOwnProperty;
// Type guard to check if value is an object
export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function isObservable(obj: unknown): boolean {
  return !!obj && proxyToRaw.has(obj);
}

export function raw<T extends object>(obj: T): T {
  return (proxyToRaw.get(obj) as T) || obj;
}
