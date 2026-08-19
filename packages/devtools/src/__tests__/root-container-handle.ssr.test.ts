/**
 * @jest-environment node
 *
 * Node 26 + jsdom 上 `window` 不可配置，无法再用 delete global.window 模拟 SSR。
 * 这条用例在真实 Node 环境里验证无 window 时安全跳过。
 */

import { setupWindowRootContainer } from '../root-container-handle';

describe('SSR 安全（无 window 环境）', () => {
  it('window 不存在时，setupWindowRootContainer 不报错且不挂载', () => {
    expect(typeof window).toBe('undefined');
    expect(() => setupWindowRootContainer()).not.toThrow();
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
    expect(
      (globalThis as { __RS_ROOT_CONTAINER__?: unknown }).__RS_ROOT_CONTAINER__
    ).toBeUndefined();
  });
});
