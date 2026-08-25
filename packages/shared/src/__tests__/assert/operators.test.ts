/**
 * assert/operators.ts 单元测试
 *
 * 覆盖全部 22 个操作符的 pass / fail 路径，以及边界条件（类型不匹配、null、undefined 等）。
 * 从 rs-web-mcp 的 utils/assert.test.ts 迁移至此。
 */

import { executeAssertion, executeAssertions } from '../../assert/operators';
import type { Assertion } from '../../assert/types';

// ─── 测试工具 ────────────────────────────────────────────────────────────────

/**
 * 创建 mock 实例对象（模拟 Service 状态载体）
 */
function makeInstance(fields: Record<string, unknown>): object {
  return fields;
}

/**
 * 快速断言：期望通过
 */
function expectPass(instance: object, assertion: Omit<Assertion, 'path'> & { path: string }): void {
  const result = executeAssertion(instance, assertion);
  expect(result.passed).toBe(true);
  expect(result.error).toBeUndefined();
}

/**
 * 快速断言：期望失败
 */
function expectFail(instance: object, assertion: Omit<Assertion, 'path'> & { path: string }): void {
  const result = executeAssertion(instance, assertion);
  expect(result.passed).toBe(false);
  expect(result.error).toBeDefined();
}

// ─── eq ──────────────────────────────────────────────────────────────────────

describe('op: eq', () => {
  it('值相等时通过', () => {
    const inst = makeInstance({ status: 'active' });
    expectPass(inst, { path: 'status', op: 'eq', expected: 'active' });
  });

  it('值不相等时失败', () => {
    const inst = makeInstance({ status: 'active' });
    expectFail(inst, { path: 'status', op: 'eq', expected: 'inactive' });
  });

  it('数值相等时通过', () => {
    const inst = makeInstance({ count: 42 });
    expectPass(inst, { path: 'count', op: 'eq', expected: 42 });
  });

  it('布尔值相等时通过', () => {
    const inst = makeInstance({ flag: true });
    expectPass(inst, { path: 'flag', op: 'eq', expected: true });
  });

  it('null 与 null 相等时通过', () => {
    const inst = makeInstance({ data: null });
    expectPass(inst, { path: 'data', op: 'eq', expected: null });
  });

  it('actual 为安全摘要（字符串原值）', () => {
    const inst = makeInstance({ name: 'test' });
    const result = executeAssertion(inst, { path: 'name', op: 'eq', expected: 'test' });
    expect(result.actual).toBe('test');
  });
});

// ─── neq ─────────────────────────────────────────────────────────────────────

describe('op: neq', () => {
  it('值不相等时通过', () => {
    const inst = makeInstance({ status: 'active' });
    expectPass(inst, { path: 'status', op: 'neq', expected: 'inactive' });
  });

  it('值相等时失败', () => {
    const inst = makeInstance({ status: 'active' });
    expectFail(inst, { path: 'status', op: 'neq', expected: 'active' });
  });
});

// ─── gt ──────────────────────────────────────────────────────────────────────

describe('op: gt', () => {
  it('actual > expected 时通过', () => {
    const inst = makeInstance({ count: 10 });
    expectPass(inst, { path: 'count', op: 'gt', expected: 5 });
  });

  it('actual === expected 时失败', () => {
    const inst = makeInstance({ count: 5 });
    expectFail(inst, { path: 'count', op: 'gt', expected: 5 });
  });

  it('actual < expected 时失败', () => {
    const inst = makeInstance({ count: 3 });
    expectFail(inst, { path: 'count', op: 'gt', expected: 5 });
  });

  it('非数值时失败', () => {
    const inst = makeInstance({ count: '10' });
    expectFail(inst, { path: 'count', op: 'gt', expected: 5 });
  });
});

// ─── gte ─────────────────────────────────────────────────────────────────────

describe('op: gte', () => {
  it('actual >= expected 时通过（大于）', () => {
    const inst = makeInstance({ offset: 10 });
    expectPass(inst, { path: 'offset', op: 'gte', expected: 5 });
  });

  it('actual === expected 时通过', () => {
    const inst = makeInstance({ offset: 5 });
    expectPass(inst, { path: 'offset', op: 'gte', expected: 5 });
  });

  it('actual < expected 时失败', () => {
    const inst = makeInstance({ offset: 3 });
    expectFail(inst, { path: 'offset', op: 'gte', expected: 5 });
  });
});

