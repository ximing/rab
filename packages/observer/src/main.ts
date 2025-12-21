// Observable API - Create reactive objects
export { observable } from './observable';
export { shadowObservable } from './shadowObservable';

// Observer API - Create reactions that respond to observable changes
export { observe, unobserve } from './observer';
export type { ObserveOptions } from './observer';

// Configuration API - Configure global defaults
export { configure, resetGlobalConfig } from './configure';
export type { ConfigureOptions } from './configure';

// Re-export types for advanced usage
export type { Reaction, ReactionScheduler, Operation, OperationType } from './internals/types';

// Re-export utility functions
export { isObservable, raw } from './internals/utils';

// Re-export handlers for testing
export { baseProxyHandler as proxyHandlers } from './internals/handlers/baseProxyHandler';
export { shadowProxyHandler } from './internals/handlers/shadowProxyHandler';
