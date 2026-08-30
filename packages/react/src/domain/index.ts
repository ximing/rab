/**
 * @domain - React 依赖注入系统
 *
 * 基于 React Provider 的依赖注入系统，支持：
 * - Provider 包装组件，为子组件提供服务容器
 * - useService Hook，按作用域链查找服务实例
 * - 生命周期绑定，服务实例与 Provider 生命周期一致
 * - 作用域隔离，同一作用域链下每个服务只能在一个地方注册
 *
 * @example
 * ```tsx
 * // 1. 定义组件内容
 * const MainPageContent = () => {
 *   const mainPageService = useService(MainPageService);
 *   return <MainPageDetail />;
 * };
 *
 * // 2. 使用 bindServices 注册服务（自动 view 包裹，创建领域容器）
 * const MainPage = bindServices(MainPageContent, [MainPageService]);
 *
 * // 3. 在应用中使用，RSRoot 提供根容器
 * <RSRoot>
 *   <MainPage />
 * </RSRoot>
 * ```
 */

// Context
export { DomainContext } from './domain-context';
export { RSRoot } from './root-context';
export { RSStrict, StrictContext } from './strict-context';

export { bindServices } from './bind';

// Hooks
export { useService, useContainer } from './use-service';
export { useObserverService, useViewService } from './use-observer-service';
export { useContainerEvents } from './use-container-events';

// 类型
export type {
  ServiceIdentifier,
  ServiceFactory,
  ServiceClass,
  ServiceDefinition,
  DomainContextValue,
} from './types';
