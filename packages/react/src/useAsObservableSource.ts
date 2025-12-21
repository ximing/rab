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
    observableRef.current = observable(current);
  }

  // 更新 observable 对象的属性
  Object.keys(current).forEach(key => {
    (observableRef.current as any)[key] = (current as any)[key];
  });

  return observableRef.current;
}
