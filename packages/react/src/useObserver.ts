/**
 * useObserver Hook - 核心 Hook，用于在函数组件中追踪 observable 的变化
 * 参考 mobx-react-lite 实现，支持 React 并发模式和严格模式
 */
import { observe, unobserve, type Reaction, type Operation } from '@rabjs/observer';
import React from 'react';

// 优先使用 React 18+ 内置的 useSyncExternalStore，降级到 shim
let useSyncExternalStore: typeof React.useSyncExternalStore;
if ('useSyncExternalStore' in React) {
  useSyncExternalStore = (React as any).useSyncExternalStore;
} else {
  // React 16-17 使用 shim
  const shim = require('use-sync-external-store/shim');
  useSyncExternalStore = shim.useSyncExternalStore;
}

import { isUsingStaticRendering } from './staticRendering';
import { observerFinalizationRegistry } from './utils/observerFinalizationRegistry';
import { printDebugValue } from './utils/printDebugValue';

/**
 * Observer 管理对象
 * 不要在此对象上存储 admRef（即使作为闭包的一部分），
 * 否则会阻止 GC，进而阻止通过 FinalizationRegistry 进行 reaction 清理
 */
type ObserverAdministration = {
  reaction: Reaction | null; // 也作为 disposed 标志
  onStoreChange: Function | null; // 也作为 mounted 标志
  // stateVersion 在每次 reaction 触发时"tick"
  // tearing 仍然存在，因为没有跨组件同步，
  // 但我们可以使用 useSyncExternalStore API
  stateVersion: symbol;
  name: string;
  debugger?: (operation: Operation) => void; // 调试器回调
  // 这些不依赖于 state/props，因此可以保存在这里而不是 useCallback
  subscribe: Parameters<typeof useSyncExternalStore>[0];
  getSnapshot: Parameters<typeof useSyncExternalStore>[1];
};

/**
 * 创建 Reaction
 * reaction 是一个函数，当调用时会追踪 observable 的访问
 */
function createReaction(adm: ObserverAdministration) {
  adm.reaction = observe(
    (renderFn: () => any) => {
      // 执行 render 函数，在执行期间追踪 observable 访问
      return renderFn();
    },
    {
      // 使用 lazy 模式，不立即执行
      lazy: true,
      // 当 observable 数据变化时，通过 scheduler 通知
      scheduler: () => {
        // Reaction 触发时更新 stateVersion
        adm.stateVersion = Symbol();
        // onStoreChange 在组件"mount"之前不可用
        // 如果在初始渲染和 mount 之间状态发生变化，
        // useSyncExternalStore 应该通过检查状态版本并发出更新来处理
        adm.onStoreChange?.();
      },
      // 透传 debugger 参数
      debugger: adm.debugger,
    }
  );
}

/**
 * useObserver Hook 选项
 */
export interface UseObserverOptions {
  debugger?: (operation: Operation) => void;
}

/**
 * useObserver Hook
 * @param render - 渲染函数，返回 React 元素
 * @param baseComponentName - 组件名称，用于调试
 * @param options - 选项对象，包含 debugger 回调
 * @returns 渲染结果
 */
export function useObserver<T>(
  render: () => T,
  baseComponentName: string = 'observed',
  options?: UseObserverOptions
): T {
  const admRef = React.useRef<ObserverAdministration | null>(null);
  // 服务端渲染时直接执行渲染函数
  if (isUsingStaticRendering()) {
    return render();
  }

  if (!admRef.current) {
    // 首次渲染
    const adm: ObserverAdministration = {
      reaction: null,
      onStoreChange: null,
      stateVersion: Symbol(),
      name: baseComponentName,
      debugger: options?.debugger,
      subscribe(onStoreChange: () => void) {
        // 不要在这里访问 admRef！
        observerFinalizationRegistry.unregister(adm);
        adm.onStoreChange = onStoreChange;
        if (!adm.reaction) {
          // 我们失去了 reaction 以及所有订阅，发生在：
          // 1. 基于定时器的 finalization registry 在组件 mount 之前清理了 reaction
          // 2. React "重新挂载"同一组件而没有在中间调用 render（通常是 <StrictMode>）
          // 我们必须重新创建 reaction 并安排重新渲染以重新创建订阅，
          // 即使状态没有改变
          createReaction(adm);
          // onStoreChange 如果后续 getSnapshot 返回相同的值，不会强制更新
          // 所以我们确保情况不是这样
          adm.stateVersion = Symbol();
        }

        return () => {
          // 不要在这里访问 admRef！
          adm.onStoreChange = null;
          if (adm.reaction) {
            unobserve(adm.reaction);
            adm.reaction = null;
          }
        };
      },
      getSnapshot() {
        // 不要在这里访问 admRef！
        return adm.stateVersion;
      },
    };

    admRef.current = adm;
  }

  const adm = admRef.current!;

  if (!adm.reaction) {
    // 首次渲染或 reaction 在 subscribe 之前被 registry 清理
    createReaction(adm);
    // StrictMode/ConcurrentMode/Suspense 可能意味着我们的组件
    // 被渲染和放弃多次，所以我们需要追踪泄漏的 Reactions
    observerFinalizationRegistry.register(admRef, adm, adm);
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useDebugValue(adm.reaction, printDebugValue);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useSyncExternalStore(
    // 这两个必须是稳定的，否则会在每次渲染时重新订阅
    adm.subscribe,
    adm.getSnapshot,
    adm.getSnapshot
  );

  // 渲染原始组件，但让 reaction 追踪 observables，
  // 以便在依赖项更改时可以使渲染无效（见上文）
  let renderResult!: T;
  let exception: unknown;

  // 在 reaction 中执行 render 函数
  // reaction 会在执行时追踪 render 中访问的 observable 属性
  if (adm.reaction) {
    try {
      // 调用 reaction 时传入 render 函数
      // reaction 会执行 render，并在执行期间追踪 observable 访问
      renderResult = adm.reaction.call(null, render) as T;
    } catch (e) {
      exception = e;
    }
  }

  if (exception) {
    throw exception; // 重新抛出渲染期间捕获的任何异常
  }

  return renderResult;
}