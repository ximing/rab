/**
 * useAsObservableSource Hook - 将 props 转换为 observable 对象
 * 参考 mobx-react-lite 实现
 */
import { observable } from '@rabjs/observer';
import { useRef } from 'react';

/**
 * 将 props 或其他值转换为 observable 对象
 * 每次渲染时更新 observable 对象的属性
 *
 * @param current - 当前的 props 或值
 * @returns observable 对象
 *
 * @example
 * ```tsx
 * function UserProfile({ userId, userName }) {
 *   const observableProps = useAsObservableSource({ userId, userName });
 *
 *   const state = useLocalObservable(() => ({
 *     get displayName() {
 *       return `User: ${observableProps.userName}`;
 *     }
 *   }));
 *
 *   return <div>{state.displayName}</div>;
 * }
 * ```
 */
export function useAsObservableSource<T extends object>(current: T): T {
  const observableRef = useRef<T | null>(null);

  if (!observableRef.current) {
    // 浅拷贝后再包裹：React dev 模式会 Object.freeze(props)，直接包裹
    // 会让后续 key 写回命中 frozen 目标，proxy set trap 返回 falsish
    // 抛 TypeError（#216）。拷贝也保证不改动调用方传入的原对象。
    observableRef.current = observable({ ...current });
  }

  // 更新 observable 对象的属性
  for (const key of Object.keys(current)) {
    (observableRef.current as any)[key] = (current as any)[key];
  }

  return observableRef.current;
}
