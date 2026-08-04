/**
 * tools/set-state.ts 单元测试
 */

import { createSetStateTool, setState } from '../../tools/set-state';
import type { Service } from '@rabjs/service';

/** 创建 mock Service 实例 */
function makeMockService(overrides: Record<string, unknown> = {}): Service {
  return {
    instanceId: 'TestService#0',
    items: ['a', 'b', 'c'],
    total: 100,
    title: '测试服务',
    _private: '私有',
    $model: {},
    doSomething: () => 'result',
    ...overrides,
  } as unknown as Service;
}

function makeMap(services: Service[]): Map<string, Service> {
  const map = new Map<string, Service>();
  for (const svc of services) {
    map.set(svc.instanceId!, svc);
  }
  return map;
}

// ─── setState ────────────────────────────────────────────────────────────────

describe('setState', () => {
  it('instanceId 不存在时，所有 patch key 都被 rejected', () => {
    const map = new Map<string, Service>();

    const result = setState(map, {
      instanceId: 'NotExists#0',
      patch: { total: 999 },
    });

    expect(result.success).toBe(false);
    expect(result.updated).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.key).toBe('total');
    expect(result.rejected[0]!.reason).toContain('NotExists#0');
  });

  it('成功修改合法的状态属性', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { total: 999 },
    });

    expect(result.success).toBe(true);
    expect(result.updated).toContain('total');
    expect(result.rejected).toHaveLength(0);
    // 验证实例属性被实际修改
    expect((svc as any).total).toBe(999);
  });

  it('同时修改多个合法属性', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { total: 500, title: '新标题' },
    });

    expect(result.success).toBe(true);
    expect(result.updated).toContain('total');
    expect(result.updated).toContain('title');
    expect((svc as any).total).toBe(500);
    expect((svc as any).title).toBe('新标题');
  });

  it('不允许修改 instanceId', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { instanceId: 'Hacked#0' },
    });

    expect(result.success).toBe(false);
    expect(result.updated).toHaveLength(0);
    expect(result.rejected[0]!.key).toBe('instanceId');
    expect(result.rejected[0]!.reason).toContain('read-only');
    // 确保 instanceId 未被修改
    expect((svc as any).instanceId).toBe('TestService#0');
  });

  it('不允许修改私有属性（_ 开头）', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { _private: 'hacked' },
    });

    expect(result.success).toBe(false);
    expect(result.rejected[0]!.key).toBe('_private');
    expect(result.rejected[0]!.reason).toContain('private');
  });

  it('不允许修改方法属性', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { doSomething: () => 'evil' },
    });

    expect(result.success).toBe(false);
    expect(result.rejected[0]!.key).toBe('doSomething');
    expect(result.rejected[0]!.reason).toContain('method');
  });

  it('不允许修改不存在的属性', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { nonExistent: 'value' },
    });

    expect(result.success).toBe(false);
    expect(result.rejected[0]!.key).toBe('nonExistent');
    expect(result.rejected[0]!.reason).toContain('does not exist');
  });

  it('部分成功：有效属性被修改，无效属性被拒绝', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: {
        total: 200,       // 合法
        _private: 'bad',  // 非法（私有属性）
      },
    });

    expect(result.success).toBe(false); // 有 rejected 则 success=false
    expect(result.updated).toContain('total');
    expect(result.rejected.map(r => r.key)).toContain('_private');
    expect((svc as any).total).toBe(200);
  });

  it('修改数组类型的属性', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const newItems = ['x', 'y'];
    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { items: newItems },
    });

    expect(result.success).toBe(true);
    expect((svc as any).items).toEqual(['x', 'y']);
  });

  it('patch 为空对象时返回 success=true 且无变化', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: {},
    });

    expect(result.success).toBe(true);
    expect(result.updated).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  it('属性赋值时抛出异常（如 setter 报错），key 进入 rejected', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    // 用 defineProperty 让 total 的 setter 抛出异常
    Object.defineProperty(svc, 'total', {
      get: () => 100,
      set: () => { throw new TypeError('不允许修改'); },
      configurable: true,
      enumerable: true,
    });

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { total: 999 },
    });

    expect(result.success).toBe(false);
    expect(result.updated).not.toContain('total');
    const rejected = result.rejected.find(r => r.key === 'total');
    expect(rejected).toBeDefined();
    expect(rejected!.reason).toContain('Failed to set "total"');
    expect(rejected!.reason).toContain('不允许修改');
  });

  it('setter 抛出非 Error 类型异常时，reason 包含字符串化信息', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    Object.defineProperty(svc, 'title', {
      get: () => '原始标题',
      set: () => { throw 'forbidden string error'; }, // 非 Error 对象
      configurable: true,
      enumerable: true,
    });

    const result = setState(map, {
      instanceId: 'TestService#0',
      patch: { title: '新标题' },
    });

    expect(result.success).toBe(false);
    const rejected = result.rejected.find(r => r.key === 'title');
    expect(rejected).toBeDefined();
    expect(rejected!.reason).toContain('forbidden string error');
  });
});

// ─── createSetStateTool ──────────────────────────────────────────────────────

describe('createSetStateTool', () => {
  it('返回正确的 Tool 定义结构', () => {
    const map = new Map<string, Service>();
    const tool = createSetStateTool(map);

    expect(tool.name).toBe('set_state');
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('inputSchema 包含 instanceId 和 patch 为必填', () => {
    const map = new Map<string, Service>();
    const tool = createSetStateTool(map);

    const schema = tool.inputSchema as Record<string, unknown>;
    const required = schema['required'] as string[];
    const props = schema['properties'] as Record<string, unknown>;

    expect(props).toHaveProperty('instanceId');
    expect(props).toHaveProperty('patch');
    expect(required).toContain('instanceId');
    expect(required).toContain('patch');
  });

  it('execute 函数成功调用', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);
    const tool = createSetStateTool(map);

    const result = tool.execute({
      instanceId: 'TestService#0',
      patch: { total: 777 },
    }) as ReturnType<typeof setState>;

    expect(result.success).toBe(true);
    expect(result.updated).toContain('total');
    expect((svc as any).total).toBe(777);
  });

  it('execute patch 未传时默认空对象不报错', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);
    const tool = createSetStateTool(map);

    const result = tool.execute({
      instanceId: 'TestService#0',
      patch: undefined,
    }) as ReturnType<typeof setState>;

    expect(result.success).toBe(true);
    expect(result.updated).toHaveLength(0);
  });
});
