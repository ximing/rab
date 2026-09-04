/**
 * @rabjs/react - React 响应式状态库集成
 * 参考 mobx-react-lite 实现，支持 React 并发模式和严格模式
 */
import './batch';
// 核心 API
export { observer } from './observer';
export { view } from './view';

export { useObserver } from './use-observer';
export { useLocalObservable } from './use-local-observable';
export { useAsObservableSource } from './use-as-observable-source';
export { useReaction } from './use-reaction';
export type { UseReactionOptions, UseReactionPairOptions } from './use-reaction';

// 静态渲染支持（SSR）
export { enableStaticRendering, isUsingStaticRendering } from './static-rendering';

// 工具函数
export { observerFinalizationRegistry } from './utils/observer-finalization-registry';
export { debuggerReaction } from './utils/debug';
export { printDebugValue } from './utils/print-debug-value';

// ============================================================================
// 重新导出 @rabjs/observer 的所有 API
// ============================================================================

// Observable API - Create reactive objects
export { observable, shadowObservable } from '@rabjs/observer';

// Observer API - Create reactions that respond to observable changes
export { observe, unobserve, batch, notify } from '@rabjs/observer';
export type { ObserveOptions } from '@rabjs/observer';

// Untracked API - 同步窗口内的读取不注册依赖（@Memo 链等上层共用此边界）
export { untracked, isUntracked, getRunningReaction } from '@rabjs/observer';

// Configuration API - Configure global defaults
export { configure, resetGlobalConfig } from '@rabjs/observer';
export type { ConfigureOptions } from '@rabjs/observer';

// Re-export types for advanced usage
export type { Reaction, ReactionScheduler, Operation, OperationType } from '@rabjs/observer';

// Re-export utility functions
export { isObservable, raw } from '@rabjs/observer';

// Re-export handlers for testing
export { proxyHandlers, shadowProxyHandler } from '@rabjs/observer';

// ============================================================================
// 重新导出 @rabjs/service 的所有 API
// ============================================================================

// 核心 Service 类和类型
export { Service } from '@rabjs/service';
export type { MethodState, ExtractMethods } from '@rabjs/service';

// 装饰器
export {
  Action,
  SyncAction,
  Inject,
  getInjectMetadata,
  isInjected,
  Debounce,
  cancelDebounce,
  cleanupAllDebounces,
  Throttle,
  cancelThrottle,
  cleanupAllThrottles,
  Memo,
  invalidateMemo,
  cleanupAllMemos,
  On,
  Once,
  getEventListenerMetadata,
  isEventListener,
  setupEventListeners,
  cleanupEventListeners,
  cleanupAllEventListeners,
} from '@rabjs/service';
export type {
  InjectOptions,
  DebounceOptions,
  ThrottleOptions,
  MemoOptions,
  CleanupAllMemosOptions,
  OnOptions,
  OnceOptions,
} from '@rabjs/service';

// 事件系统
export { EventSystem } from '@rabjs/service';
export type { EventScope, EventSystemOptions } from '@rabjs/service';

// IOC 容器
export { Container, getGlobalContainer, register, resolve, has } from '@rabjs/service';
export type {
  ServiceIdentifier,
  ServiceClass,
  ServiceFactory,
  RegisterOptions,
  ContainerOptions,
  DestroyCallback,
} from '@rabjs/service';

// ============================================================================
// Domain 依赖注入系统（React 集成）
// ============================================================================
export {
  DomainContext,
  RSRoot,
  RSStrict,
  StrictContext,
  useService,
  useContainer,
  useObserverService,
  useContainerEvents,
  useViewService,
  bindServices,
} from './domain';

export type {
  // ServiceIdentifier 和 ServiceFactory 已从 @rabjs/service 导出
  ServiceDefinition,
  DomainContextValue,
} from './domain';
