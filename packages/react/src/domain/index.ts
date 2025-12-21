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
 * // 1. 定义 Domain 组件
 * const MainPage = () => {
 *   const mainPageService = useService(MainPageService);
 *   return <MainPageContent />;
 * };
 *
 * // 2. 创建 Domain
 * const { Provider } = createDomain(MainPage, [MainPageService]);
 *
 * // 3. 使用 Provider 包装组件
 * <Provider>
 *   <MainPage />
 * </Provider>
 *
 * // 或者使用简化 API
 * export default Provider(MainPage, [MainPageService]);
 * ```
 */

// Context
export { DomainContext } from './domainContext';
export { RSRoot } from './rootContext';
export { RSStrict, StrictContext } from './strictContext';

export { bindServices } from './bind';

// Hooks
export { useService, useContainer } from './useService';
export { useObserverService, useViewService } from './useObserverService';
export { useContainerEvents } from './useContainerEvents';

// 类型
export type {
  ServiceIdentifier,
  ServiceFactory,
  ServiceClass,
  ServiceDefinition,
  ProviderOptions,
  ProviderResult,
  DomainComponent,
  DomainContextValue,
} from './types';
