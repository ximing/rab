/**
 * useContainerEvents - 获取容器的事件系统
 *
 * 用于在 React 组件中访问当前容器的事件发射器
 * 可以用来监听和发送容器级别的事件
 *
 * @example
 * ```tsx
 * import { useContainerEvents } from '@rabjs/react';
 *
 * function MyComponent() {
 *   const events = useContainerEvents();
 *
 *   useEffect(() => {
 *     // 监听事件
 *     const handler = (data: any) => {
 *       console.log('Data updated:', data);
 *     };
 *     events.on('data:update', handler);
 *
 *     // 清理监听器
 *     return () => {
 *       events.off('data:update', handler);
 *     };
 *   }, [events]);
 *
 *   const handleClick = () => {
 *     // 发送事件
 *     events.emit('button:clicked', { id: 1 });
 *   };
 *
 *   return <button onClick={handleClick}>Click me</button>;
 * }
 * ```
 */

import { useMemo } from 'react';

import { useDomainContext } from './domainContext';

// EventEmitter 类型从 Container 的 events 属性推导
type EventEmitter = ReturnType<typeof useDomainContext>['container']['events'];

/**
 * 获取当前容器的事件发射器
 *
 * @returns 容器的事件发射器实例
 *
 * @example
 * ```tsx
 * function UserList() {
 *   const events = useContainerEvents();
 *
 *   useEffect(() => {
 *     const onUserAdded = (user: User) => {
 *       console.log('User added:', user);
 *     };
 *
 *     events.on('user:added', onUserAdded);
 *     return () => events.off('user:added', onUserAdded);
 *   }, [events]);
 *
 *   const addUser = () => {
 *     events.emit('user:added', { id: 1, name: 'John' });
 *   };
 *
 *   return <button onClick={addUser}>Add User</button>;
 * }
 * ```
 */
export function useContainerEvents(): EventEmitter {
  const { container } = useDomainContext();
  return container.events;
}
