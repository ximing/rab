/**
 * tools/get-state.ts 单元测试
 */

import { createGetStateTool, getState } from '../../tools/get-state';
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

// ─── getState ───────────────────────────────────────────────────────────────

describe('getState', () => {
  it('instanceId 不存在时返回空 state 和 model', () => {
    const map = new Map<string, Service>();

    const result = getState(map, { instanceId: 'NotExists#0' });

    expect(result.state).toEqual({});
    expect(result.model).toEqual({});
  });

  it('返回完整状态快照（不指定 keys）', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = getState(map, { instanceId: 'TestService#0' });

    // 降级后：数组字段只返回类型摘要，不返回原始数组（规避大对象序列化 crash）
    expect(result.state['items']).toBe('[Array(3)]');
    expect(result.state['total']).toBe(100);
    expect(result.state['title']).toBe('测试服务');
  });

  it('指定 keys 时只返回指定字段', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = getState(map, { instanceId: 'TestService#0', keys: ['total'] });

    expect(Object.keys(result.state)).toEqual(['total']);
    expect(result.state['total']).toBe(100);
  });

  it('过滤私有属性和函数', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = getState(map, { instanceId: 'TestService#0' });

    expect(result.state).not.toHaveProperty('_private');
    expect(result.state).not.toHaveProperty('doSomething');
  });

  it('正确返回 $model 状态', () => {
    const svc = makeMockService({
      $model: {
        fetchData: { loading: true, error: null },
        saveData: { loading: false, error: new Error('保存失败') },
      },
    });
    const map = makeMap([svc]);

    const result = getState(map, { instanceId: 'TestService#0' });

    expect(result.model['fetchData']).toEqual({ loading: true, error: null });
    expect(result.model['saveData']).toEqual({ loading: false, error: '保存失败' });
  });

  it('$model 不存在时 model 为空对象', () => {
    const svc = { instanceId: 'TestService#0', name: 'test' } as unknown as Service;
    const map = makeMap([svc]);

    const result = getState(map, { instanceId: 'TestService#0' });

    expect(result.model).toEqual({});
  });

  it('state 中不含 instanceId', () => {
    const svc = makeMockService();
    const map = makeMap([svc]);

    const result = getState(map, { instanceId: 'TestService#0' });

    expect(result.state).not.toHaveProperty('instanceId');
  });
});

// ─── createGetStateTool ──────────────────────────────────────────────────────

describe('createGetStateTool', () => {
  it('返回正确的 Tool 定义结构', () => {
    const map = new Map<string, Service>();
    const tool = createGetStateTool(map);

    expect(tool.name).toBe('get_state');
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('inputSchema 包含 instanceId 为必填，keys 为可选', () => {
    const map = new Map<string, Service>();
    const tool = createGetStateTool(map);

    const schema = tool.inputSchema as Record<string, unknown>;
    const required = schema['required'] as string[];
    const props = schema['properties'] as Record<string, unknown>;

    expect(props).toHaveProperty('instanceId');
    expect(props).toHaveProperty('keys');
    expect(required).toContain('instanceId');
    expect(required).not.toContain('keys'); // keys 是可选的
  });

  it('execute 函数调用成功', () => {
    const svc = makeMockService({ total: 42 });
    const map = makeMap([svc]);
    const tool = createGetStateTool(map);

    const result = tool.execute({ instanceId: 'TestService#0' }) as ReturnType<typeof getState>;

    expect(result.state['total']).toBe(42);
  });

  it('execute 传递 keys 参数', () => {
    const svc = makeMockService({ total: 42, title: '测试' });
    const map = makeMap([svc]);
    const tool = createGetStateTool(map);

    const result = tool.execute({
      instanceId: 'TestService#0',
      keys: ['title'],
    }) as ReturnType<typeof getState>;

    expect(Object.keys(result.state)).toEqual(['title']);
    expect(result.state['title']).toBe('测试');
  });
});
