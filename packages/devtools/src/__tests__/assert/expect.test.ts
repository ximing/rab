/**
 * RSExpectBuilder 单元测试
 *
 * 覆盖：
 * - 各方法是否正确记录断言
 * - run() 返回正确 AssertResult
 * - check() 调用 printAssertResult 并返回 boolean
 * - expect() 在失败时抛 RSAssertionError，通过时不抛
 * - rsExpect(instance) 直接实例模式
 * - 链式多个断言的聚合结果
 * - instanceId 不存在时所有断言标记失败
 */

import { RSExpectBuilder, rsExpect } from '../../assert/expect';
import type { CDPAssertResult } from '../../assert/expect';
import { printAssertResult } from '../../assert/reporter';
import { RSAssertionError } from '@rabjs/shared';

// Mock reporter（避免在 jest 中污染控制台输出）
jest.mock('../../assert/reporter', () => ({
  printAssertResult: jest.fn(),
}));

const mockPrintAssertResult = printAssertResult as jest.MockedFunction<typeof printAssertResult>;

// ─── 测试工具 ────────────────────────────────────────────────────────────────

/**
 * 创建一个 RSExpectBuilder，使用固定的 instance 字典
 */
function makeBuilder(instances: Record<string, object>, instanceId: string): RSExpectBuilder {
  return new RSExpectBuilder(instanceId, (id: string) => instances[id]);
}

// ─── 基本链式 API 测试 ────────────────────────────────────────────────────────

describe('RSExpectBuilder - 断言记录', () => {
  const inst = { status: 'active', count: 5, name: 'test', items: [1, 2, 3] };

  function builder() {
    return makeBuilder({ svc: inst }, 'svc');
  }

  it('toBe 记录 eq 断言', () => {
    const result = builder().toBe('status', 'active').run();
    expect(result.results[0]?.op).toBe('eq');
    expect(result.results[0]?.path).toBe('status');
    expect(result.results[0]?.expected).toBe('active');
  });

  it('notToBe 记录 neq 断言', () => {
    const result = builder().notToBe('status', 'inactive').run();
    expect(result.results[0]?.op).toBe('neq');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toBeGreaterThan 记录 gt 断言', () => {
    const result = builder().toBeGreaterThan('count', 3).run();
    expect(result.results[0]?.op).toBe('gt');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toBeGreaterThanOrEqual 记录 gte 断言', () => {
    const result = builder().toBeGreaterThanOrEqual('count', 5).run();
    expect(result.results[0]?.op).toBe('gte');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toBeLessThan 记录 lt 断言', () => {
    const result = builder().toBeLessThan('count', 10).run();
    expect(result.results[0]?.op).toBe('lt');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toBeLessThanOrEqual 记录 lte 断言', () => {
    const result = builder().toBeLessThanOrEqual('count', 5).run();
    expect(result.results[0]?.op).toBe('lte');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toBeBetween 记录 between 断言', () => {
    const result = builder().toBeBetween('count', 1, 10).run();
    expect(result.results[0]?.op).toBe('between');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toExist 记录 exists 断言', () => {
    const result = builder().toExist('status').run();
    expect(result.results[0]?.op).toBe('exists');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toNotExist 记录 notExists 断言（路径不存在时通过）', () => {
    const result = builder().toNotExist('nonExistent').run();
    expect(result.results[0]?.op).toBe('notExists');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toInclude 记录 includes 断言', () => {
    const result = builder().toInclude('items', 2).run();
    expect(result.results[0]?.op).toBe('includes');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toNotInclude 记录 notIncludes 断言', () => {
    const result = builder().toNotInclude('items', 99).run();
    expect(result.results[0]?.op).toBe('notIncludes');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toMatch 记录 matches 断言', () => {
    const result = builder().toMatch('status', '^act').run();
    expect(result.results[0]?.op).toBe('matches');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toBeType 记录 type 断言', () => {
    const result = builder().toBeType('status', 'string').run();
    expect(result.results[0]?.op).toBe('type');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toHaveLength 记录 length 断言', () => {
    const result = builder().toHaveLength('items', 3).run();
    expect(result.results[0]?.op).toBe('length');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toHaveLengthGt 记录 lengthGt 断言', () => {
    const result = builder().toHaveLengthGt('items', 2).run();
    expect(result.results[0]?.op).toBe('lengthGt');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toHaveLengthGte 记录 lengthGte 断言', () => {
    const result = builder().toHaveLengthGte('items', 3).run();
    expect(result.results[0]?.op).toBe('lengthGte');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toHaveLengthLt 记录 lengthLt 断言', () => {
    const result = builder().toHaveLengthLt('items', 10).run();
    expect(result.results[0]?.op).toBe('lengthLt');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toHaveLengthLte 记录 lengthLte 断言', () => {
    const result = builder().toHaveLengthLte('items', 3).run();
    expect(result.results[0]?.op).toBe('lengthLte');
    expect(result.results[0]?.passed).toBe(true);
  });
});

