/**
 * @rabjs/shared
 *
 * RSJS 跨包共享工具库 - 断言内核、路径解析等公共工具
 *
 * 纯工具包，无运行时副作用，零依赖（不依赖 rs-service / rs-observer）。
 * 可在任意环境（浏览器、Node.js、Web Worker）安全引入。
 *
 * 当前导出：
 * - 断言类型：AssertOp、Assertion、AssertionResult、AssertResult、ElementAssertion、ScalarAssertOp
 * - 路径解析：resolvePath、toSafeActual
 * - 断言执行：executeAssertion、executeAssertions
 * - 错误类型：RSAssertionError
 */

// ─── 类型 ─────────────────────────────────────────────────────────────────────
export type {
  AssertOp,
  ScalarAssertOp,
  ElementAssertion,
  Assertion,
  AssertionResult,
  AssertResult,
} from './assert/types';

// RSAssertionError 是 class，需要 value export
export { RSAssertionError } from './assert/types';

// ─── 路径解析 ─────────────────────────────────────────────────────────────────
export { resolvePath, toSafeActual } from './assert/resolve-path';

// ─── 断言执行 ─────────────────────────────────────────────────────────────────
export { executeAssertion, executeAssertions } from './assert/operators';
