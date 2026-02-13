/**
 * Domain Context - 用于在 React 组件树中传递容器
 *
 * 支持嵌套 Provider，每个 Provider 都有自己的容器实例
 * useService 会按照 Provider 作用域链向上查找服务
 */

import { ReactNode } from 'react';

import { bindServices } from './bind';

function RSRootInner({ children }: { children: ReactNode }) {
  return children;
}

export const RSRoot = bindServices(RSRootInner, []);
