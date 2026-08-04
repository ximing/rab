/**
 * 断言相关类型定义
 *
 * 从 rs-web-mcp 提取，供 rs-web-mcp 和 rs-cdp-debug 共同依赖。
 * 不包含 WebMCP 相关类型（WebMcpToolDefinition 等）。
 */

/**
 * 断言操作符
 */
export type AssertOp =
  // ─── 相等 ───────────────────────────────────────
  | 'eq'           // actual === expected
  | 'neq'          // actual !== expected
  // ─── 大小比较（数值）────────────────────────────
  | 'gt'           // actual > expected
  | 'gte'          // actual >= expected
  | 'lt'           // actual < expected
  | 'lte'          // actual <= expected
  // ─── 存在性 ─────────────────────────────────────
  | 'exists'       // actual != null && actual !== undefined
  | 'notExists'    // actual == null || actual === undefined
  // ─── 字符串 / 数组包含 ──────────────────────────
  | 'includes'     // Array.includes(expected) 或 string.includes(expected)
  | 'notIncludes'
  // ─── 正则匹配 ────────────────────────────────────
  | 'matches'      // new RegExp(expected).test(actual)
  // ─── 类型检查 ────────────────────────────────────
  | 'type'         // typeof actual === expected
  // ─── 长度断言（数组 / 字符串） ────────────────────
  | 'length'       // actual.length === expected
  | 'lengthGt'     // actual.length > expected
  | 'lengthGte'    // actual.length >= expected
  | 'lengthLt'     // actual.length < expected
  | 'lengthLte'    // actual.length <= expected
  // ─── 深比对（仅用于已知小对象） ──────────────────
  | 'deepEq'       // JSON.stringify(actual) === JSON.stringify(expected)
  // ─── 数值区间（闭区间） ───────────────────────────
  | 'between'      // expected[0] <= actual <= expected[1]
  // ─── 对象 key 检查 ────────────────────────────────
  | 'hasKeys'      // 对象包含所有指定 key（支持单个 string 或 string[]）
  // ─── 对象结构浅层匹配 ─────────────────────────────
  | 'matchObject'  // 对象包含 expected 的所有键值对（浅层 ===）
  // ─── 数组元素断言 ─────────────────────────────────
  | 'some'         // arr.some(item => subPath satisfies subOp)
  | 'every';       // arr.every(item => subPath satisfies subOp)

/**
 * 允许在 every/some 中使用的标量操作符（防止嵌套递归）
 */
export type ScalarAssertOp = Extract<AssertOp,
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'exists' | 'notExists'
  | 'includes' | 'notIncludes'
  | 'matches'
  | 'type'
>;

/**
 * every / some 操作符的期望值：针对数组元素子路径的标量断言描述
 */
export interface ElementAssertion {
  /** 相对于数组元素的子路径，如 "status"、"waybillCode" */
  path: string;
  /** 标量操作符（不允许 every/some 嵌套，防止无限递归） */
  op: ScalarAssertOp;
  /** 期望值 */
  expected?: unknown;
}

/**
 * 单条断言
 */
export interface Assertion {
  /**
   * 点分路径，支持数组下标（.数字 形式）：
   *   "isInitialized"
   *   "ladingMonitorData.list.length"
   *   "ladingMonitorData.list.0.status"
   *   "selectedTemperature.length"
   */
  path: string;

  /** 断言操作符 */
  op: AssertOp;

  /**
   * 期望值。
   * op 为 exists / notExists 时不需要传。
   * op 为 type 时传 typeof 字符串，如 "string"、"number"。
   * op 为 matches 时传正则字符串，如 "^route-"。
   */
  expected?: unknown;

  /** 可选：这条断言的说明，出现在失败报告里 */
  message?: string;
}

/**
 * 单条断言的结果
 */
export interface AssertionResult {
  path: string;
  op: AssertOp;
  expected: unknown;
  /**
   * 实际读取到的值的安全摘要。
   * - 基本类型（string/number/boolean/null/undefined）：直接返回原始值
   * - Array：返回 "[Array(N)]"（N 为长度）
   * - Object：返回 "[Object]"
   * - Function：返回 "[Function]"
   * - length 类操作符：返回 length 的数字值
   * - exists / notExists：返回 true/false（不暴露原始值）
   * 注意：deepEq 操作符例外，会直接返回实际对象
   */
  actual: unknown;
  passed: boolean;
  /** 可选：这条断言的说明（来自 Assertion.message） */
  message?: string;
  /** 断言失败时的原因描述 */
  error?: string;
}

/**
 * 批量断言结果（用于 rs-cdp-debug 的 AssertResult 以及 rs-web-mcp 的 AssertStateResult）
 */
export interface AssertResult {
  /** 整组断言是否全部通过 */
  passed: boolean;
  /** 通过数 / 总数 */
  summary: { passed: number; total: number };
  /** 每条断言的详细结果 */
  results: AssertionResult[];
}

/**
 * 断言失败时由 RSExpectBuilder.expect() 抛出的错误
 * 继承 Error，包含结构化断言结果
 */
export class RSAssertionError extends Error {
  constructor(
    public readonly result: AssertResult,
    message: string
  ) {
    super(message);
    this.name = 'RSAssertionError';
  }
}
