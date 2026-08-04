/**
 * identifier 展示字段生成工具
 *
 * 将 ServiceIdentifier（Constructor / string / symbol）转换为可读的展示字符串和类型标签
 */

import type { ServiceDescriptor } from '../types';

/**
 * 从 ServiceIdentifier 生成具备语义的展示标签
 * - Constructor → 类名字符串，如 "CartService"
 * - string    → 原样返回，如 "cartService"
 * - symbol    → "Symbol(description)" 或 "Symbol()"
 */
export function getIdentifierLabel(id: string | symbol | (new (...args: any[]) => any)): string {
  if (typeof id === 'function') return (id as Function).name || 'AnonymousService';
  if (typeof id === 'string') return id;
  return `Symbol(${(id as symbol).description ?? ''})`;
}

/**
 * 从 ServiceIdentifier 推断展示类型
 */
export function getIdentifierType(id: string | symbol | (new (...args: any[]) => any)): ServiceDescriptor['identifierType'] {
  if (typeof id === 'function') return 'constructor';
  if (typeof id === 'string') return 'string';
  return 'symbol';
}
