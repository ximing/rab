/**
 * RSExpectBuilder - Fluent 链式断言建造者
 *
 * 通过 window.__RS_ROOT_CONTAINER__.expect('instanceId') 获取，
 * 或直接 import { rsExpect } from '@rabjs/devtools' 使用。
 *
 * @example
 * // 控制台快速验证
 * window.__RS_ROOT_CONTAINER__
 *   .expect('CartService_abc')
 *   .toBe('items.length', 3)
 *   .toExist('currentUser')
 *   .run()
 *
 * @example
 * // 独立使用（E2E 测试）
 * import { rsExpect } from '@rabjs/devtools';
 * rsExpect(cartService)
 *   .toBe('items.length', 0)
 *   .expect(); // 失败时抛 RSAssertionError
 */

import {
  executeAssertions,
  RSAssertionError,
} from '@rabjs/shared';
import type {
  AssertOp,
  Assertion,
  AssertResult,
  ElementAssertion,
} from '@rabjs/shared';

import { printAssertResult } from './reporter';

/**
 * 扩展 AssertResult，添加 instanceId 和 description 字段
 */
export interface CDPAssertResult extends AssertResult {
  /** 目标 Service 的 instanceId */
  instanceId: string;
  /** 可选：这组断言的描述 */
  description?: string;
}

/**
 * RSExpectBuilder - 链式断言建造者
 *
 * 设计要点：
 * 1. 懒执行：toBe() / toExist() 等方法只记录断言，不立即执行
 * 2. 链式返回 this：所有记录方法返回 this，支持链式调用
 * 3. 不可变性：每次 run() 都基于当前 assertions 快照执行，不清空
 */
export class RSExpectBuilder {
  private readonly assertions: Assertion[] = [];
  private desc?: string;

  constructor(
    private readonly instanceId: string,
    private readonly getInstance: (id: string) => object | undefined
  ) {}

  /**
   * 设置整组断言的描述（出现在报告中）
   */
  describe(description: string): this {
    this.desc = description;
    return this;
  }

  // ─── 相等 ─────────────────────────────────────────────────────────────────

  /** actual === expected */
  toBe(path: string, expected: unknown, message?: string): this {
    return this.assert(path, 'eq', expected, message);
  }

  /** actual !== expected */
  notToBe(path: string, expected: unknown, message?: string): this {
    return this.assert(path, 'neq', expected, message);
  }

  // ─── 大小比较 ──────────────────────────────────────────────────────────────

  /** actual > expected */
  toBeGreaterThan(path: string, expected: number, message?: string): this {
    return this.assert(path, 'gt', expected, message);
  }

  /** actual >= expected */
  toBeGreaterThanOrEqual(path: string, expected: number, message?: string): this {
    return this.assert(path, 'gte', expected, message);
  }

  /** actual < expected */
  toBeLessThan(path: string, expected: number, message?: string): this {
    return this.assert(path, 'lt', expected, message);
  }

  /** actual <= expected */
  toBeLessThanOrEqual(path: string, expected: number, message?: string): this {
    return this.assert(path, 'lte', expected, message);
  }

  /** lo <= actual <= hi（闭区间）*/
  toBeBetween(path: string, lo: number, hi: number, message?: string): this {
    return this.assert(path, 'between', [lo, hi], message);
  }

  // ─── 存在性 ───────────────────────────────────────────────────────────────

  /** actual != null && actual !== undefined */
  toExist(path: string, message?: string): this {
    return this.assert(path, 'exists', undefined, message);
  }

  /** actual == null || actual === undefined */
  toNotExist(path: string, message?: string): this {
    return this.assert(path, 'notExists', undefined, message);
  }

  // ─── 包含 ─────────────────────────────────────────────────────────────────

  /** arr.includes(expected) 或 str.includes(expected) */
  toInclude(path: string, expected: unknown, message?: string): this {
    return this.assert(path, 'includes', expected, message);
  }

  /** !arr.includes(expected) 或 !str.includes(expected) */
  toNotInclude(path: string, expected: unknown, message?: string): this {
    return this.assert(path, 'notIncludes', expected, message);
  }

  // ─── 正则 ─────────────────────────────────────────────────────────────────

  /** new RegExp(pattern).test(actual) */
  toMatch(path: string, pattern: string, message?: string): this {
    return this.assert(path, 'matches', pattern, message);
  }

  // ─── 类型 ─────────────────────────────────────────────────────────────────

  /** typeof actual === type */
  toBeType(path: string, type: string, message?: string): this {
    return this.assert(path, 'type', type, message);
  }

  // ─── 长度 ─────────────────────────────────────────────────────────────────

  /** actual.length === expected */
  toHaveLength(path: string, expected: number, message?: string): this {
    return this.assert(path, 'length', expected, message);
  }

  /** actual.length > expected */
  toHaveLengthGt(path: string, expected: number, message?: string): this {
    return this.assert(path, 'lengthGt', expected, message);
  }