// ─── 对象和数组断言 ───────────────────────────────────────────────────────────

describe('RSExpectBuilder - 对象和数组断言', () => {
  const inst = {
    paging: { offset: 0, limit: 10, total: 100 },
    list: [{ status: 'done' }, { status: 'loading' }],
  };

  function builder() {
    return makeBuilder({ svc: inst }, 'svc');
  }

  it('toHaveKeys 记录 hasKeys 断言', () => {
    const result = builder().toHaveKeys('paging', ['offset', 'limit']).run();
    expect(result.results[0]?.op).toBe('hasKeys');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toMatchObject 记录 matchObject 断言', () => {
    const result = builder().toMatchObject('paging', { offset: 0, limit: 10 }).run();
    expect(result.results[0]?.op).toBe('matchObject');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toDeepEqual 记录 deepEq 断言', () => {
    const result = builder().toDeepEqual('paging', { offset: 0, limit: 10, total: 100 }).run();
    expect(result.results[0]?.op).toBe('deepEq');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toHaveSome 记录 some 断言', () => {
    const result = builder()
      .toHaveSome('list', { path: 'status', op: 'eq', expected: 'loading' })
      .run();
    expect(result.results[0]?.op).toBe('some');
    expect(result.results[0]?.passed).toBe(true);
  });

  it('toHaveEvery 记录 every 断言', () => {
    const result = builder().toHaveEvery('list', { path: 'status', op: 'exists' }).run();
    expect(result.results[0]?.op).toBe('every');
    expect(result.results[0]?.passed).toBe(true);
  });
});

// ─── run() 返回正确 AssertResult ──────────────────────────────────────────────

describe('RSExpectBuilder.run()', () => {
  it('全部通过时 passed=true，summary 正确', () => {
    const inst = { a: 1, b: 'hello' };
    const result = makeBuilder({ svc: inst }, 'svc').toBe('a', 1).toBeType('b', 'string').run();

    expect(result.passed).toBe(true);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.total).toBe(2);
    expect(result.instanceId).toBe('svc');
  });

  it('有失败时 passed=false', () => {
    const inst = { a: 1 };
    const result = makeBuilder({ svc: inst }, 'svc')
      .toBe('a', 1)
      .toBe('a', 999) // 失败
      .run();

    expect(result.passed).toBe(false);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.total).toBe(2);
  });

  it('多次调用 run() 返回相同结果（不清空断言）', () => {
    const inst = { val: 42 };
    const builder = makeBuilder({ svc: inst }, 'svc').toBe('val', 42);
    const r1 = builder.run();
    const r2 = builder.run();
    expect(r1.passed).toBe(r2.passed);
    expect(r1.results).toHaveLength(r2.results.length);
  });

  it('describe() 设置的描述出现在结果中', () => {
    const inst = { val: 1 };
    const result = makeBuilder({ svc: inst }, 'svc')
      .describe('验证初始化状态')
      .toBe('val', 1)
      .run();
    expect(result.description).toBe('验证初始化状态');
  });

  it('instanceId 不存在时所有断言标记失败', () => {
    const result = makeBuilder({}, 'nonExistent').toBe('val', 1).toExist('other').run();

    expect(result.passed).toBe(false);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.total).toBe(2);
    expect(result.results[0]?.error).toContain('nonExistent');
  });

  it('断言列表为空时 passed=true', () => {
    const result = makeBuilder({ svc: {} }, 'svc').run();
    expect(result.passed).toBe(true);
    expect(result.summary.total).toBe(0);
  });
});

// ─── check() ──────────────────────────────────────────────────────────────────

describe('RSExpectBuilder.check()', () => {
  beforeEach(() => {
    mockPrintAssertResult.mockClear();
  });

  it('全部通过时返回 true，并调用 printAssertResult', () => {
    const inst = { val: 42 };
    const passed = makeBuilder({ svc: inst }, 'svc').toBe('val', 42).check();
    expect(passed).toBe(true);
    expect(mockPrintAssertResult).toHaveBeenCalledTimes(1);
    expect(mockPrintAssertResult.mock.calls[0]?.[0]?.passed).toBe(true);
  });

  it('有失败时返回 false，并调用 printAssertResult', () => {
    const inst = { val: 42 };
    const passed = makeBuilder({ svc: inst }, 'svc').toBe('val', 999).check();
    expect(passed).toBe(false);
    expect(mockPrintAssertResult).toHaveBeenCalledTimes(1);
  });
});

