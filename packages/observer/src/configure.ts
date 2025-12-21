import type { ReactionScheduler } from './internals/types';

/**
 * 全局配置选项
 */
export interface ConfigureOptions {
  /**
   * 全局默认的 Scheduler
   * 当 observe 没有指定 scheduler 时,将使用此全局默认值
   */
  scheduler?: ReactionScheduler | Function;
}

/**
 * 全局配置存储
 */
const globalConfig: Required<ConfigureOptions> = {
  scheduler: undefined as any,
};

/**
 * 配置全局默认的 Scheduler
 *
 * @param options - 配置选项
 *
 * @example
 * ```typescript
 * // 配置全局默认的异步 scheduler
 * configure({
 *   scheduler: (reaction) => {
 *     setTimeout(reaction, 0);
 *   }
 * });
 *
 * // 配置全局默认的批量 scheduler
 * const batchScheduler = new Set();
 * configure({
 *   scheduler: batchScheduler
 * });
 * ```
 */
export function configure(options: ConfigureOptions): void {
  if (options.scheduler !== undefined) {
    globalConfig.scheduler = options.scheduler;
  }
}

/**
 * 获取全局配置
 * @internal
 */
export function getGlobalConfig(): Required<ConfigureOptions> {
  return globalConfig;
}

/**
 * 重置全局配置为默认值
 * @internal
 */
export function resetGlobalConfig(): void {
  globalConfig.scheduler = undefined as any;
}
