/**
 * Domain Context - 用于在 React 组件树中传递容器
 *
 * 支持嵌套 Provider，每个 Provider 都有自己的容器实例
 * useService 会按照 Provider 作用域链向上查找服务
 */

import { getGlobalContainer } from '@rabjs/service';
import { createContext, useContext, useRef } from 'react';

import { StrictContext } from './strictContext';
import type { DomainContextValue } from './types';

/**
 * Domain Context
 *
 * 存储当前作用域的容器信息
 * 支持多层嵌套，每层都有自己的容器
 */
export const DomainContext = createContext<DomainContextValue | null>(null);

DomainContext.displayName = 'RSDomainContext';

export function useDomainContext(): DomainContextValue {
  // 找到最近的
  const context = useContext(DomainContext);
  const contextRef = useRef(context);
  const strictContext = useContext(StrictContext);

  if (!context) {
    if (strictContext) {
      throw new Error(`useService must be called within a bindServices`);
    } else {
      console.info('[WARN] 兼容模式，使用全局GlobalContainer');
      contextRef.current = { container: getGlobalContainer() };
    }
  }
  return contextRef.current!;
}