// ─── lt ──────────────────────────────────────────────────────────────────────

describe('op: lt', () => {
  it('actual < expected 时通过', () => {
    const inst = makeInstance({ count: 3 });
    expectPass(inst, { path: 'count', op: 'lt', expected: 5 });
  });

  it('actual === expected 时失败', () => {
    const inst = makeInstance({ count: 5 });
    expectFail(inst, { path: 'count', op: 'lt', expected: 5 });
  });

  it('actual > expected 时失败', () => {
    const inst = makeInstance({ count: 10 });
    expectFail(inst, { path: 'count', op: 'lt', expected: 5 });
  });
});

// ─── lte ─────────────────────────────────────────────────────────────────────

describe('op: lte', () => {
  it('actual <= expected 时通过（小于）', () => {
    const inst = makeInstance({ count: 3 });
    expectPass(inst, { path: 'count', op: 'lte', expected: 5 });
  });

  it('actual === expected 时通过', () => {
    const inst = makeInstance({ count: 5 });
    expectPass(inst, { path: 'count', op: 'lte', expected: 5 });
  });

  it('actual > expected 时失败', () => {
    const inst = makeInstance({ count: 10 });
    expectFail(inst, { path: 'count', op: 'lte', expected: 5 });
  });
});

// ─── exists ──────────────────────────────────────────────────────────────────

describe('op: exists', () => {
  it('非 null/undefined 值时通过', () => {
    const inst = makeInstance({ data: { list: [] } });
    expectPass(inst, { path: 'data', op: 'exists' });
  });

  it('字符串 "" 时通过（非 null/undefined）', () => {
    const inst = makeInstance({ name: '' });
    expectPass(inst, { path: 'name', op: 'exists' });
  });

  it('数值 0 时通过', () => {
    const inst = makeInstance({ count: 0 });
    expectPass(inst, { path: 'count', op: 'exists' });
  });

  it('null 时失败', () => {
    const inst = makeInstance({ data: null });
    expectFail(inst, { path: 'data', op: 'exists' });
  });

  it('undefined 时失败', () => {
    const inst = makeInstance({});
    expectFail(inst, { path: 'missing', op: 'exists' });
  });

  it('actual 返回 boolean 而非原始值', () => {
    const inst = makeInstance({ data: { nested: true } });
    const result = executeAssertion(inst, { path: 'data', op: 'exists' });
    expect(result.actual).toBe(true); // 返回 boolean，不暴露对象
  });
});

// ─── notExists ───────────────────────────────────────────────────────────────

describe('op: notExists', () => {
  it('null 时通过', () => {
    const inst = makeInstance({ data: null });
    expectPass(inst, { path: 'data', op: 'notExists' });
  });

  it('undefined（路径不存在）时通过', () => {
    const inst = makeInstance({});
    expectPass(inst, { path: 'missing', op: 'notExists' });
  });

  it('有值时失败', () => {
    const inst = makeInstance({ data: 'some value' });
    expectFail(inst, { path: 'data', op: 'notExists' });
  });

  it('actual 返回 boolean', () => {
    const inst = makeInstance({ data: null });
    const result = executeAssertion(inst, { path: 'data', op: 'notExists' });
    expect(result.actual).toBe(true);
  });
});

// ─── includes ────────────────────────────────────────────────────────────────

describe('op: includes', () => {
  it('字符串包含子串时通过', () => {
    const inst = makeInstance({ name: 'hello world' });
    expectPass(inst, { path: 'name', op: 'includes', expected: 'world' });
  });

  it('字符串不包含子串时失败', () => {
    const inst = makeInstance({ name: 'hello world' });
    expectFail(inst, { path: 'name', op: 'includes', expected: 'xyz' });
  });

  it('数组包含元素时通过', () => {
    const inst = makeInstance({ tags: ['a', 'b', 'c'] });
    expectPass(inst, { path: 'tags', op: 'includes', expected: 'b' });
  });

  it('数组不包含元素时失败', () => {
    const inst = makeInstance({ tags: ['a', 'b', 'c'] });
    expectFail(inst, { path: 'tags', op: 'includes', expected: 'x' });
  });

  it('非字符串 / 非数组时失败', () => {
    const inst = makeInstance({ count: 123 });
    expectFail(inst, { path: 'count', op: 'includes', expected: 1 });
  });
});

// ─── notIncludes ─────────────────────────────────────────────────────────────

