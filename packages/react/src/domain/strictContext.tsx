/**
 * Domain Context - 用于在 React 组件树中传递容器
 *
 * 支持嵌套 Provider，每个 Provider 都有自己的容器实例
 * useService 会按照 Provider 作用域链向上查找服务
 */

import { ReactNode, createContext } from 'react';

/**
 * Strict Context
 *
 * 用于标记严格模式下的组件树
 * 在严格模式下，useService 必须在 bindServices 或 RSStrict 内调用
 * 否则会抛出错误
 */
export const StrictContext = createContext<{} | null>(null);

StrictContext.displayName = 'RSStrictContext';

/**
 * RSStrict - 严格模式 Provider
 *
 * 用于在 React 组件树中启用严格模式
 * 在严格模式下，useService 必须在 bindServices 或 RSStrict 内调用
 * 否则会抛出错误
 *
 * @example
 * ```tsx
 * <RSStrict>
 *   <App />
 * </RSStrict>
 * ```
 */
export function RSStrict({ children }: { children: ReactNode }) {
  return <StrictContext.Provider value={{}}>{children}</StrictContext.Provider>;
}
