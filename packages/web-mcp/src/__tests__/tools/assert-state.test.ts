/**
 * tools/assert-state.ts 单元测试
 *
 * 测试 assertState 函数和 createAssertStateTool 工厂函数
 */

import { assertState, createAssertStateTool } from '../../tools/assert-state';
import type { Service } from '@rabjs/service';

// ─── 测试工具 ────────────────────────────────────────────────────────────────

/**
 * 创建 mock Service 实例（带状态字段）
 */
function makeMockService(state: Record<string, unknown>, instanceId = 'MockService#0'): Service {
  return {
    instanceId,
    ...state,
  } as unknown as Service;
}

/**
 * 创建 instanceMap
 */
function makeMap(services: Service[]): Map<string, Service> {
  const map = new Map<string, Service>();
  for (const svc of services) {
    if (svc.instanceId) {
      map.set(svc.instanceId, svc);
    }
  }
  return map;
}

// ─── assertState ─────────────────────────────────────────────────────────────

describe('assertState', () => {
  // ─── 基础路由和错误处理 ────────────────────────────────────────────────────

  it('instanceId 不存在时所有断言失败，返回错误信息', () => {
    const map = new Map<string, Service>();
    const result = assertState(map, {
      instanceId: 'NotExists#0',
      assertions: [
        { path: 'status', op: 'eq', expected: 'active' },
        { path: 'count', op: 'gt', expected: 0 },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.total).toBe(2);
    expect(result.results).toHaveLength(2);
    result.results.forEach(r => {
      expect(r.passed).toBe(false);
      expect(r.error).toMatch(/Service instance not found/);
      expect(r.error).toMatch(/NotExists#0/);
    });
  });

  it('实例不存在时结果中的 actual 为 undefined', () => {
    const map = new Map<string, Service>();
    const result = assertState(map, {
      instanceId: 'NotExists#0',
      assertions: [{ path: 'status', op: 'eq', expected: 'active' }],
    });
    expect(result.results[0]?.actual).toBeUndefined();
  });

  it('空断言列表时视为全部通过', () => {
    const svc = makeMockService({ status: 'active' });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [],
    });

    expect(result.passed).toBe(true);
    expect(result.summary.total).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  // ─── 单条断言 ──────────────────────────────────────────────────────────────

  it('单条断言通过', () => {
    const svc = makeMockService({ isInitialized: true });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [{ path: 'isInitialized', op: 'eq', expected: true }],
    });

    expect(result.passed).toBe(true);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.total).toBe(1);
  });

  it('单条断言失败', () => {
    const svc = makeMockService({ isInitialized: false });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [{ path: 'isInitialized', op: 'eq', expected: true }],
    });

    expect(result.passed).toBe(false);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.total).toBe(1);
    expect(result.results[0]?.error).toBeDefined();
  });

  // ─── 批量断言 ──────────────────────────────────────────────────────────────

  it('多条断言全部通过', () => {
    const svc = makeMockService({
      isInitialized: true,
      activeStep: 'route-plan',
      offset: 0,
    });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [
        { path: 'isInitialized', op: 'eq', expected: true },
        { path: 'activeStep', op: 'eq', expected: 'route-plan' },
        { path: 'offset', op: 'gte', expected: 0 },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.summary.passed).toBe(3);
    expect(result.summary.total).toBe(3);
  });

  it('多条断言部分失败', () => {
    const svc = makeMockService({
      isInitialized: true,
      activeStep: 'loading', // 与 expected 不符
    });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [
        { path: 'isInitialized', op: 'eq', expected: true },
        { path: 'activeStep', op: 'eq', expected: 'route-plan' },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.total).toBe(2);
  });

  // ─── 点分路径 ──────────────────────────────────────────────────────────────

  it('点分路径断言嵌套字段', () => {
    const svc = makeMockService({
      ladingMonitorData: {
        list: [
          { waybillCode: 'WB001', status: 'done' },
          { waybillCode: 'WB002', status: 'loading' },
        ],
        total: 2,
      },
    });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [
        { path: 'ladingMonitorData.total', op: 'eq', expected: 2 },
        { path: 'ladingMonitorData.list.length', op: 'eq', expected: 2 },
        { path: 'ladingMonitorData.list.0.status', op: 'eq', expected: 'done' },
        { path: 'ladingMonitorData.list.1.status', op: 'eq', expected: 'loading' },
      ],
    });

    expect(result.passed).toBe(true);
  });

  it('中间节点为 null 时路径解析返回 undefined（notExists 通过）', () => {
    const svc = makeMockService({ ladingMonitorData: null });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [{ path: 'ladingMonitorData.list', op: 'notExists' }],
    });

    expect(result.passed).toBe(true);
  });

  // ─── 新增操作符集成测试 ────────────────────────────────────────────────────

  describe('新增操作符集成', () => {
    it('between: 验证数值区间', () => {
      const svc = makeMockService({ offset: 50, limit: 20 });
      const map = makeMap([svc]);

      const result = assertState(map, {
        instanceId: 'MockService#0',
        assertions: [
          { path: 'offset', op: 'between', expected: [0, 1000] },
          { path: 'limit', op: 'between', expected: [10, 100] },
        ],
      });

      expect(result.passed).toBe(true);
    });

    it('hasKeys: 验证对象包含指定 key', () => {
      const svc = makeMockService({
        inStorePaging: { offset: 0, limit: 10, total: 50 },
      });
      const map = makeMap([svc]);

      const result = assertState(map, {
        instanceId: 'MockService#0',
        assertions: [
          { path: 'inStorePaging', op: 'hasKeys', expected: ['offset', 'limit', 'total'] },
        ],
      });

      expect(result.passed).toBe(true);
    });

    it('matchObject: 验证对象浅层匹配', () => {
      const svc = makeMockService({
        inStorePaging: { offset: 0, limit: 10, total: 50 },
      });
      const map = makeMap([svc]);

      const result = assertState(map, {
        instanceId: 'MockService#0',
        assertions: [
          { path: 'inStorePaging', op: 'matchObject', expected: { offset: 0, limit: 10 } },
        ],
      });

      expect(result.passed).toBe(true);
    });

    it('every: 验证数组所有元素满足子断言', () => {
      const svc = makeMockService({
        ladingMonitorData: {
          list: [
            { waybillCode: 'WB001', status: 'done' },
            { waybillCode: 'WB002', status: 'loading' },
          ],
        },
      });
      const map = makeMap([svc]);

      const result = assertState(map, {
        instanceId: 'MockService#0',
        assertions: [
          {
            path: 'ladingMonitorData.list',
            op: 'every',
            expected: { path: 'status', op: 'exists' },
            message: '每条运单均有 status 字段',
          },
        ],
      });

      expect(result.passed).toBe(true);
      expect(result.results[0]?.message).toBe('每条运单均有 status 字段');
    });

    it('some: 验证数组至少一个元素满足子断言', () => {
      const svc = makeMockService({
        list: [{ status: 'done' }, { status: 'loading' }],
      });
      const map = makeMap([svc]);

      const result = assertState(map, {
        instanceId: 'MockService#0',
        assertions: [
          {
            path: 'list',
            op: 'some',
            expected: { path: 'status', op: 'eq', expected: 'loading' },
          },
        ],
      });

      expect(result.passed).toBe(true);
    });

    it('typical: 场景一——分页区间合理性验证', () => {
      const svc = makeMockService({ offset: 0, limit: 20 });
      const map = makeMap([svc]);

      const result = assertState(map, {
        instanceId: 'MockService#0',
        assertions: [
          { path: 'offset', op: 'between', expected: [0, 1000] },
          { path: 'limit', op: 'between', expected: [10, 100] },
        ],
      });

      expect(result.passed).toBe(true);
    });

    it('typical: 场景二——列表非空且所有运单状态已填充', () => {
      const svc = makeMockService({
        ladingMonitorData: {
          list: [
            { waybillCode: 'WB001', status: 'done' },
            { waybillCode: 'WB002', status: 'loading' },
          ],
          total: 2,
        },
      });
      const map = makeMap([svc]);

      const result = assertState(map, {
        instanceId: 'MockService#0',
        description: '验证列表非空且所有运单状态已填充',
        assertions: [
          {
            path: 'ladingMonitorData.list',
            op: 'lengthGte',
            expected: 1,
            message: '列表不为空',
          },
          {
            path: 'ladingMonitorData.list',
            op: 'every',
            expected: { path: 'status', op: 'exists' },
            message: '每条运单均有 status 字段',
          },
        ],
      });

      expect(result.passed).toBe(true);
    });

    it('typical: 场景三——验证分页对象结构完整', () => {
      const svc = makeMockService({
        inStorePaging: { offset: 0, limit: 20, total: 50 },
      });
      const map = makeMap([svc]);

      const result = assertState(map, {
        instanceId: 'MockService#0',
        assertions: [
          { path: 'inStorePaging', op: 'hasKeys', expected: ['offset', 'limit', 'total'] },
          { path: 'inStorePaging', op: 'matchObject', expected: { offset: 0, limit: 20 } },
        ],
      });

      expect(result.passed).toBe(true);
    });
  });

  // ─── 结果结构验证 ──────────────────────────────────────────────────────────

  it('每条结果包含必要的 path / op / expected / actual / passed 字段', () => {
    const svc = makeMockService({ count: 5 });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [{ path: 'count', op: 'eq', expected: 5 }],
    });

    const r = result.results[0];
    expect(r?.path).toBe('count');
    expect(r?.op).toBe('eq');
    expect(r?.expected).toBe(5);
    expect(r?.actual).toBe(5);
    expect(r?.passed).toBe(true);
  });

  it('失败结果包含 error 字段，通过时不包含', () => {
    const svc = makeMockService({ count: 5 });
    const map = makeMap([svc]);

    const failResult = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [{ path: 'count', op: 'eq', expected: 99 }],
    });
    expect(failResult.results[0]?.error).toBeDefined();

    const passResult = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [{ path: 'count', op: 'eq', expected: 5 }],
    });
    expect(passResult.results[0]?.error).toBeUndefined();
  });

  it('message 字段正确传递到结果', () => {
    const svc = makeMockService({ list: [] });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [
        {
          path: 'list',
          op: 'lengthGte',
          expected: 1,
          message: '列表不为空',
        },
      ],
    });

    expect(result.results[0]?.message).toBe('列表不为空');
  });

  it('对象字段的 actual 为安全摘要（[Object]）', () => {
    const svc = makeMockService({ paging: { offset: 0 } });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [{ path: 'paging', op: 'hasKeys', expected: 'offset' }],
    });

    expect(result.results[0]?.actual).toBe('[Object]');
  });

  it('数组字段在 every/some 中的 actual 为 [Array(N)]', () => {
    const svc = makeMockService({ list: [{ status: 'done' }] });
    const map = makeMap([svc]);

    const result = assertState(map, {
      instanceId: 'MockService#0',
      assertions: [
        {
          path: 'list',
          op: 'every',
          expected: { path: 'status', op: 'exists' },
        },
      ],
    });

    expect(result.results[0]?.actual).toBe('[Array(1)]');
  });

  // ─── 多个 Service 实例路由 ─────────────────────────────────────────────────

  it('多个 Service 实例各自独立路由', () => {
    const svcA = makeMockService({ status: 'active' }, 'ServiceA#0');
    const svcB = makeMockService({ status: 'inactive' }, 'ServiceB#0');
    const map = makeMap([svcA, svcB]);

    const resultA = assertState(map, {
      instanceId: 'ServiceA#0',
      assertions: [{ path: 'status', op: 'eq', expected: 'active' }],
    });
    const resultB = assertState(map, {
      instanceId: 'ServiceB#0',
      assertions: [{ path: 'status', op: 'eq', expected: 'inactive' }],
    });

    expect(resultA.passed).toBe(true);
    expect(resultB.passed).toBe(true);
  });
});