// ─── expect() ─────────────────────────────────────────────────────────────────

describe('RSExpectBuilder.expect()', () => {
  it('全部通过时不抛错', () => {
    const inst = { val: 42 };
    expect(() => {
      makeBuilder({ svc: inst }, 'svc').toBe('val', 42).expect();
    }).not.toThrow();
  });

  it('有失败时抛出 RSAssertionError', () => {
    const inst = { val: 42 };
    expect(() => {
      makeBuilder({ svc: inst }, 'svc').toBe('val', 999).expect();
    }).toThrow(RSAssertionError);
  });

  it('RSAssertionError 包含结构化结果', () => {
    const inst = { val: 42 };
    try {
      makeBuilder({ svc: inst }, 'svc').toBe('val', 999).expect();
      fail('应该抛出 RSAssertionError');
    } catch (e) {
      expect(e).toBeInstanceOf(RSAssertionError);
      const err = e as RSAssertionError;
      const result = err.result as CDPAssertResult;
      expect(result.passed).toBe(false);
      expect(result.instanceId).toBe('svc');
      expect(err.name).toBe('RSAssertionError');
    }
  });

  it('错误消息包含 instanceId 和失败数量', () => {
    const inst = { a: 1, b: 2 };
    try {
      makeBuilder({ svc: inst }, 'svc')
        .toBe('a', 1) // 通过
        .toBe('b', 999) // 失败
        .expect();
    } catch (e) {
      const err = e as RSAssertionError;
      expect(err.message).toContain('svc');
      expect(err.message).toContain('1');
    }
  });
});

// ─── rsExpect - 独立使用入口 ──────────────────────────────────────────────────

describe('rsExpect(instance)', () => {
  it('直接使用 service 实例', () => {
    const inst = { val: 42 };
    const result = rsExpect(inst).toBe('val', 42).run();
    expect(result.passed).toBe(true);
    expect(result.instanceId).toBe('(direct)');
  });

  it('传入 description', () => {
    const inst = { val: 42 };
    const result = rsExpect(inst, '测试描述').run();
    expect(result.description).toBe('测试描述');
  });

  it('expect() 失败时抛出 RSAssertionError', () => {
    const inst = { val: 42 };
    expect(() => {
      rsExpect(inst).toBe('val', 999).expect();
    }).toThrow(RSAssertionError);
  });

  it('check() 通过时返回 true', () => {
    const inst = { val: 42 };
    mockPrintAssertResult.mockClear();
    const result = rsExpect(inst).toBe('val', 42).check();
    expect(result).toBe(true);
  });

  it('链式多个断言聚合', () => {
    const inst = {
      isInitialized: true,
      count: 5,
      items: [1, 2, 3],
    };

    const result = rsExpect(inst, '复合断言测试')
      .toBe('isInitialized', true)
      .toBeGreaterThan('count', 0)
      .toHaveLength('items', 3)
      .run();

    expect(result.passed).toBe(true);
    expect(result.summary.passed).toBe(3);
    expect(result.summary.total).toBe(3);
  });

  it('嵌套路径断言', () => {
    const inst = {
      ladingMonitorData: {
        list: [
          { waybillCode: 'WB001', status: 'done' },
          { waybillCode: 'WB002', status: 'loading' },
        ],
      },
    };

    const result = rsExpect(inst)
      .toBe('ladingMonitorData.list.0.status', 'done')
      .toHaveLength('ladingMonitorData.list', 2)
      .toHaveSome('ladingMonitorData.list', { path: 'status', op: 'eq', expected: 'loading' })
      .run();

    expect(result.passed).toBe(true);
  });
});

// ─── assert() 低阶 API ────────────────────────────────────────────────────────

describe('RSExpectBuilder.assert() - 低阶 API', () => {
  it('直接传 op 和 expected', () => {
    const inst = { val: 42 };
    const result = makeBuilder({ svc: inst }, 'svc').assert('val', 'eq', 42).run();
    expect(result.results[0]?.passed).toBe(true);
  });

  it('message 正确传递', () => {
    const inst = { val: 42 };
    const result = makeBuilder({ svc: inst }, 'svc').assert('val', 'eq', 42, '自定义消息').run();
    expect(result.results[0]?.message).toBe('自定义消息');
  });
});
