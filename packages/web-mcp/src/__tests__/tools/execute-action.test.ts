/**
 * tools/execute-action.ts 单元测试
 */

import { createExecuteActionTool, executeAction } from '../../tools/execute-action';
import type { Service } from '@rabjs/service';

/** 创建 mock Service 实例 */
function makeMockService(methods: Record<string, (...args: unknown[]) => unknown> = {}): Service {
  return {
    instanceId: 'MockService#0',
    ...methods,
  } as unknown as Service;
}

/** 创建 instanceMap */
function makeMap(services: Service[]): Map<string, Service> {
  const map = new Map<string, Service>();
  for (const svc of services) {
    map.set(svc.instanceId!, svc);
  }
  return map;
}

// ─── executeAction ──────────────────────────────────────────────────────────

describe('executeAction', () => {
  it('instanceId 不存在时返回错误信息', async () => {
    const map = new Map<string, Service>();

    const result = await executeAction(map, {
      instanceId: 'NotExists#0',
      action: 'doSomething',
      args: [],
    });

    expect(result.result).toBeNull();
    expect(result.loading).toBe(false);
    expect(result.error).toMatch(/Service instance not found/);
    expect(result.error).toMatch(/NotExists#0/);
  });

  it('方法不存在时返回错误信息', async () => {
    const svc = makeMockService({});
    const map = makeMap([svc]);

    const result = await executeAction(map, {
      instanceId: 'MockService#0',
      action: 'nonExistentMethod',
      args: [],
    });

    expect(result.result).toBeNull();
    expect(result.loading).toBe(false);
    expect(result.error).toMatch(/Method.*not found/);
    expect(result.error).toMatch(/nonExistentMethod/);
  });

  it('执行同步方法成功，返回结果', async () => {
    const svc = makeMockService({
      greet: (name: unknown) => `Hello, ${name}!`,
    });
    const map = makeMap([svc]);

    const result = await executeAction(map, {
      instanceId: 'MockService#0',
      action: 'greet',
      args: ['World'],
    });

    expect(result.result).toBe('Hello, World!');
    expect(result.loading).toBe(false);
    expect(result.error).toBeNull();
  });

  it('执行异步方法成功，等待 Promise resolve', async () => {
    const svc = makeMockService({
      fetchData: async () => ({ id: 1, name: '商品' }),
    });
    const map = makeMap([svc]);

    const result = await executeAction(map, {
      instanceId: 'MockService#0',
      action: 'fetchData',
      args: [],
    });

    expect(result.result).toEqual({ id: 1, name: '商品' });
    expect(result.error).toBeNull();
  });

  it('方法抛出 Error 时，返回 error 信息', async () => {
    const svc = makeMockService({
      failMethod: () => {
        throw new Error('业务逻辑错误');
      },
    });
    const map = makeMap([svc]);

    const result = await executeAction(map, {
      instanceId: 'MockService#0',
      action: 'failMethod',
      args: [],
    });

    expect(result.result).toBeNull();
    expect(result.loading).toBe(false);
    expect(result.error).toBe('业务逻辑错误');
  });

  it('方法抛出非 Error 对象时，转换为字符串', async () => {
    const svc = makeMockService({
      failMethod: () => {
        throw '字符串错误';
      },
    });
    const map = makeMap([svc]);

    const result = await executeAction(map, {
      instanceId: 'MockService#0',
      action: 'failMethod',
      args: [],
    });

    expect(result.error).toBe('字符串错误');
  });

  it('正确传递多个参数', async () => {
    const svc = makeMockService({
      add: (a: unknown, b: unknown) => (a as number) + (b as number),
    });
    const map = makeMap([svc]);

    const result = await executeAction(map, {
      instanceId: 'MockService#0',
      action: 'add',
      args: [3, 7],
    });

    expect(result.result).toBe(10);
  });

  it('读取 $model 中的 loading/error 状态', async () => {
    const svc = makeMockService({
      fetchData: async () => 'data',
    });
    (svc as any).$model = {
      fetchData: { loading: false, error: new Error('模型错误') },
    };
    const map = makeMap([svc]);

    const result = await executeAction(map, {
      instanceId: 'MockService#0',
      action: 'fetchData',
      args: [],
    });

    expect(result.error).toBe('模型错误');
  });

  it('$model 不存在时 loading 默认为 false', async () => {
    const svc = makeMockService({
      doAction: () => 'ok',
    });
    const map = makeMap([svc]);

    const result = await executeAction(map, {
      instanceId: 'MockService#0',
      action: 'doAction',
      args: [],
    });

    expect(result.loading).toBe(false);
  });
});

// ─── createExecuteActionTool ────────────────────────────────────────────────

describe('createExecuteActionTool', () => {
  it('返回正确的 Tool 定义结构', () => {
    const map = new Map<string, Service>();
    const tool = createExecuteActionTool(map);

    expect(tool.name).toBe('execute_action');
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('inputSchema 包含必要字段', () => {
    const map = new Map<string, Service>();
    const tool = createExecuteActionTool(map);

    const schema = tool.inputSchema as Record<string, unknown>;
    const props = schema['properties'] as Record<string, unknown>;
    expect(props).toHaveProperty('instanceId');
    expect(props).toHaveProperty('action');
    expect(props).toHaveProperty('args');
    expect(schema['required']).toContain('instanceId');
    expect(schema['required']).toContain('action');
    expect(schema['required']).toContain('args');
  });

  it('execute 函数可正常调用', async () => {
    const svc = makeMockService({
      sayHello: () => 'Hello!',
    });
    const map = makeMap([svc]);
    const tool = createExecuteActionTool(map);

    const result = (await tool.execute({
      instanceId: 'MockService#0',
      action: 'sayHello',
      args: [],
    })) as { result: unknown };

    expect(result.result).toBe('Hello!');
  });

  it('execute 接收 args 为 undefined 时降级为空数组', async () => {
    const svc = makeMockService({
      noArgs: () => 'no-args-result',
    });
    const map = makeMap([svc]);
    const tool = createExecuteActionTool(map);

    // args 未传 (undefined)
    const result = (await tool.execute({
      instanceId: 'MockService#0',
      action: 'noArgs',
      args: undefined,
    })) as { result: unknown };

    expect(result.result).toBe('no-args-result');
  });
});