describe('op: notIncludes', () => {
  it('字符串不包含子串时通过', () => {
    const inst = makeInstance({ name: 'hello world' });
    expectPass(inst, { path: 'name', op: 'notIncludes', expected: 'xyz' });
  });

  it('字符串包含子串时失败', () => {
    const inst = makeInstance({ name: 'hello world' });
    expectFail(inst, { path: 'name', op: 'notIncludes', expected: 'world' });
  });

  it('数组不包含元素时通过', () => {
    const inst = makeInstance({ tags: ['a', 'b'] });
    expectPass(inst, { path: 'tags', op: 'notIncludes', expected: 'c' });
  });
});

// ─── matches ─────────────────────────────────────────────────────────────────

describe('op: matches', () => {
  it('正则匹配时通过', () => {
    const inst = makeInstance({ activeStep: 'route-plan' });
    expectPass(inst, { path: 'activeStep', op: 'matches', expected: '^route' });
  });

  it('正则不匹配时失败', () => {
    const inst = makeInstance({ activeStep: 'loading' });
    expectFail(inst, { path: 'activeStep', op: 'matches', expected: '^route' });
  });

  it('suffix$ 匹配时通过', () => {
    const inst = makeInstance({ url: 'http://example.com/api' });
    expectPass(inst, { path: 'url', op: 'matches', expected: '/api$' });
  });

  it('非字符串时失败', () => {
    const inst = makeInstance({ count: 123 });
    expectFail(inst, { path: 'count', op: 'matches', expected: '\\d+' });
  });
});

// ─── type ─────────────────────────────────────────────────────────────────────

describe('op: type', () => {
  it('typeof 匹配时通过', () => {
    const inst = makeInstance({ name: 'hello', count: 42, flag: true });
    expectPass(inst, { path: 'name', op: 'type', expected: 'string' });
    expectPass(inst, { path: 'count', op: 'type', expected: 'number' });
    expectPass(inst, { path: 'flag', op: 'type', expected: 'boolean' });
  });

  it('typeof 不匹配时失败', () => {
    const inst = makeInstance({ name: 'hello' });
    expectFail(inst, { path: 'name', op: 'type', expected: 'number' });
  });

  it('null 的 typeof 为 object', () => {
    const inst = makeInstance({ data: null });
    expectPass(inst, { path: 'data', op: 'type', expected: 'object' });
  });

  it('actual 返回 typeof 字符串', () => {
    const inst = makeInstance({ count: 42 });
    const result = executeAssertion(inst, { path: 'count', op: 'type', expected: 'number' });
    expect(result.actual).toBe('number');
  });
});

// ─── length ───────────────────────────────────────────────────────────────────

describe('op: length', () => {
  it('数组长度等于 expected 时通过', () => {
    const inst = makeInstance({ list: [1, 2, 3] });
    expectPass(inst, { path: 'list', op: 'length', expected: 3 });
  });

  it('字符串长度等于 expected 时通过', () => {
    const inst = makeInstance({ code: 'abc' });
    expectPass(inst, { path: 'code', op: 'length', expected: 3 });
  });

  it('长度不等时失败', () => {
    const inst = makeInstance({ list: [1, 2] });
    expectFail(inst, { path: 'list', op: 'length', expected: 3 });
  });

  it('actual 返回长度数字', () => {
    const inst = makeInstance({ list: [1, 2, 3] });
    const result = executeAssertion(inst, { path: 'list', op: 'length', expected: 3 });
    expect(result.actual).toBe(3);
  });
});

// ─── lengthGt ────────────────────────────────────────────────────────────────

describe('op: lengthGt', () => {
  it('length > expected 时通过', () => {
    const inst = makeInstance({ list: [1, 2, 3] });
    expectPass(inst, { path: 'list', op: 'lengthGt', expected: 2 });
  });

  it('length === expected 时失败', () => {
    const inst = makeInstance({ list: [1, 2, 3] });
    expectFail(inst, { path: 'list', op: 'lengthGt', expected: 3 });
  });
});

// ─── lengthGte ───────────────────────────────────────────────────────────────

describe('op: lengthGte', () => {
  it('length >= expected 时通过（大于）', () => {
    const inst = makeInstance({ list: [1, 2, 3] });
    expectPass(inst, { path: 'list', op: 'lengthGte', expected: 2 });
  });

  it('length === expected 时通过', () => {
    const inst = makeInstance({ list: [1, 2, 3] });
    expectPass(inst, { path: 'list', op: 'lengthGte', expected: 3 });
  });

  it('length < expected 时失败', () => {
    const inst = makeInstance({ list: [1, 2] });
    expectFail(inst, { path: 'list', op: 'lengthGte', expected: 3 });
  });
});

