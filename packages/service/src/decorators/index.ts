/**
 * Service 装饰器集合
 *
 * 包含以下装饰器：
 * - @Action: 标记需要批量更新的方法（默认所有方法都是 action）
 * - @SyncAction: 标记不使用批量更新的方法
 * - @Inject: 依赖注入装饰器，自动从容器解析依赖
 * - @Debounce: 防抖装饰器，延迟执行方法
 * - @Throttle: 节流装饰器，限制方法执行频率
 * - @Memo: 缓存装饰器，对 getter 进行缓存优化
 * - @On: 事件监听装饰器，绑定事件监听器
 * - @Once: 一次性事件监听装饰器，绑定一次性事件监听器
 */

export { Action } from './action';
export { SyncAction } from './syncAction';
export { Inject, getInjectMetadata, isInjected } from './inject';
export type { InjectOptions } from './inject';
export { Debounce, cancelDebounce, cleanupAllDebounces } from './debounce';
export type { DebounceOptions } from './debounce';
export { Throttle, cancelThrottle, cleanupAllThrottles } from './throttle';
export type { ThrottleOptions } from './throttle';
export { Memo, invalidateMemo, cleanupAllMemos } from './memo';
export type { MemoOptions } from './memo';
export {
  On,
  getEventListenerMetadata,
  isEventListener,
  setupEventListeners,
  cleanupEventListeners,
  cleanupAllEventListeners,
} from './on';
export type { OnOptions } from './on';
export { Once } from './once';
export type { OnceOptions } from './once';
