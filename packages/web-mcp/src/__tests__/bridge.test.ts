/**
 * bridge.ts 单元测试
 */

import { McpBridge } from '../bridge';
import { mcpTool } from '../decorator';
import type { Container, Service } from '@rabjs/service';
import type { ServiceDefinition } from '@rabjs/service/src/ioc/types';

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
  } as unknown as Container;
}

/** 创建 mock Service 实例 */
function makeMockInstance(instanceId: string): Service {
  return { instanceId } as unknown as Service;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('McpBridge', () => {
  let mockModelCtx: ReturnType<typeof createMockModelContext>;

  beforeEach(() => {
    mockModelCtx = createMockModelContext();
    // Mock navigator.modelContext
    Object.defineProperty(navigator, 'modelContext', {
      value: mockModelCtx,
      writable: true,
      configurable: true,
    });

    // Mock @mcp-b/global import（避免模块加载失败）
    jest.mock('@mcp-b/global', () => ({}), { virtual: true });
  });

  afterEach(() => {
    // 清理 navigator.modelContext
    Object.defineProperty(navigator, 'modelContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  // ─── isMounted ─────────────────────────────────────────────────────────

  describe('isMounted()', () => {
    it('初始状态为 false', () => {
      const bridge = new McpBridge();
      expect(bridge.isMounted()).toBe(false);
    });

    it('mount 后为 true', async () => {
      const bridge = new McpBridge();
      const container = mockContainer('app');
      await bridge.mount(container);
      expect(bridge.isMounted()).toBe(true);
    });

    it('unmount 后为 false', async () => {
      const bridge = new McpBridge();
      const container = mockContainer('app');
      await bridge.mount(container);
      bridge.unmount();
      expect(bridge.isMounted()).toBe(false);
    });
  });

  // ─── mount ─────────────────────────────────────────────────────────────

  describe('mount()', () => {
    it('注册 list_services、execute_action、get_state、set_state 四个工具', async () => {
      const bridge = new McpBridge();
      const container = mockContainer('app');
      await bridge.mount(container);

      const toolNames = mockModelCtx._registeredTools.map(t => t.name);
      expect(toolNames).toContain('list_services');
      expect(toolNames).toContain('execute_action');
      expect(toolNames).toContain('get_state');
      expect(toolNames).toContain('set_state');
    });

    it('重复 mount 时打印警告并跳过', async () => {
      const bridge = new McpBridge();
      const container = mockContainer('app');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await bridge.mount(container);
      const countAfterFirst = mockModelCtx.registerTool.mock.calls.length;

      await bridge.mount(container);
      const countAfterSecond = mockModelCtx.registerTool.mock.calls.length;

      expect(countAfterFirst).toBe(countAfterSecond); // 没有额外注册
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already mounted'));

      warnSpy.mockRestore();
    });

    it('navigator.modelContext 不可用时打印警告并跳过注册', async () => {
      Object.defineProperty(navigator, 'modelContext', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const bridge = new McpBridge();
      const container = mockContainer('app');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await bridge.mount(container);

      expect(bridge.isMounted()).toBe(false); // 未成功挂载
      expect(mockModelCtx.registerTool).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('navigator.modelContext is not available')
      );

      warnSpy.mockRestore();
    });

    it('扫描容器中有 @mcpTool 注解的方法并注册独立 Tool', async () => {
      class OrderService {
        @mcpTool({ description: '获取订单列表' })
        getOrders() {
          return [];
        }
      }

      const instance = Object.create(OrderService.prototype) as Service;
      (instance as any)['instanceId'] = 'OrderService#0';

      const container = mockContainer('app', [
        {
          identifier: OrderService,
          factory: OrderService as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      const bridge = new McpBridge();
      await bridge.mount(container);

      const toolNames = mockModelCtx._registeredTools.map(t => t.name);
      // 应包含 OrderService__getOrders 独立 Tool
      expect(toolNames.some(name => name.includes('getOrders'))).toBe(true);
    });

    it('有自定义 name 的 @mcpTool 使用自定义名称', async () => {
      class CartService {
        @mcpTool({ description: '获取购物车', name: 'my_cart_tool' })
        getCart() {
          return {};
        }
      }

      const instance = Object.create(CartService.prototype) as Service;
      (instance as any)['instanceId'] = 'CartService#0';

      const container = mockContainer('app', [
        {
          identifier: CartService,
          factory: CartService as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      const bridge = new McpBridge();
      await bridge.mount(container);

      const toolNames = mockModelCtx._registeredTools.map(t => t.name);
      expect(toolNames).toContain('my_cart_tool');
    });
  });

  // ─── unmount ───────────────────────────────────────────────────────────

  describe('unmount()', () => {
    it('unmount 调用所有注销句柄的 unregister', async () => {
      const bridge = new McpBridge();
      const container = mockContainer('app');
      await bridge.mount(container);

      const handles = mockModelCtx._registeredTools.map(t => t.unregister);
      expect(handles.length).toBeGreaterThan(0);

      bridge.unmount();

      for (const unregisterFn of handles) {
        expect(unregisterFn).toHaveBeenCalled();
      }
    });

    it('unmount 后可以重新 mount', async () => {
      const bridge = new McpBridge();
      const container = mockContainer('app');

      await bridge.mount(container);
      bridge.unmount();

      // 重新挂载
      await bridge.mount(container);
      expect(bridge.isMounted()).toBe(true);
    });

    it('注销句柄抛出错误时静默处理', async () => {
      const bridge = new McpBridge();
      const container = mockContainer('app');

      // 让 unregister 抛出错误
      mockModelCtx.registerTool.mockImplementationOnce((tool: { name: string }) => {
        return {
          unregister: () => {
            throw new Error('注销失败');
          },
        };
      });

      await bridge.mount(container);

      // 不应抛出错误
      expect(() => bridge.unmount()).not.toThrow();
    });
  });

  // ─── walkContainer & registerTool extras ──────────────────────────────

  describe('walkContainer & registerIndependentMcpTool', () => {
    it('walkContainer 递归遍历子容器中的 Service', async () => {
      const parentInstance = makeMockInstance('ParentService#0');
      const childInstance = makeMockInstance('ChildService#0');

      const childContainer = mockContainer('child', [
        {
          identifier: 'ChildService',
          factory: class {} as any,
          scope: 'singleton' as any,
          instance: childInstance,
        },
      ]);
      const rootContainer = mockContainer(
        'root',
        [
          {
            identifier: 'ParentService',
            factory: class {} as any,
            scope: 'singleton' as any,
            instance: parentInstance,
          },
        ],
        [childContainer]
      );

      const bridge = new McpBridge();
      await bridge.mount(rootContainer);

      // 找到 get_state tool，验证子容器中的 Service 也能被路由
      const getStateTool = mockModelCtx.registerTool.mock.calls
        .map((call: [{ name: string; execute: (input: unknown) => unknown }]) => call[0])
        .find((tool: { name: string }) => tool.name === 'get_state');

      // 子容器中的 ChildService#0 应当可以被路由
      const result = getStateTool!.execute({ instanceId: 'ChildService#0' }) as {
        state: Record<string, unknown>;
      };
      expect(result).toBeDefined();
    });

    it('registerTool 注册时抛出错误，打印错误日志但不中断', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockModelCtx.registerTool.mockImplementationOnce(() => {
        throw new Error('模拟注册失败');
      });

      const bridge = new McpBridge();
      const container = mockContainer('app');

      // 不应该向外抛出
      await expect(bridge.mount(container)).resolves.not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to register tool'),
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });

    it('独立 @mcpTool 的 execute 函数：args 非数组时转为空数组', async () => {
      class GreetService {
        @mcpTool({ description: '打招呼' })
        greet() {
          return 'hello';
        }
      }

      const instance = Object.create(GreetService.prototype) as Service;
      (instance as any)['instanceId'] = 'GreetService#0';

      const container = mockContainer('app', [
        {
          identifier: GreetService,
          factory: GreetService as any,
          scope: 'singleton' as any,
          instance,
        },
      ]);

      const bridge = new McpBridge();
      await bridge.mount(container);

      const greetTool = mockModelCtx.registerTool.mock.calls
        .map((call: [{ name: string; execute: (input: unknown) => unknown }]) => call[0])
        .find((tool: { name: string }) => tool.name.includes('greet'));

      expect(greetTool).toBeDefined();

      // args 传 null（非数组），应转为空数组不报错
      const mcpResult = (await greetTool!.execute({
        instanceId: 'GreetService#0',
        args: null,
      })) as { content: Array<{ type: string; text: string }> };

      // registerTool 会包装返回值为 MCP 标准格式
      const result = JSON.parse(mcpResult.content[0]!.text) as { result: unknown };
      expect(result.result).toBe('hello');
    });
  });

  // ─── addService ─────────────────────────────────────────────────────────

  describe('addService()', () => {
    it('调用 addService 时打印 warn（未实现提示）', () => {
      const bridge = new McpBridge();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      bridge.addService('TestService', makeMockInstance('TestService#0'));

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('addService'));
      warnSpy.mockRestore();
    });
  });
});