// ─── lengthLt ────────────────────────────────────────────────────────────────

describe('op: lengthLt', () => {
  it('length < expected 时通过', () => {
    const inst = makeInstance({ list: [1, 2] });
    expectPass(inst, { path: 'list', op: 'lengthLt', expected: 3 });
  });

  it('length === expected 时失败', () => {
    const inst = makeInstance({ list: [1, 2, 3] });
    expectFail(inst, { path: 'list', op: 'lengthLt', expected: 3 });
  });
});

// ─── lengthLte ───────────────────────────────────────────────────────────────

describe('op: lengthLte', () => {
  it('length <= expected 时通过（小于）', () => {
    const inst = makeInstance({ list: [1, 2] });
    expectPass(inst, { path: 'list', op: 'lengthLte', expected: 3 });
  });

  it('length === expected 时通过', () => {
    const inst = makeInstance({ list: [1, 2, 3] });
    expectPass(inst, { path: 'list', op: 'lengthLte', expected: 3 });
  });

  it('length > expected 时失败', () => {
    const inst = makeInstance({ list: [1, 2, 3, 4] });
    expectFail(inst, { path: 'list', op: 'lengthLte', expected: 3 });
  });
});

// ─── deepEq ──────────────────────────────────────────────────────────────────

describe('op: deepEq', () => {
  it('对象深度相等时通过', () => {
    const inst = makeInstance({ paging: { offset: 0, limit: 10 } });
    expectPass(inst, { path: 'paging', op: 'deepEq', expected: { offset: 0, limit: 10 } });
  });

  it('对象结构不同时失败', () => {
    const inst = makeInstance({ paging: { offset: 0, limit: 10 } });
    expectFail(inst, { path: 'paging', op: 'deepEq', expected: { offset: 1, limit: 10 } });
  });

  it('数组深度相等时通过', () => {
    const inst = makeInstance({ ids: [1, 2, 3] });
    expectPass(inst, { path: 'ids', op: 'deepEq', expected: [1, 2, 3] });
  });

  it('deepEq 直接返回原始值（例外）', () => {
    const obj = { offset: 0 };
    const inst = makeInstance({ paging: obj });
    const result = executeAssertion(inst, {
      path: 'paging',
      op: 'deepEq',
      expected: { offset: 0 },
    });
    expect(result.actual).toEqual({ offset: 0 });
  });
});

// ─── between ──────────────────────────────────────────────────────────────────

describe('op: between', () => {
  it('闭区间内时通过（中间值）', () => {
    const inst = makeInstance({ offset: 50 });
    expectPass(inst, { path: 'offset', op: 'between', expected: [0, 1000] });
  });

  it('等于下界时通过', () => {
    const inst = makeInstance({ offset: 0 });
    expectPass(inst, { path: 'offset', op: 'between', expected: [0, 1000] });
  });

  it('等于上界时通过', () => {
    const inst = makeInstance({ offset: 1000 });
    expectPass(inst, { path: 'offset', op: 'between', expected: [0, 1000] });
  });

  it('小于下界时失败', () => {
    const inst = makeInstance({ offset: -1 });
    expectFail(inst, { path: 'offset', op: 'between', expected: [0, 1000] });
  });

  it('大于上界时失败', () => {
    const inst = makeInstance({ offset: 1001 });
    expectFail(inst, { path: 'offset', op: 'between', expected: [0, 1000] });
  });

  it('非数值时失败', () => {
    const inst = makeInstance({ offset: 'abc' });
    expectFail(inst, { path: 'offset', op: 'between', expected: [0, 1000] });
  });

  it('actual 返回原始数值', () => {
    const inst = makeInstance({ limit: 20 });
    const result = executeAssertion(inst, { path: 'limit', op: 'between', expected: [10, 100] });
    expect(result.actual).toBe(20);
  });
});

// ─── hasKeys ──────────────────────────────────────────────────────────────────