// ─── createAssertStateTool ────────────────────────────────────────────────────

describe('createAssertStateTool', () => {
  it('返回正确的 Tool 定义结构', () => {
    const map = new Map<string, Service>();
    const tool = createAssertStateTool(map);

    expect(tool.name).toBe('assert_state');
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('inputSchema 包含必要字段', () => {
    const map = new Map<string, Service>();
    const tool = createAssertStateTool(map);

    const schema = tool.inputSchema as Record<string, unknown>;
    const props = schema['properties'] as Record<string, unknown>;
    expect(props).toHaveProperty('instanceId');
    expect(props).toHaveProperty('assertions');
    expect(schema['required']).toContain('instanceId');
    expect(schema['required']).toContain('assertions');
  });

  it('inputSchema 的 op enum 包含所有新增操作符', () => {
    const map = new Map<string, Service>();
    const tool = createAssertStateTool(map);

    const schema = tool.inputSchema as Record<string, unknown>;
    const props = schema['properties'] as Record<string, unknown>;
    const assertions = props['assertions'] as Record<string, unknown>;
    const items = assertions['items'] as Record<string, unknown>;
    const opProps = (items['properties'] as Record<string, unknown>)['op'] as Record<
      string,
      unknown
    >;
    const opEnum = opProps['enum'] as string[];

    expect(opEnum).toContain('between');
    expect(opEnum).toContain('hasKeys');
    expect(opEnum).toContain('matchObject');
    expect(opEnum).toContain('some');
    expect(opEnum).toContain('every');
  });

  it('execute 函数可正常调用并返回断言结果', () => {
    const svc = makeMockService({ isReady: true });
    const map = makeMap([svc]);
    const tool = createAssertStateTool(map);

    const result = tool.execute({
      instanceId: 'MockService#0',
      assertions: [{ path: 'isReady', op: 'eq', expected: true }],
    }) as ReturnType<typeof assertState>;

    expect(result.passed).toBe(true);
  });

  it('execute 接收 assertions 为 undefined 时降级为空数组', () => {
    const svc = makeMockService({ status: 'active' });
    const map = makeMap([svc]);
    const tool = createAssertStateTool(map);

    const result = tool.execute({
      instanceId: 'MockService#0',
      assertions: undefined,
    }) as ReturnType<typeof assertState>;

    expect(result.passed).toBe(true);
    expect(result.summary.total).toBe(0);
  });

  it('execute 支持传入 description 字段', () => {
    const svc = makeMockService({ count: 5 });
    const map = makeMap([svc]);
    const tool = createAssertStateTool(map);

    // description 字段不影响断言执行，只是元数据
    const result = tool.execute({
      instanceId: 'MockService#0',
      assertions: [{ path: 'count', op: 'gt', expected: 0 }],
      description: '验证 count 大于 0',
    }) as ReturnType<typeof assertState>;

    expect(result.passed).toBe(true);
  });

  it('instanceId 不存在时 execute 返回失败结果', () => {
    const map = new Map<string, Service>();
    const tool = createAssertStateTool(map);

    const result = tool.execute({
      instanceId: 'NotExists#0',
      assertions: [{ path: 'status', op: 'exists' }],
    }) as ReturnType<typeof assertState>;

    expect(result.passed).toBe(false);
    expect(result.results[0]?.error).toMatch(/Service instance not found/);
  });
});
