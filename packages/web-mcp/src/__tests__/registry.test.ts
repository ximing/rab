/**
 * registry.ts 单元测试
 */

import { McpRegistry, createGenericTools } from '../registry';
import { mcpTool } from '../decorator';
import type { Container, Service } from '@rabjs/service';
import type { ServiceDefinition } from '@rabjs/service/src/ioc/types';

// ─── Mock 依赖 ─────────────────────────────────────────────────────────────

/** mock getGlobalContainer */
const mockGetGlobalContainer = jest.fn();

jest.mock('@rabjs/service', () => ({
  getGlobalContainer: (...args: unknown[]) => mockGetGlobalContainer(...args),
}));

/** 创建 mock modelContext */
function createMockModelContext() {
  const registeredTools: Array<{ name: string; unregister: jest.Mock }> = [];
  const mockModelContext = {
    registerTool: jest.fn((tool: { name: string }) => {
      const handle = { unregister: jest.fn() };
      registeredTools.push({ name: tool.name, unregister: handle.unregister });
      return handle;
    }),
    _registeredTools: registeredTools,
  };
  return mockModelContext;
}

/** 创建 mock EventEmitter */
function mockEvents() {
  return {
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    emit: jest.fn(),
  };
}

/** 创建 mock Container */
function mockContainer(
  name: string,
  definitions: Partial<ServiceDefinition>[] = [],
  children: ReturnType<typeof mockContainer>[] = []
): Container {
  return {
    getName: () => name,
    getServiceDefinitions: () => definitions as ServiceDefinition[],
    getChildren: () => children as Container[],
    events: mockEvents(),
  } as unknown as Container;
}

