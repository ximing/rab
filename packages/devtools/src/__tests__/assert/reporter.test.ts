/**
 * reporter.ts 单元测试
 *
 * 覆盖：
 * - printAssertResult 在全部通过时输出 group
 * - printAssertResult 在有失败时输出 warn
 * - verbose=false 时全部通过不输出
 * - collapsed=true 时使用 groupCollapsed
 * - 降级模式（无 console.group）
 * - 不同 op 的 formatOpDesc 输出
 */

import { printAssertResult } from '../../assert/reporter';
import type { AssertResult } from '@rabjs/shared';

// ─── 测试工具 ────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<AssertResult & { instanceId?: string; description?: string }> = {}): AssertResult & { instanceId?: string; description?: string } {
  return {
    passed: true,
    summary: { passed: 1, total: 1 },
    results: [
      {
        path: 'status',
        op: 'eq',
        expected: 'active',
        actual: 'active',
        passed: true,
      },
    ],
    instanceId: 'TestService_abc',
    ...overrides,
  };
}

// ─── 基本输出测试 ─────────────────────────────────────────────────────────────

describe('printAssertResult - 基本行为', () => {
  let consoleSpy: {
    group: jest.SpyInstance;
    groupCollapsed: jest.SpyInstance;
    groupEnd: jest.SpyInstance;
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      group: jest.spyOn(console, 'group').mockImplementation(() => {}),
      groupCollapsed: jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
      groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('全部通过时调用 console.group 和 console.log', () => {
    const result = makeResult();
    printAssertResult(result);

    expect(consoleSpy.group).toHaveBeenCalledTimes(1);
    expect(consoleSpy.groupEnd).toHaveBeenCalledTimes(1);
    expect(consoleSpy.log).toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it('有失败时调用 console.warn 输出失败项', () => {
    const result = makeResult({
      passed: false,
      summary: { passed: 0, total: 1 },
      results: [
        {
          path: 'status',
          op: 'eq',
          expected: 'inactive',
          actual: 'active',
          passed: false,
          error: 'Expected status to eq "inactive", but got "active"',
        },
      ],
    });
    printAssertResult(result);

    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.group).toHaveBeenCalledTimes(1);
  });

  it('verbose=false 时全部通过不输出任何内容', () => {
    const result = makeResult({ passed: true });
    printAssertResult(result, { verbose: false });

    expect(consoleSpy.group).not.toHaveBeenCalled();
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it('verbose=false 且有失败时仍然输出', () => {
    const result = makeResult({
      passed: false,
      summary: { passed: 0, total: 1 },
      results: [{
        path: 'val',
        op: 'eq',
        expected: 1,
        actual: 2,
        passed: false,
        error: 'Expected val to eq 1, but got 2',
      }],
    });
    printAssertResult(result, { verbose: false });

    expect(consoleSpy.group).toHaveBeenCalledTimes(1);
  });

  it('collapsed=true 时使用 groupCollapsed', () => {
    const result = makeResult();
    printAssertResult(result, { collapsed: true });

    expect(consoleSpy.groupCollapsed).toHaveBeenCalledTimes(1);
    expect(consoleSpy.group).not.toHaveBeenCalled();
  });

  it('group 标题包含 instanceId 和 summary', () => {
    const result = makeResult({
      summary: { passed: 2, total: 3 },
      instanceId: 'CartService_xyz',
    });
    printAssertResult(result);

    const call = consoleSpy.group.mock.calls[0]?.[0] as string;
    expect(call).toContain('CartService_xyz');
    expect(call).toContain('[2/3]');
  });

  it('group 标题包含 description（有描述时）', () => {
    const result = makeResult({ description: '验证购物车状态' });
    printAssertResult(result);

    const call = consoleSpy.group.mock.calls[0]?.[0] as string;
    expect(call).toContain('验证购物车状态');
  });

  it('全部通过时标题包含 ✅', () => {
    const result = makeResult({ passed: true });
    printAssertResult(result);

    const call = consoleSpy.group.mock.calls[0]?.[0] as string;
    expect(call).toContain('✅');
  });

  it('有失败时标题包含 ❌', () => {
    const result = makeResult({
      passed: false,
      summary: { passed: 0, total: 1 },
      results: [{
        path: 'val',
        op: 'eq',
        expected: 1,
        actual: 2,
        passed: false,
      }],
    });
    printAssertResult(result);

    const call = consoleSpy.group.mock.calls[0]?.[0] as string;
    expect(call).toContain('❌');
  });

  it('message 字段存在时出现在失败输出中', () => {
    const result = makeResult({
      passed: false,
      summary: { passed: 0, total: 1 },
      results: [{
        path: 'count',
        op: 'gt',
        expected: 0,
        actual: 0,
        passed: false,
        message: '数量应大于 0',
      }],
    });
    printAssertResult(result);

    const warnCall = consoleSpy.warn.mock.calls[0]?.[0] as string;
    expect(warnCall).toContain('数量应大于 0');
  });
});

// ─── 降级模式（无 console.group）────────────────────────────────────────────

describe('printAssertResult - 降级模式', () => {
  let originalGroup: typeof console.group;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    originalGroup = console.group;
    // @ts-expect-error 模拟无 group 的环境
    console.group = undefined;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.group = originalGroup;
    jest.restoreAllMocks();
  });

  it('无 console.group 时降级为 console.log', () => {
    const result = makeResult();
    printAssertResult(result);

    expect(logSpy).toHaveBeenCalled();
    // 第一条 log 应该是标题行
    const firstCall = logSpy.mock.calls[0]?.[0] as string;
    expect(firstCall).toContain('TestService_abc');
  });
});

// ─── 不同操作符的 formatOpDesc 测试 ──────────────────────────────────────────

describe('printAssertResult - 不同 op 输出格式', () => {
  let groupSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    groupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
    jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const opCases: Array<{
    op: string;
    expected?: unknown;
    expectedText: string;
  }> = [
    { op: 'eq', expected: 'active', expectedText: '=== "active"' },
    { op: 'neq', expected: 'inactive', expectedText: '!== "inactive"' },
    { op: 'gt', expected: 5, expectedText: '> 5' },
    { op: 'gte', expected: 5, expectedText: '>= 5' },
    { op: 'lt', expected: 10, expectedText: '< 10' },
    { op: 'lte', expected: 10, expectedText: '<= 10' },
    { op: 'exists', expectedText: 'exists' },
    { op: 'notExists', expectedText: 'notExists' },
    { op: 'includes', expected: 'hello', expectedText: 'includes "hello"' },
    { op: 'notIncludes', expected: 'x', expectedText: 'notIncludes "x"' },
    { op: 'matches', expected: '^abc', expectedText: 'matches /^abc/' },
    { op: 'type', expected: 'string', expectedText: 'typeof === "string"' },
    { op: 'length', expected: 3, expectedText: 'length === 3' },
    { op: 'lengthGt', expected: 2, expectedText: 'length > 2' },
    { op: 'lengthGte', expected: 2, expectedText: 'length >= 2' },
    { op: 'lengthLt', expected: 5, expectedText: 'length < 5' },
    { op: 'lengthLte', expected: 5, expectedText: 'length <= 5' },
    { op: 'deepEq', expected: { a: 1 }, expectedText: 'deepEq' },
    { op: 'between', expected: [1, 10], expectedText: 'between [1, 10]' },
    { op: 'hasKeys', expected: 'offset', expectedText: 'hasKeys "offset"' },
    { op: 'matchObject', expected: { a: 1 }, expectedText: 'matchObject' },
    { op: 'some', expectedText: 'some(...)' },
    { op: 'every', expectedText: 'every(...)' },
  ];

  for (const { op, expected, expectedText } of opCases) {
    it(`op=${op} 时显示 "${expectedText}"`, () => {
      const result = makeResult({
        results: [{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          path: 'field', op: op as any, expected, actual: 'value', passed: true,
        }],
      });
      printAssertResult(result);

      // 找到所有 log 调用内容
      const allLogs = [
        ...logSpy.mock.calls.map(c => String(c[0])),
        ...warnSpy.mock.calls.map(c => String(c[0])),
        ...groupSpy.mock.calls.map(c => String(c[0])),
      ].join('\n');

      expect(allLogs).toContain(expectedText);
    });
  }
});
