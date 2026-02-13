/**
 * useObserverService Hook - 在 React 组件中获取服务实例并自动追踪响应式更新
 *
 * 结合 useService 和 useObserver 的功能，让组件在不使用 @observer HOC 的情况下
 * 也能实现响应式更新。当服务中的 observable 数据变化时，组件会自动重新渲染。
 *
 * @example
 * ```tsx
 * // 定义服务
 * class DemoService {
 *   @observable state = { count: 0 };
 *
 *   @Action
 *   increment() {
 *     this.state.count++;
 *   }
 * }
 *
 * // 在组件中使用
 * const MyComponent = () => {
 *   const [state, demoService] = useObserverService(DemoService, (demo) => demo.state);
 *
 *   return (
 *     <div>
 *       <p>Count: {state.count}</p>
 *       <button onClick={() => demoService.increment()}>Increment</button>
 *     </div>
 *   );
 * };
 * ```
 */

import type { Service } from '@rabjs/service';

import { useObserver } from '../useObserver';

import type { ServiceIdentifier } from './types';
import { useService, type UseServiceOptions } from './useService';

/**
 * useObserverService Hook (重载1: 传入类构造函数，自动推导类型，不指定 scope)
 *
 * @param identifier Service 类构造函数
 * @param selector 选择器函数
 * @returns 元组 [selectedState, service]
 * @throws 如果没有找到服务或不在 Provider 内部
 */
export function useObserverService<T extends Service, S = any>(
  identifier: new (...args: any[]) => T,
  selector: (service: T) => S
): [S, T];

/**
 * useObserverService Hook (重载2: 传入字符串或 Symbol，需要显式指定泛型，不指定 scope)
 *
 * @param identifier 服务标识符（字符串或 Symbol）
 * @param selector 选择器函数
 * @returns 元组 [selectedState, service]
 * @throws 如果没有找到服务或不在 Provider 内部
 */
export function useObserverService<T extends Service = Service, S = any>(
  identifier: string | symbol,
  selector: (service: T) => S
): [S, T];

/**
 * useObserverService Hook (重载3: 传入类构造函数和选项)
 *
 * @param identifier Service 类构造函数
 * @param selector 选择器函数
 * @param options 选项配置
 * @returns 元组 [selectedState, service]
 * @throws 如果没有找到服务或不在 Provider 内部
 */
export function useObserverService<T extends Service, S = any>(
  identifier: new (...args: any[]) => T,
  selector: (service: T) => S,
  options?: UseServiceOptions
): [S, T];

/**
 * useObserverService Hook (重载4: 传入字符串或 Symbol、选项，需要显式指定泛型)
 *
 * @param identifier 服务标识符（字符串或 Symbol）
 * @param selector 选择器函数
 * @param options 选项配置
 * @returns 元组 [selectedState, service]
 * @throws 如果没有找到服务或不在 Provider 内部
 */
export function useObserverService<T extends Service = Service, S = any>(
  identifier: string | symbol,
  selector: (service: T) => S,
  options?: UseServiceOptions
): [S, T];

/**
 * useObserverService Hook (实现)
 *
 * 在当前 Provider 作用域链中查找服务实例，并自动追踪其 observable 属性的变化。
 * 当被追踪的属性发生变化时，组件会自动重新渲染。
 *
 * @param identifier 服务标识符（类、字符串或 Symbol）
 * @param selector 选择器函数，用于选择要追踪的 observable 属性
 * @param options 选项配置（可选）
 * @returns 元组 [selectedState, service]，其中：
 *   - selectedState: 选择器函数返回的值（会被追踪）
 *   - service: 完整的服务实例
 * @throws 如果没有找到服务或不在 Provider 内部
 *
 * @example
 * ```tsx
 * // 基础用法
 * const [state, service] = useObserverService(MyService, (svc) => svc.state);
 *
 * // 选择特定属性
 * const [count, service] = useObserverService(MyService, (svc) => svc.state.count);
 *
 * // 选择多个属性
 * const [{ count, name }, service] = useObserverService(
 *   MyService,
 *   (svc) => ({ count: svc.state.count, name: svc.state.name })
 * );
 *
 * // 指定 Transient scope
 * const [state, service] = useObserverService(
 *   MyService,
 *   (svc) => svc.state,
 *   { scope: ServiceScope.Transient }
 * );
 * ```
 */
export function useObserverService<T extends Service = Service, S = any>(
  identifier: ServiceIdentifier<T>,
  selector: (service: T) => S,
  options?: UseServiceOptions
): [S, T] {
  // 获取服务实例 - 始终调用 useService，传入 options 参数
  // useService 内部会根据 options 参数决定行为
  const service: T = useService(identifier as any, options) as T;

  // 使用 useObserver 追踪 selector 返回的值
  const selectedState = useObserver(
    () => selector(service),
    `useObserverService(${String(identifier)})`
  );

  return [selectedState, service];
}

/**
 * useViewService Hook - useObserverService 的别名
 *
 * 提供更简洁的命名，用于在组件中获取服务实例并自动追踪其 observable 属性的变化。
 *
 * @deprecated 使用 useObserverService 代替
 * @see useObserverService
 */
export const useViewService = useObserverService;
