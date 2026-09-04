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

// 跨 realm 安全的 Map/Set 判定（issue #92 场景：vm/iframe/RN 远程调试），
// 与 collection-handler 的 G7 路由同一套 tag + duck-check —— 下游
// （如 @rabjs/react 的挂载快照）必须用它而非裸 instanceof，否则对
// 跨 realm 集合的检测与 instrumented 路由不一致。
export { isRewritableMap, isRewritableSet } from './internals/utils';

// 同理导出 WeakMap/WeakSet 的 tag 判定：collection-handler 对 Weak 集合的
// get/has 同样注册依赖，下游快照/对比逻辑需要与 instrumented 路由一致的判定
export { isWeakMapTarget, isWeakSetTarget } from './internals/handlers/collection-handler';

// Re-export handlers for testing
export { baseProxyHandler as proxyHandlers } from './internals/handlers/base-proxy-handler';
export { shadowProxyHandler } from './internals/handlers/shadow-proxy-handler';