  /** actual.length >= expected */
  toHaveLengthGte(path: string, expected: number, message?: string): this {
    return this.assert(path, 'lengthGte', expected, message);
  }

  /** actual.length < expected */
  toHaveLengthLt(path: string, expected: number, message?: string): this {
    return this.assert(path, 'lengthLt', expected, message);
  }

  /** actual.length <= expected */
  toHaveLengthLte(path: string, expected: number, message?: string): this {
    return this.assert(path, 'lengthLte', expected, message);
  }

  // ─── 对象 ─────────────────────────────────────────────────────────────────

  /** 对象包含所有指定 key */
  toHaveKeys(path: string, keys: string | string[], message?: string): this {
    return this.assert(path, 'hasKeys', keys, message);
  }

  /** 对象包含 subset 的所有键值对（浅层 ===）*/
  toMatchObject(path: string, subset: Record<string, unknown>, message?: string): this {
    return this.assert(path, 'matchObject', subset, message);
  }

  /** JSON.stringify(actual) === JSON.stringify(expected) */
  toDeepEqual(path: string, expected: unknown, message?: string): this {
    return this.assert(path, 'deepEq', expected, message);
  }

  // ─── 数组元素断言 ─────────────────────────────────────────────────────────

  /** arr.some(item => item[assertion.path] satisfies assertion.op) */
  toHaveSome(path: string, assertion: ElementAssertion, message?: string): this {
    return this.assert(path, 'some', assertion, message);
  }

  /** arr.every(item => item[assertion.path] satisfies assertion.op) */
  toHaveEvery(path: string, assertion: ElementAssertion, message?: string): this {
    return this.assert(path, 'every', assertion, message);
  }

  // ─── 底层 op 直接调用 ─────────────────────────────────────────────────────

  /**
   * 直接传 op 和 expected，适合高级用户或批量构建
   */
  assert(path: string, op: AssertOp, expected?: unknown, message?: string): this {
    const assertion: Assertion = { path, op, expected };
    if (message !== undefined) {
      assertion.message = message;
    }
    this.assertions.push(assertion);
    return this;
  }

  // ─── 执行 ─────────────────────────────────────────────────────────────────

  /**
   * 执行所有断言，返回结构化结果
   * 不抛错，结果通过 AssertResult.passed 判断
   */
  run(): CDPAssertResult {
    const instance = this.getInstance(this.instanceId);

    if (instance === undefined) {
      // instanceId 不存在：所有断言标记失败
      const failedResults = this.assertions.map(a => ({
        path: a.path,
        op: a.op,
        expected: a.expected,
        actual: undefined,
        passed: false,
        message: a.message,
        error: `Service not found: instanceId="${this.instanceId}"`,
      }));

      const result: CDPAssertResult = {
        passed: false,
        summary: { passed: 0, total: this.assertions.length },
        results: failedResults,
        instanceId: this.instanceId,
      };

      if (this.desc) result.description = this.desc;
      return result;
    }

    const baseResult = executeAssertions(instance, this.assertions);

    const result: CDPAssertResult = {
      ...baseResult,
      instanceId: this.instanceId,
    };

    if (this.desc) result.description = this.desc;

    return result;
  }

  /**
   * 执行所有断言，控制台输出彩色报告
   * 所有断言通过时返回 true，否则返回 false
   *
   * 等价于 run() + printAssertResult()，适合控制台快速调试
   */
  check(): boolean {
    const result = this.run();
    printAssertResult(result);
    return result.passed;
  }

  /**
   * 执行断言，失败时抛出 Error（类 Jest 语义）
   * 适合 E2E 测试脚本中使用（需要强断言）
   *
   * @throws {RSAssertionError} 任意断言失败时
   */
  expect(): void {
    const result = this.run();
    if (!result.passed) {
      const failedCount = result.summary.total - result.summary.passed;
      const message = `RSExpect: ${failedCount} of ${result.summary.total} assertions failed for "${result.instanceId}"`;
      throw new RSAssertionError(result, message);
    }
  }
}

/**
 * rsExpect - 独立使用入口
 *
 * 直接接受 Service 实例（而非 instanceId），适合脱离 window 挂载的场景：
 * E2E 测试框架、Node.js 测试环境中的手动集成。
 *
 * @param instance Service 实例（任意 object）
 * @param description 可选：这组断言的描述
 * @returns RSExpectBuilder 链式断言构建器
 *
 * @example
 * import { rsExpect } from '@rabjs/devtools';
 * rsExpect(cartService)
 *   .toBe('items.length', 0)
 *   .expect(); // 失败时抛 RSAssertionError
 */
export function rsExpect(instance: object, description?: string): RSExpectBuilder {
  const builder = new RSExpectBuilder('(direct)', (_id: string) => instance);
  if (description) {
    builder.describe(description);
  }
  return builder;
}