/** 创建 mock Service 实例 */
function makeMockInstance(instanceId: string, extra: Record<string, unknown> = {}): Service {
  return { instanceId, ...extra } as unknown as Service;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('McpRegistry', () => {
  let mockModelCtx: ReturnType<typeof createMockModelContext>;
  let registry: McpRegistry;

  beforeEach(() => {
    // 重置单例（通过私有属性 hack）
    (McpRegistry as any).instance = undefined;

    mockModelCtx = createMockModelContext();
    Object.defineProperty(navigator, 'modelContext', {
      value: mockModelCtx,
      writable: true,
      configurable: true,
    });

    jest.mock('@mcp-b/global', () => ({}), { virtual: true });

    // 在 getInstance() 之前先设置默认返回值，因为构造函数会立即调用 getGlobalContainer()
    // 以便订阅 Container 事件。如果不设置，返回 undefined 会导致访问 undefined.events 报错
    const defaultContainer = mockContainer('global-root');
    mockGetGlobalContainer.mockReturnValue(defaultContainer);

    registry = McpRegistry.getInstance();
  });

  afterEach(() => {
    // 卸载以防止测试间污染
    if (registry.isMounted()) {
      registry.unmount();
    }

    Object.defineProperty(navigator, 'modelContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  // ─── getInstance ────────────────────────────────────────────────────────

  describe('getInstance()', () => {
    it('返回单例', () => {
      const a = McpRegistry.getInstance();
      const b = McpRegistry.getInstance();
      expect(a).toBe(b);
    });
  });

  // ─── isMounted ─────────────────────────────────────────────────────────

  describe('isMounted()', () => {
    it('初始状态为 false', () => {
      expect(registry.isMounted()).toBe(false);
    });

    it('mount 后为 true', async () => {
      const container = mockContainer('root');
      mockGetGlobalContainer.mockReturnValue(container);

      await registry.mount();
      expect(registry.isMounted()).toBe(true);
    });

    it('unmount 后为 false', async () => {
      const container = mockContainer('root');
      mockGetGlobalContainer.mockReturnValue(container);

      await registry.mount();
      registry.unmount();
      expect(registry.isMounted()).toBe(false);
    });
  });

  // ─── mount ─────────────────────────────────────────────────────────────

  describe('mount()', () => {
    it('注册四个通用工具（含 set_state）', async () => {
      const container = mockContainer('root');
      mockGetGlobalContainer.mockReturnValue(container);

      await registry.mount();

      const toolNames = mockModelCtx._registeredTools.map(t => t.name);
      expect(toolNames).toContain('list_services');
      expect(toolNames).toContain('execute_action');
      expect(toolNames).toContain('get_state');
      expect(toolNames).toContain('set_state');
    });

    it('重复 mount 打印警告并跳过', async () => {
      const container = mockContainer('root');
      mockGetGlobalContainer.mockReturnValue(container);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await registry.mount();
      const countBefore = mockModelCtx.registerTool.mock.calls.length;

      await registry.mount();
      const countAfter = mockModelCtx.registerTool.mock.calls.length;

      expect(countBefore).toBe(countAfter);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already mounted'));
      warnSpy.mockRestore();
    });

    it('navigator.modelContext 不可用时打印警告', async () => {
      Object.defineProperty(navigator, 'modelContext', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const container = mockContainer('root');
      mockGetGlobalContainer.mockReturnValue(container);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await registry.mount();

      expect(registry.isMounted()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('navigator.modelContext is not available')
      );
      warnSpy.mockRestore();
    });

    it('扫描 @mcpTool 注解并注册独立 Tool', async () => {
      class ProductService {
        @mcpTool({ description: '搜索商品' })
        searchProducts(_keyword: string) {
          return [];
        }
      }

      const instance = Object.create(ProductService.prototype) as Service;
      (instance as any)['instanceId'] = 'ProductService#0';

      const container = mockContainer('root', [
        {
          identifier: ProductService,
          factory: ProductService as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      mockGetGlobalContainer.mockReturnValue(container);
      await registry.mount();

      const toolNames = mockModelCtx._registeredTools.map(t => t.name);
      expect(toolNames.some(name => name.includes('searchProducts'))).toBe(true);
    });

    it('注册工具失败时打印错误日志', async () => {
      const container = mockContainer('root');
      mockGetGlobalContainer.mockReturnValue(container);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockModelCtx.registerTool.mockImplementationOnce(() => {
        throw new Error('注册失败');
      });

      // 不应该抛出
      await expect(registry.mount()).resolves.not.toThrow();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('execute_action 工具的 execute 函数通过 getLiveInstanceMap 路由调用', async () => {
      const instance = makeMockInstance('TestService#0', {
        doTask: () => 'task-done',
      });

      const container = mockContainer('root', [
        {
          identifier: 'TestService',
          factory: class {} as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      mockGetGlobalContainer.mockReturnValue(container);
      await registry.mount();

      // 找到 execute_action tool 并调用其 execute
      const executeActionTool = mockModelCtx.registerTool.mock.calls
        .map((call: [{ name: string; execute: (input: unknown) => unknown }]) => call[0])
        .find((tool: { name: string }) => tool.name === 'execute_action');

      expect(executeActionTool).toBeDefined();

      const mcpResult = (await executeActionTool!.execute({
        instanceId: 'TestService#0',
        action: 'doTask',
        args: [],
      })) as { content: Array<{ type: string; text: string }> };

      // registerTool 会包装返回值为 MCP 标准格式
      const result = JSON.parse(mcpResult.content[0]!.text) as { result: unknown };
      expect(result.result).toBe('task-done');
    });

    it('get_state 工具的 execute 函数通过 getLiveInstanceMap 路由查询', async () => {
      const instance = makeMockInstance('DataService#0', { count: 99 });

      const container = mockContainer('root', [
        {
          identifier: 'DataService',
          factory: class {} as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      mockGetGlobalContainer.mockReturnValue(container);
      await registry.mount();

      // 找到 get_state tool 并调用其 execute
      const getStateTool = mockModelCtx.registerTool.mock.calls
        .map((call: [{ name: string; execute: (input: unknown) => unknown }]) => call[0])
        .find((tool: { name: string }) => tool.name === 'get_state');

      expect(getStateTool).toBeDefined();

      const mcpResult = (await getStateTool!.execute({ instanceId: 'DataService#0' })) as {
        content: Array<{ type: string; text: string }>;
      };
      // registerTool 会包装返回值为 MCP 标准格式
      const result = JSON.parse(mcpResult.content[0]!.text) as { state: Record<string, unknown> };
      expect(result.state['count']).toBe(99);
    });

    it('@mcpTool 独立 Tool 的 execute 函数可以执行方法', async () => {
      class SumService {
        @mcpTool({ description: '求和' })
        sum(a: number, b: number) {
          return a + b;
        }
      }

      const instance = Object.create(SumService.prototype) as Service;
      (instance as any)['instanceId'] = 'SumService#0';

      const container = mockContainer('root', [
        {
          identifier: SumService,
          factory: SumService as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      mockGetGlobalContainer.mockReturnValue(container);
      await registry.mount();

      const sumTool = mockModelCtx.registerTool.mock.calls
        .map((call: [{ name: string; execute: (input: unknown) => unknown }]) => call[0])
        .find((tool: { name: string }) => tool.name.includes('sum'));

      expect(sumTool).toBeDefined();

      const mcpResult = (await sumTool!.execute({
        instanceId: 'SumService#0',
        args: [3, 4],
      })) as { content: Array<{ type: string; text: string }> };

      // registerTool 会包装返回值为 MCP 标准格式
      const result = JSON.parse(mcpResult.content[0]!.text) as { result: unknown };
      expect(result.result).toBe(7);
    });

    it('set_state 工具的 execute 函数通过 getLiveInstanceMap 路由修改状态', async () => {
      const instance = makeMockInstance('StoreService#0', { score: 0 });

      const container = mockContainer('root', [
        {
          identifier: 'StoreService',
          factory: class {} as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      mockGetGlobalContainer.mockReturnValue(container);
      await registry.mount();

      const setStateTool = mockModelCtx.registerTool.mock.calls
        .map((call: [{ name: string; execute: (input: unknown) => unknown }]) => call[0])
        .find((tool: { name: string }) => tool.name === 'set_state');

      expect(setStateTool).toBeDefined();

      const mcpResult = (await setStateTool!.execute({
        instanceId: 'StoreService#0',
        patch: { score: 99 },
      })) as { content: Array<{ type: string; text: string }> };

      // registerTool 会包装返回值为 MCP 标准格式
      const result = JSON.parse(mcpResult.content[0]!.text) as {
        success: boolean;
        updated: string[];
      };
      expect(result.success).toBe(true);
      expect(result.updated).toContain('score');
      expect((instance as any).score).toBe(99);
    });

    it('registerMcpToolsFromContainer 递归遍历子容器中的 @mcpTool', async () => {
      class ChildService {
        @mcpTool({ description: '子容器方法' })
        childAction() {
          return 'child';
        }
      }

      const instance = Object.create(ChildService.prototype) as Service;
      (instance as any)['instanceId'] = 'ChildService#0';

      const childContainer = mockContainer('child', [
        {
          identifier: ChildService,
          factory: ChildService as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);
      const rootContainer = mockContainer('root', [], [childContainer]);

      mockGetGlobalContainer.mockReturnValue(rootContainer);
      await registry.mount();

      const toolNames = mockModelCtx._registeredTools.map(t => t.name);
      expect(toolNames.some(name => name.includes('childAction'))).toBe(true);
    });
  });

  // ─── unmount ───────────────────────────────────────────────────────────

  describe('unmount()', () => {
    it('调用所有已注册工具的 unregister', async () => {
      const container = mockContainer('root');
      mockGetGlobalContainer.mockReturnValue(container);

      await registry.mount();

      const handles = mockModelCtx._registeredTools.map(t => t.unregister);
      expect(handles.length).toBeGreaterThan(0);

      registry.unmount();

      for (const unregister of handles) {
        expect(unregister).toHaveBeenCalled();
      }
    });

    it('unmount 后可再次 mount', async () => {
      const container = mockContainer('root');
      mockGetGlobalContainer.mockReturnValue(container);

      await registry.mount();
      registry.unmount();
      await registry.mount();

      expect(registry.isMounted()).toBe(true);
    });
  });

  // ─── buildInstanceMap ──────────────────────────────────────────────────

  describe('buildInstanceMap()', () => {
    it('从全局容器树收集已实例化 Service', () => {
      const instance1 = makeMockInstance('ServiceA#0');
      const instance2 = makeMockInstance('ServiceB#0');

      const childContainer = mockContainer('child', [
        {
          identifier: 'ServiceB',
          factory: class {} as any,
          scope: 'singleton' as any,
          instance: instance2,
        },
      ]);

      const rootContainer = mockContainer(
        'root',
        [
          {
            identifier: 'ServiceA',
            factory: class {} as any,
            scope: 'singleton' as any,
            instance: instance1,
          },
        ],
        [childContainer]
      );

      mockGetGlobalContainer.mockReturnValue(rootContainer);

      const map = registry.buildInstanceMap();

      expect(map.size).toBe(2);
      expect(map.get('ServiceA#0')).toBe(instance1);
      expect(map.get('ServiceB#0')).toBe(instance2);
    });

    it('没有 instanceId 的实例不加入 map', () => {
      const instance = {/* 无 instanceId */} as unknown as Service;
      const container = mockContainer('root', [
        {
          identifier: 'SomeService',
          factory: class {} as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      mockGetGlobalContainer.mockReturnValue(container);

      const map = registry.buildInstanceMap();
      expect(map.size).toBe(0);
    });
  });
});

// ─── createGenericTools ─────────────────────────────────────────────────────

describe('createGenericTools', () => {
  it('返回五个 Tool 定义（含 assert_state）', () => {
    const container = mockContainer('root');
    const tools = createGenericTools(container);

    expect(tools).toHaveLength(5);
    const names = tools.map(t => t.name);
    expect(names).toContain('list_services');
    expect(names).toContain('execute_action');
    expect(names).toContain('get_state');
    expect(names).toContain('set_state');
    expect(names).toContain('assert_state');
  });

  it('每个 Tool 都有 execute 函数', () => {
    const container = mockContainer('root');
    const tools = createGenericTools(container);

    for (const tool of tools) {
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('内部 walkContainer 递归遍历子容器：execute_action 可路由子容器 Service', async () => {
    const childInstance = {
      instanceId: 'ChildSvc#0',
      ping: () => 'pong',
    } as unknown as Service;
    const childContainer = mockContainer('child', [
      {
        identifier: 'ChildSvc',
        factory: class {} as any,
        scope: 'singleton' as any,
        instance: childInstance,
      },
    ]);
    const rootContainer = mockContainer('root', [], [childContainer]);

    const tools = createGenericTools(rootContainer);
    const executeActionTool = tools.find(t => t.name === 'execute_action');
    expect(executeActionTool).toBeDefined();

    const result = (await executeActionTool!.execute({
      instanceId: 'ChildSvc#0',
      action: 'ping',
      args: [],
    })) as { result: unknown };

    expect(result.result).toBe('pong');
  });

  it('内部 walkContainer 递归遍历子容器：set_state 可路由子容器 Service', () => {
    const childInstance = makeMockInstance('ChildSvc#0', { level: 1 });
    const childContainer = mockContainer('child', [
      {
        identifier: 'ChildSvc',
        factory: class {} as any,
        scope: 'singleton' as any,
        instance: childInstance,
      },
    ]);
    const rootContainer = mockContainer('root', [], [childContainer]);

    const tools = createGenericTools(rootContainer);
    const setStateTool = tools.find(t => t.name === 'set_state');
    expect(setStateTool).toBeDefined();

    const result = setStateTool!.execute({
      instanceId: 'ChildSvc#0',
      patch: { level: 5 },
    }) as { success: boolean };

    expect(result.success).toBe(true);
    expect((childInstance as any).level).toBe(5);
  });
});
