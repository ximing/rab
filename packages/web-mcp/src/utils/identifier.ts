import type { ServiceDescriptor } from '../types';

export function getIdentifierLabel(id: string | symbol | (new (...args: any[]) => any)): string {
  if (typeof id === 'function') return (id as Function).name || 'AnonymousService';
  if (typeof id === 'string') return id;
  return `Symbol(${(id as symbol).description ?? ''})`;
}

export function getIdentifierType(id: string | symbol | (new (...args: any[]) => any)): ServiceDescriptor['identifierType'] {
  if (typeof id === 'function') return 'constructor';
  if (typeof id === 'string') return 'string';
  return 'symbol';
}
