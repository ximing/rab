/**
 * 用于 React DevTools 调试的工具函数
 * 打印 Reaction 的调试信息
 */
import type { Reaction } from '@rabjs/observer';

export function printDebugValue(reaction: Reaction | null): string {
  if (!reaction) {
    return 'disposed';
  }
  return `Reaction@${reaction.toString().slice(9, -1)}`;
}
