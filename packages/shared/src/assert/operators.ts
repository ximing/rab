/**
 * 断言操作符执行逻辑
 *
 * 所有断言在浏览器 JS 引擎内部执行，传出给 Agent 的只有标量结果（passed/actual 摘要）。
 * 通过 resolvePath 只提取路径末端的值参与计算，中间节点的大对象不传输、不序列化。
 */

import { resolvePath, toSafeActual } from './resolve-path';
import type { Assertion, AssertionResult, AssertOp, ElementAssertion, AssertResult } from './types';

/**
 * 判断一个 op 是否为"长度类"断言操作符
 */
function isLengthOp(op: AssertOp): boolean {
  return (
    op === 'length' ||
    op === 'lengthGt' ||
    op === 'lengthGte' ||
    op === 'lengthLt' ||
    op === 'lengthLte'
  );
}

/**
 * 格式化期望值用于错误信息
 */
function formatExpected(expected: unknown): string {
  if (expected === undefined) return 'undefined';
  if (expected === null) return 'null';
  if (typeof expected === 'string') return `"${expected}"`;
  return String(expected);
}

/**
 * 执行单条断言，返回结果
 *
 * 核心逻辑：
 * 1. 通过 resolvePath 从实例读取末端值（不序列化中间节点）
 * 2. 根据 op 执行比对
 * 3. actual 按安全摘要规则处理后传出
 *
 * @param instance Service 实例（断言的目标对象）
 * @param assertion 断言描述
 * @returns 断言结果
 */
export function executeAssertion(instance: object, assertion: Assertion): AssertionResult {
  const { path, op, expected, message } = assertion;

  // 读取末端值
  const rawValue = resolvePath(instance, path);

  let passed = false;
  let actual: unknown;
  let error: string | undefined;

  try {
    // 根据操作符分类处理
    switch (op) {
      // ─── 相等 ───────────────────────────────────────
      case 'eq': {
        passed = rawValue === expected;
        actual = toSafeActual(rawValue);
        break;
      }
      case 'neq': {
        passed = rawValue !== expected;
        actual = toSafeActual(rawValue);
        break;
      }

      // ─── 大小比较（数值）────────────────────────────
      case 'gt': {
        passed =
          typeof rawValue === 'number' && typeof expected === 'number' && rawValue > expected;
        actual = toSafeActual(rawValue);
        break;
      }
      case 'gte': {
        passed =
          typeof rawValue === 'number' && typeof expected === 'number' && rawValue >= expected;
        actual = toSafeActual(rawValue);
        break;
      }
      case 'lt': {
        passed =
          typeof rawValue === 'number' && typeof expected === 'number' && rawValue < expected;
        actual = toSafeActual(rawValue);
        break;
      }
      case 'lte': {
        passed =
          typeof rawValue === 'number' && typeof expected === 'number' && rawValue <= expected;
        actual = toSafeActual(rawValue);
        break;
      }

      // ─── 存在性 ─────────────────────────────────────
      case 'exists': {
        passed = rawValue !== null && rawValue !== undefined;
        // exists 操作符只返回 true/false，不暴露原始值
        actual = passed;
        break;
      }
      case 'notExists': {
        passed = rawValue === null || rawValue === undefined;
        // notExists 操作符只返回 true/false，不暴露原始值
        actual = passed;
        break;
      }

      // ─── 字符串 / 数组包含 ──────────────────────────
      case 'includes': {
        if (Array.isArray(rawValue)) {
          passed = rawValue.includes(expected);
        } else if (typeof rawValue === 'string' && typeof expected === 'string') {
          passed = rawValue.includes(expected);
        } else {
          passed = false;
        }
        actual = toSafeActual(rawValue);
        break;
      }
      case 'notIncludes': {
        if (Array.isArray(rawValue)) {
          passed = !rawValue.includes(expected);
        } else if (typeof rawValue === 'string' && typeof expected === 'string') {
          passed = !rawValue.includes(expected);
        } else {
          passed = false;
        }
        actual = toSafeActual(rawValue);
        break;
      }

      // ─── 正则匹配 ────────────────────────────────────
      case 'matches': {
        if (typeof expected === 'string' && typeof rawValue === 'string') {
          const regex = new RegExp(expected);
          passed = regex.test(rawValue);
        } else {
          passed = false;
        }
        actual = toSafeActual(rawValue);
        break;
      }

      // ─── 类型检查 ────────────────────────────────────
      case 'type': {
        passed = typeof rawValue === expected;
        actual = typeof rawValue;
        break;
      }

      // ─── 长度断言（数组 / 字符串） ────────────────────
      case 'length': {
        const len = getLength(rawValue);
        passed = len !== undefined && typeof expected === 'number' && len === expected;
        // length 类操作符返回数字 length，而非摘要字符串
        actual = len;
        break;
      }
      case 'lengthGt': {
        const len = getLength(rawValue);
        passed = len !== undefined && typeof expected === 'number' && len > expected;
        actual = len;
        break;
      }
      case 'lengthGte': {
        const len = getLength(rawValue);
        passed = len !== undefined && typeof expected === 'number' && len >= expected;
        actual = len;
        break;
      }
      case 'lengthLt': {
        const len = getLength(rawValue);
        passed = len !== undefined && typeof expected === 'number' && len < expected;
        actual = len;
        break;
      }
      case 'lengthLte': {
        const len = getLength(rawValue);
        passed = len !== undefined && typeof expected === 'number' && len <= expected;
        actual = len;
        break;
      }

      // ─── 深比对（仅用于已知小对象） ──────────────────
      case 'deepEq': {
        // deepEq 直接返回实际对象，调用方需自行承担序列化风险
        passed = JSON.stringify(rawValue) === JSON.stringify(expected);
        actual = rawValue; // 例外：直接返回原始值
        break;
      }

      // ─── 数值区间（闭区间）────────────────────────────
      case 'between': {
        const [lo, hi] = expected as [number, number];
        passed = typeof rawValue === 'number' && rawValue >= lo && rawValue <= hi;
        actual = toSafeActual(rawValue);
        break;
      }

      // ─── 对象 key 检查 ─────────────────────────────────
      case 'hasKeys': {
        // 支持单个 string 或 string[]
        const keys = Array.isArray(expected) ? (expected as string[]) : [expected as string];
        passed =
          rawValue !== null &&
          typeof rawValue === 'object' &&
          keys.every(k => typeof k === 'string' && k in (rawValue as object));
        actual = '[Object]';
        break;
      }

      // ─── 对象结构浅层匹配 ──────────────────────────────
      case 'matchObject': {
        const subset = expected as Record<string, unknown>;
        passed =
          rawValue !== null &&
          typeof rawValue === 'object' &&
          isSubset(subset, rawValue as Record<string, unknown>);
        actual = '[Object]';
        break;
      }

      // ─── 数组元素断言 ───────────────────────────────────
      case 'some': {
        const subAssertion = expected as ElementAssertion;
        passed =
          Array.isArray(rawValue) &&
          rawValue.some(item => executeScalarAssertion(item as object, subAssertion).passed);
        actual = `[Array(${Array.isArray(rawValue) ? rawValue.length : 0})]`;
        break;
      }
      case 'every': {
        const subAssertion = expected as ElementAssertion;
        passed =
          Array.isArray(rawValue) &&
          rawValue.length > 0 &&
          rawValue.every(item => executeScalarAssertion(item as object, subAssertion).passed);
        actual = `[Array(${Array.isArray(rawValue) ? rawValue.length : 0})]`;
        break;
      }

      default: {
        // 不可达分支，TypeScript 编译期已穷举
        const _exhaustive: never = op;
        passed = false;
        actual = undefined;
        error = `Unknown op: ${String(_exhaustive)}`;
      }
    }
  } catch (error_: unknown) {
    passed = false;
    actual = undefined;
    error = error_ instanceof Error ? error_.message : String(error_);
  }

  // 长度类操作符不需要再次覆盖 actual（已在 switch 内设置）
  const isFailed = !passed;
  if (isFailed && !error) {
    // 构建失败描述：Expected [path] to [op] [expected], but got [actual]
    if (op === 'exists' || op === 'notExists') {
      error = `Expected ${path} to ${op}`;
    } else if (isLengthOp(op)) {
      error = `Expected ${path} to ${op} ${formatExpected(expected)}, but length is ${String(actual)}`;
    } else {
      error = `Expected ${path} to ${op} ${formatExpected(expected)}, but got ${formatExpected(actual)}`;
    }
  }

  const result: AssertionResult = {
    path,
    op,
    expected,
    actual,
    passed,
  };

  if (message) {
    result.message = message;
  }

  if (error && !passed) {
    result.error = error;
  }

  return result;
}

