/**
 * useReaction Hook - 在组件中创建和管理响应式反应
 * 自动处理 observe() 的创建、依赖追踪和清理
 *
 * 这是 useEffect + observe + unobserve 的语法糖，用于简化在组件中创建副作用的过程
 */

import { observe, unobserve, untracked, type Reaction, type ObserveOptions } from '@rabjs/observer';
import { useEffect, useRef } from 'react';

/**
 * useReaction Hook 选项（单函数形式）
 *
 * 注意：继承自 ObserveOptions 的 `lazy` 在本 hook 中被忽略（与 `immediate`
 * 语义冲突，`immediate` 优先），传入时会在开发模式发出警告 (#253)。
 */
export interface UseReactionOptions extends ObserveOptions {
  /**
   * 是否在组件挂载时立即执行一次副作用并收集依赖。
   * 默认 true：与文档基础示例、useEffect 心智对齐。
   * 注意：false 时挂载阶段仍会执行一次 effect 以收集依赖（副作用与依赖收集
   * 无法分离），可观察行为与 true 相同；若需要「挂载不跑、变化才跑」，
   * 请使用双函数形式 `useReaction(dataFn, effect)` (#200)。
   * @default true
   */
  immediate?: boolean;
}

/**
 * useReaction Hook 选项（双函数形式）
 */
export interface UseReactionPairOptions {
  /**
   * 挂载收集依赖后是否立即执行一次 effect。
   * 默认 false：挂载不跑，依赖变了才跑 —— 这正是双函数形式存在的意义。
   * @default false
   */
  fireImmediately?: boolean;
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
 *       <p>{state.count}</p>
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
export function useReaction(effect: () => void | (() => void), options?: UseReactionOptions): void;
/**
 * useReaction Hook（双函数形式，MobX reaction 风格）
 *
 * 拆分「依赖收集」和「副作用」：挂载时只跑 dataFn 收集依赖、不跑 effect；
 * 依赖变化后 effect(current, previous) 才执行。这是单函数形式
 * `immediate: false` 想要却做不到的语义 (#200)。
 *
 * @param data - 依赖收集函数：返回值作为 effect 的入参，其中读取的
 *   observable 属性构成依赖
 * @param effect - 副作用函数：依赖变化后执行，拿到 (current, previous)
 * @param options - 配置选项
 *
 * @example
 * ```tsx
 * // 挂载不跑，count 变了才跑
 * useReaction(
 *   () => state.count,
 *   (count, prevCount) => {
 *     analytics.track("count_changed", { count, prevCount });
 *   }
 * );
 *
 * // 挂载也跑一次
 * useReaction(
 *   () => state.count,
 *   (count) => {
 *     document.title = `Count: ${count}`;
 *   },
 *   { fireImmediately: true }
 * );
 * ```
 */
export function useReaction<T>(
  data: () => T,
  effect: (current: T, previous: T | undefined) => void,
  options?: UseReactionPairOptions
): void;
// 实现签名：宽松类型，对外以两个重载暴露
export function useReaction(
  fn: () => any,
  effectOrOptions?: any,
  maybeOptions?: UseReactionPairOptions
): void {
  const isPairForm = typeof effectOrOptions === 'function';
  const reactionRef = useRef<Reaction | null>(null);

  useEffect(() => {
    // 如果已经有 reaction，先清理掉
    if (reactionRef.current) {
      unobserve(reactionRef.current);
    }

    const reaction = isPairForm
      ? createPairReaction(fn, effectOrOptions, maybeOptions)
      : createSingleReaction(fn, effectOrOptions);

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

function createSingleReaction(
  effect: () => void | (() => void),
  options?: UseReactionOptions
): Reaction {
  const { immediate, lazy: _ignoredLazy, ...observeOptions } = options || {};
  // #253：lazy 与 immediate 语义冲突且一直被静默丢弃 —— 至少警告用户，
  // 不在本轮改动运行时语义（immediate 优先）。
  // 只在 lazy: true 时警告：显式传 lazy: false 的用户并未依赖 lazy 语义
  // （常见于展开共享 options 对象），误报会让 jest-fail-on-console 等严格
  // console 环境无端失败。
  if (process.env.NODE_ENV !== 'production' && _ignoredLazy) {
    console.warn(
      '[@rabjs/react] useReaction: `lazy` 选项会被忽略（与 `immediate` 语义冲突，`immediate` 优先）。' +
        '请改用 `immediate`，或使用双函数形式 useReaction(dataFn, effectFn)。'
    );
  }
  // 默认立即执行并收集依赖。undefined 必须当 true，否则文档基础示例永不追踪 (#195)
  const runOnMount = immediate !== false;

  const reaction = observe(effect, {
    ...observeOptions,
    lazy: !runOnMount,
  });

  // immediate: false 仍要跑一次以建立依赖，否则后续变更永远不触发
  if (!runOnMount) {
    reaction();
  }

  return reaction;
}

// #249：双函数形式的 effect 必须以 untracked 方式执行（MobX reaction 语义）——
// effect 里读取的 observable 不得注册为依赖，只有 data() 的读取构成依赖。
// 使用 @rabjs/observer 的一等 untracked() 原语（此前的「已 unobserve 的
// reaction 作屏蔽层」实现依赖未文档化的内部行为，已被核心原语取代）。

function createPairReaction<T>(
  data: () => T,
  effect: (current: T, previous: T | undefined) => void,
  options?: UseReactionPairOptions
): Reaction {
  const { fireImmediately = false } = options || {};

  let firstRun = true;
  let previous: T | undefined;

  const reaction = observe(
    () => {
      const current = data();
      if (firstRun) {
        // 挂载首跑：只收集依赖，默认不执行 effect
        firstRun = false;
        previous = current;
        if (fireImmediately) {
          // effect 必须 untracked：其读取不属于依赖集合 (#249)
          untracked(() => effect(current, undefined));
        }
        return current;
      }
      const prev = previous;
      previous = current;
      // effect 必须 untracked：其读取不属于依赖集合 (#249)
      untracked(() => effect(current, prev));
      return current;
    },
    { lazy: true }
  );

  // 手动首跑建立依赖；effect 是否执行由 fireImmediately 决定
  reaction();

  return reaction;
}
