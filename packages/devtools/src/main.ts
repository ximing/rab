/**
 * @rabjs/devtools
 *
 * RSJS 调试工具 - 将 global 容器访问 API 挂载到 window.__RS_ROOT_CONTAINER__
 * 供调试工具、浏览器插件、E2E 测试框架等在框架组件树之外访问 Service 实例。
 *
 * 框架无关，可在 React、Vue、原生 JS 等任意前端项目中使用。
 *
 * @example
 * // 在应用入口文件（如 main.ts / index.ts）中调用一次
 * import { setupWindowRootContainer } from '@rabjs/devtools';
 * setupWindowRootContainer();
 *
 * // 之后在浏览器控制台或 E2E 测试中使用
 * window.__RS_ROOT_CONTAINER__.listServices()
 * window.__RS_ROOT_CONTAINER__.getService('CartService_abc123')
 * window.__RS_ROOT_CONTAINER__.getContainer('ProductPage_2')
 *
 * // 链式断言（新功能）
 * window.__RS_ROOT_CONTAINER__
 *   .expect('CartService_abc123')
 *   .toBe('items.length', 0)
 *   .toExist('userId')
 *   .check()
 */

// ─── 容器访问接口 ──────────────────────────────────────────────────────────────

// 接口类型（供外部消费者使用）
export type { RSRootContainerHandle } from './root-container-handle';

// 工厂函数（供高级用户手动创建 handle）
export { createRSRootContainerHandle } from './root-container-handle';

// 挂载函数（最常用入口：模块初始化时调用一次）
export { setupWindowRootContainer } from './root-container-handle';

// ─── 断言能力 ──────────────────────────────────────────────────────────────────

// 断言类型（供 TypeScript 类型检查使用）
export type {
  AssertOp,
  Assertion,
  AssertionResult,
  AssertResult,
  ElementAssertion,
} from '@rabjs/shared';

// RSAssertionError（class，需要 value export）
export { RSAssertionError } from '@rabjs/shared';

// RSExpectBuilder（链式断言构建器）
export type { CDPAssertResult } from './assert/expect';
export { RSExpectBuilder } from './assert/expect';

// 控制台报告
export { printAssertResult } from './assert/reporter';
export type { ReportOptions } from './assert/reporter';

/**
 * rsExpect - 独立使用入口（不依赖 window 挂载）
 *
 * 适合 E2E 测试框架、Node.js 测试环境中的手动集成
 *
 * @example
 * import { rsExpect } from '@rabjs/devtools';
 * rsExpect(cartService)
 *   .toBe('items.length', 0)
 *   .expect(); // 失败时抛 RSAssertionError
 */
export { rsExpect } from './assert/expect';