describe('op: hasKeys', () => {
  it('对象包含单个 string key 时通过', () => {
    const inst = makeInstance({ pagination: { offset: 0, limit: 10, total: 100 } });
    expectPass(inst, { path: 'pagination', op: 'hasKeys', expected: 'offset' });
  });

  it('对象包含 string[] 中所有 key 时通过', () => {
    const inst = makeInstance({ pagination: { offset: 0, limit: 10, total: 100 } });
    expectPass(inst, { path: 'pagination', op: 'hasKeys', expected: ['offset', 'limit', 'total'] });
  });

  it('对象缺少某个 key 时失败', () => {
    const inst = makeInstance({ pagination: { offset: 0, limit: 10 } });
    expectFail(inst, { path: 'pagination', op: 'hasKeys', expected: ['offset', 'limit', 'total'] });
  });

  it('值为 null 时失败', () => {
    const inst = makeInstance({ paging: null });
    expectFail(inst, { path: 'paging', op: 'hasKeys', expected: 'offset' });
  });

  it('actual 始终返回 "[Object]"', () => {
    const inst = makeInstance({ paging: { offset: 0, limit: 10 } });
    const result = executeAssertion(inst, { path: 'paging', op: 'hasKeys', expected: 'offset' });
    expect(result.actual).toBe('[Object]');
  });
});

// ─── matchObject ──────────────────────────────────────────────────────────────

describe('op: matchObject', () => {
  it('对象包含所有 expected 键值对时通过（完全匹配）', () => {
    const inst = makeInstance({ paging: { offset: 0, limit: 10 } });
    expectPass(inst, { path: 'paging', op: 'matchObject', expected: { offset: 0, limit: 10 } });
  });

  it('对象包含所有 expected 键值对时通过（允许多余字段）', () => {
    const inst = makeInstance({ paging: { offset: 0, limit: 10, total: 100 } });
    expectPass(inst, { path: 'paging', op: 'matchObject', expected: { offset: 0, limit: 10 } });
  });

  it('某个 key 的值不匹配时失败', () => {
    const inst = makeInstance({ paging: { offset: 5, limit: 10 } });
    expectFail(inst, { path: 'paging', op: 'matchObject', expected: { offset: 0, limit: 10 } });
  });

  it('值为 null 时失败', () => {
    const inst = makeInstance({ paging: null });
    expectFail(inst, { path: 'paging', op: 'matchObject', expected: { offset: 0 } });
  });

  it('actual 始终返回 "[Object]"', () => {
    const inst = makeInstance({ paging: { offset: 0, limit: 10 } });
    const result = executeAssertion(inst, {
      path: 'paging',
      op: 'matchObject',
      expected: { offset: 0 },
    });
    expect(result.actual).toBe('[Object]');
  });
});

// ─── some ─────────────────────────────────────────────────────────────────────

describe('op: some', () => {
  it('至少一个元素满足子断言时通过', () => {
    const inst = makeInstance({
      list: [{ status: 'done' }, { status: 'loading' }, { status: 'error' }],
    });
    expectPass(inst, {
      path: 'list',
      op: 'some',
      expected: { path: 'status', op: 'eq', expected: 'loading' },
    });
  });

  it('所有元素都不满足时失败', () => {
    const inst = makeInstance({
      list: [{ status: 'done' }, { status: 'done' }],
    });
    expectFail(inst, {
      path: 'list',
      op: 'some',
      expected: { path: 'status', op: 'eq', expected: 'loading' },
    });
  });

  it('空数组时失败', () => {
    const inst = makeInstance({ list: [] });
    expectFail(inst, {
      path: 'list',
      op: 'some',
      expected: { path: 'status', op: 'exists' },
    });
  });

  it('actual 返回 "[Array(N)]" 格式', () => {
    const inst = makeInstance({ list: [{ status: 'done' }] });
    const result = executeAssertion(inst, {
      path: 'list',
      op: 'some',
      expected: { path: 'status', op: 'eq', expected: 'done' },
    });
    expect(result.actual).toBe('[Array(1)]');
  });

  it('非 ScalarAssertOp（every/some 嵌套）时子断言失败（防递归）', () => {
    const inst = makeInstance({
      list: [{ items: [{ x: 1 }] }],
    });
    const result = executeAssertion(inst, {
      path: 'list',
      op: 'some',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expected: {
        path: 'items',
        op: 'every' as any,
        expected: { path: 'x', op: 'eq', expected: 1 },
      },
    });
    expect(result.passed).toBe(false);
  });
});

// ─── every ────────────────────────────────────────────────────────────────────