/**
 * 安全获取值的 length 属性（Array 或 string）
 * @returns length 数字，或 undefined（不支持时）
 */
function getLength(value: unknown): number | undefined {
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.length;
  if (
    value !== null &&
    typeof value === 'object' &&
    'length' in value &&
    typeof (value as { length: unknown }).length === 'number'
  ) {
    return (value as { length: number }).length;
  }
  return undefined;
}

/**
 * 浅层子集检查：subset 的所有键值对是否都存在于 target 中（值用 === 比较）
 * 仅用于 matchObject 内部；不递归，防止大对象 OOM
 */
function isSubset(subset: Record<string, unknown>, target: Record<string, unknown>): boolean {
  return Object.entries(subset).every(([k, v]) => target[k] === v);
}

/**
 * 针对 every/some 的标量子断言执行（限制为 ScalarAssertOp，防止 every/some 嵌套）
 */
function executeScalarAssertion(item: object, assertion: ElementAssertion): { passed: boolean } {
  const SCALAR_OPS = new Set<string>([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'exists',
    'notExists',
    'includes',
    'notIncludes',
    'matches',
    'type',
  ]);
  if (!SCALAR_OPS.has(assertion.op)) {
    return { passed: false };
  }
  return executeAssertion(item, {
    path: assertion.path,
    op: assertion.op as AssertOp,
    expected: assertion.expected,
  });
}

/**
 * 批量执行断言列表，返回聚合结果
 *
 * @param instance Service 实例
 * @param assertions 断言列表
 * @returns 断言汇总结果
 */
export function executeAssertions(instance: object, assertions: Assertion[]): AssertResult {
  const results = assertions.map(assertion => executeAssertion(instance, assertion));
  const passedCount = results.filter(r => r.passed).length;

  return {
    passed: passedCount === results.length,
    summary: {
      passed: passedCount,
      total: results.length,
    },
    results,
  };
}
