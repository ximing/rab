// Observable API - Create reactive objects
export { observable } from './observable';
export { shadowObservable } from './shadow-observable';

// Observer API - Create reactions that respond to observable changes
export { observe, unobserve } from './observer';
export type { ObserveOptions } from './observer';

// Batch API - Coalesce notifications from a synchronous mutation block
export {
  batch,
  notify,
  getRunningReaction,
  untracked,
  isUntracked,
} from './internals/reaction-runner';

// Configuration API - Configure global defaults
export { configure, resetGlobalConfig } from './configure';
export type { ConfigureOptions } from './configure';

// Re-export types for advanced usage
export type {
  Reaction,
  ReactionScheduler,
  Operation,
  OperationType,
  // observable(obj, options) 的 options 类型 (第 1 轮审查 issue #3:
  // 公开签名真实接收 options 后, 消费方需要能按名导入该类型做注解)
  ObservableOptions,
} from './internals/types';

// Re-export utility functions
export { isObservable, raw } from './internals/utils';

// Re-export handlers for testing
export { baseProxyHandler as proxyHandlers } from './internals/handlers/base-proxy-handler';
export { shadowProxyHandler } from './internals/handlers/shadow-proxy-handler';