describe('op: every', () => {
  it('所有元素满足子断言时通过', () => {
    const inst = makeInstance({
      list: [{ status: 'done' }, { status: 'done' }, { status: 'done' }],
    });
    expectPass(inst, {
      path: 'list',
      op: 'every',
      expected: { path: 'status', op: 'eq', expected: 'done' },
    });
  });

  it('有一个元素不满足时失败', () => {
    const inst = makeInstance({
      list: [{ status: 'done' }, { status: 'loading' }],
    });
    expectFail(inst, {
      path: 'list',
      op: 'every',
      expected: { path: 'status', op: 'eq', expected: 'done' },
    });
  });

  it('空数组时失败（防止空数组意外通过）', () => {
    const inst = makeInstance({ list: [] });
    expectFail(inst, {
      path: 'list',
      op: 'every',
      expected: { path: 'status', op: 'exists' },
    });
  });

  it('actual 返回 "[Array(N)]" 格式', () => {
    const inst = makeInstance({
      list: [{ status: 'done' }, { status: 'done' }],
    });
    const result = executeAssertion(inst, {
      path: 'list',
      op: 'every',
      expected: { path: 'status', op: 'eq', expected: 'done' },
    });
    expect(result.actual).toBe('[Array(2)]');
  });
});

// ─── 错误信息格式测试 ─────────────────────────────────────────────────────────

describe('错误信息格式', () => {
  it('标量操作符失败时包含路径、op、期望值、实际值', () => {
    const inst = makeInstance({ activeStep: 'route-plan' });
    const result = executeAssertion(inst, {
      path: 'activeStep',
      op: 'eq',
      expected: 'loading',
    });
    expect(result.error).toContain('activeStep');
    expect(result.error).toContain('eq');
    expect(result.error).toContain('"loading"');
    expect(result.error).toContain('"route-plan"');
  });

  it('exists 操作符失败时只包含路径和 op', () => {
    const inst = makeInstance({ data: null });
    const result = executeAssertion(inst, { path: 'data', op: 'exists' });
    expect(result.error).toContain('data');
    expect(result.error).toContain('exists');
  });

  it('length 类操作符失败时显示 length 数值', () => {
    const inst = makeInstance({ list: [1, 2] });
    const result = executeAssertion(inst, {
      path: 'list',
      op: 'lengthGte',
      expected: 5,
    });
    expect(result.error).toContain('2'); // 实际 length
    expect(result.error).toContain('5'); // 期望值
  });

  it('通过时 error 字段不存在', () => {
    const inst = makeInstance({ count: 5 });
    const result = executeAssertion(inst, { path: 'count', op: 'eq', expected: 5 });
    expect(result.error).toBeUndefined();
  });

  it('message 字段正确传递到结果', () => {
    const inst = makeInstance({ list: [] });
    const result = executeAssertion(inst, {
      path: 'list',
      op: 'lengthGte',
      expected: 1,
      message: '列表不为空',
    });
    expect(result.message).toBe('列表不为空');
  });
});

// ─── executeAssertions 批量断言测试 ──────────────────────────────────────────

describe('executeAssertions', () => {
  it('所有断言通过时 passed 为 true', () => {
    const inst = makeInstance({ isInitialized: true, count: 5 });
    const result = executeAssertions(inst, [
      { path: 'isInitialized', op: 'eq', expected: true },
      { path: 'count', op: 'gt', expected: 0 },
    ]);
    expect(result.passed).toBe(true);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.total).toBe(2);
  });

  it('有断言失败时 passed 为 false', () => {
    const inst = makeInstance({ isInitialized: false, count: 5 });
    const result = executeAssertions(inst, [
      { path: 'isInitialized', op: 'eq', expected: true },
      { path: 'count', op: 'gt', expected: 0 },
    ]);
    expect(result.passed).toBe(false);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.total).toBe(2);
  });

  it('空断言列表时 passed 为 true', () => {
    const inst = makeInstance({});
    const result = executeAssertions(inst, []);
    expect(result.passed).toBe(true);
    expect(result.summary.total).toBe(0);
  });

  it('返回每条断言的详细结果', () => {
    const inst = makeInstance({ a: 1, b: 2 });
    const result = executeAssertions(inst, [
      { path: 'a', op: 'eq', expected: 1 },
      { path: 'b', op: 'eq', expected: 99 }, // 失败
    ]);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.passed).toBe(true);
    expect(result.results[1]?.passed).toBe(false);
  });
});
