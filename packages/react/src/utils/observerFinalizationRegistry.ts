/**
 * 使用 FinalizationRegistry 管理 Reaction 的生命周期
 * 当组件卸载时自动清理 Reaction，防止内存泄漏
 */
import type { Reaction } from '@rabjs/observer';
import { unobserve } from '@rabjs/observer';

import { UniversalFinalizationRegistry } from './UniversalFinalizationRegistry';

/**
 * 创建 FinalizationRegistry 用于自动清理已卸载组件的 Reaction
 * 这样可以防止 Reaction 在组件卸载后继续订阅状态变化
 */
export const observerFinalizationRegistry = new UniversalFinalizationRegistry(
  (adm: { reaction: Reaction | null }) => {
    // 当 admRef 被垃圾回收时，清理 reaction
    if (adm.reaction) {
      unobserve(adm.reaction);
      adm.reaction = null;
    }
  }
);
