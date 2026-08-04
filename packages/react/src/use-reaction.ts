/**
 * useReaction Hook - 在组件中创建和管理响应式反应
 * 自动处理 observe() 的创建、依赖追踪和清理
 *
 * 这是 useEffect + observe + unobserve 的语法糖，用于简化在组件中创建副作用的过程
 */

import { observe, unobserve, type Reaction, type ObserveOptions } from "@rabjs/observer";
import { useEffect, useRef } from "react";

/**
 * useReaction Hook 选项
 */
export interface UseReactionOptions extends ObserveOptions {
  /**
   * 是否在组件挂载时立即执行一次副作用
   * @default false
   */
  immediate?: boolean;
}

/**
 * useReaction Hook
 * 在组件中创建一个响应式反应，当依赖的 observable 属性变化时自动执行副作用
 *
 * 这是对以下模式的简化：
 * ```typescript
 * useEffect(() => {
 *   const reaction = observe(() => {
 *     // 副作用逻辑
 *   });
 *   return () => unobserve(reaction);
 * }, []);
 * ```
 *
 * @param effect - 副作用函数，会在依赖的 observable 属性变化时执行
 * @param options - 配置选项
 *
 * @example
 * ```tsx
 * // 基础用法：监听 observable 属性变化
 * function MyComponent() {
 *   const state = useLocalObservable(() => ({ count: 0 }));
 *
 *   useReaction(() => {
 *     console.log("Count changed:", state.count);
 *     document.title = `Count: ${state.count}`;
 *   });
 *
 *   return (
 *     <div>
 *       <p>Count: {state.count}</p>
 *       <button onClick={() => state.count++}>Increment</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // 使用 observer HOC 和服务
 * const MyComponent = observer(() => {
 *   const service = useService(MyService);
 *
 *   useReaction(() => {
 *     // 监听服务中的 observable 属性
 *     console.log("Service data changed:", service.data);
 *     // 可以执行任何副作用
 *     localStorage.setItem("data", JSON.stringify(service.data));
 *   });
 *
 *   return <div>{service.data}</div>;
 * });
 * ```
 *
 * @example
 * ```tsx
 * // 带调度器的用法
 * useReaction(
 *   () => {
 *     console.log("User name changed:", state.user.name);
 *     // 发送分析事件
 *     analytics.track("user_name_changed", { name: state.user.name });
 *   },
 *   {
 *     // 使用自定义调度器
 *     scheduler: (callback) => {
 *       // 使用 requestAnimationFrame 来批量更新
 *       requestAnimationFrame(callback);
 *     }
 *   }
 * );
 * ```
 *
 * @example
 * ```tsx
 * // 立即执行一次，然后监听变化
 * useReaction(
 *   () => {
 *     console.log("Initial and on change:", state.count);
 *   },
 *   { immediate: true }
 * );
 * ```
 */
export function useReaction(
  effect: () => void | (() => void),
  options?: UseReactionOptions
): void {
  const reactionRef = useRef<Reaction | null>(null);
  const { immediate, ...observeOptions } = options || {};

  useEffect(() => {
    // 如果已经有 reaction，先清理掉
    if (reactionRef.current) {
      unobserve(reactionRef.current);
    }

    // 创建新的 reaction
    // immediate 选项会被转换为 lazy 选项
    // - immediate: true => lazy: false (立即执行)
    // - immediate: false 或 undefined => lazy: true (延迟执行)
    const shouldLazy = immediate !== true;

    const reaction = observe(effect, {
      ...observeOptions,
      lazy: shouldLazy,
    });

    reactionRef.current = reaction;

    // 组件卸载时清理 reaction
    return () => {
      if (reactionRef.current) {
        unobserve(reactionRef.current);
        reactionRef.current = null;
      }
    };
  }, []); // 空依赖数组：仅在组件挂载时创建一次，卸载时清理
}
