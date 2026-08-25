/**
 * useLocalObservable Hook - 在组件内创建本地 observable 状态
 * 参考 mobx-react-lite 实现
 */
import { observable } from '@rabjs/observer';
import { useState } from 'react';

/**
 * 创建一个本地 observable 对象，该对象在组件的整个生命周期中保持不变
 * @param initializer - 返回初始状态的函数
 * @returns observable 状态对象
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const state = useLocalObservable(() => ({
 *     count: 0,
 *     increment() {
 *       this.count++;
 *     }
 *   }));
 *
 *   return (
 *     <div>
 *       <p>Count: {state.count}</p>
 *       <button onClick={() => state.increment()}>+1</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLocalObservable<T extends Record<string, any>>(initializer: () => T): T {
  return useState(() => observable(initializer()))[0];
}
