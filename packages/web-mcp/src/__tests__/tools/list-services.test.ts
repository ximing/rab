/**
 * tools/list-services.ts 单元测试
 */

import { createListServicesTool, executeListServices } from '../../tools/list-services';
import { mcpTool } from '../../decorator';
import type { Container, Service } from '@rabjs/service';
import type { ServiceDefinition } from '@rabjs/service/src/ioc/types';

/**
 * 创建 mock Container
 */
function mockContainer(
  name: string,
  definitions: Partial<ServiceDefinition>[],
  children: ReturnType<typeof mockContainer>[] = []
): Container {
  return {
    getName: () => name,
    getServiceDefinitions: () => definitions as ServiceDefinition[],
    getChildren: () => children as Container[],
  } as unknown as Container;
}

/**
 * 创建最简 mock Service 实例
 */
function makeMockInstance(
  instanceId: string,
  methods: Record<string, () => unknown> = {},
  extraProps: Record<string, unknown> = {}
): Service {
  const svc = Object.create(Object.prototype) as Record<string, unknown>;
  svc['instanceId'] = instanceId;
  Object.assign(svc, extraProps);

  // 方法必须挂在原型链上才能被 list-services 扫描到
  const proto = Object.create(Object.prototype);
  for (const [name, fn] of Object.entries(methods)) {
    proto[name] = fn;
  }
  Object.setPrototypeOf(svc, proto);

  return svc as unknown as Service;
}

// ─── executeListServices ────────────────────────────────────────────────────

describe('executeListServices', () => {
  it('没有已实例化的 Service 时返回空列表', () => {
    const container = mockContainer('root', [
      {
        identifier: 'SomeService',
        factory: class {} as any,
        scope: 'singleton' as any,
        instance: undefined,
      },
    ]);

    const result = executeListServices(container);
    expect(result.services).toEqual([]);
  });

  it('没有 instanceId 的实例被跳过', () => {
    const instance = {/* 无 instanceId */} as unknown as Service;
    const container = mockContainer('root', [
      { identifier: 'SomeService', factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const result = executeListServices(container);
    expect(result.services).toEqual([]);
  });

  it('返回已实例化 Service 的描述', () => {
    const instance = makeMockInstance('CartService#0', {
      addItem: () => {},
      clearCart: () => {},
    });

    const container = mockContainer('app', [
      { identifier: 'CartService', factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const result = executeListServices(container);
    expect(result.services).toHaveLength(1);

    const svcDesc = result.services[0]!;
    expect(svcDesc.instanceId).toBe('CartService#0');
    expect(svcDesc.containerName).toBe('app');
    expect(svcDesc.scope).toBe('singleton');
  });

  it('actions 列表包含原型方法（过滤基类内置方法）', () => {
    const instance = makeMockInstance('CartService#0', {
      addItem: () => {},
      clearCart: () => {},
    });

    const container = mockContainer('app', [
      { identifier: 'CartService', factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const result = executeListServices(container);
    const actions = result.services[0]!.actions;
    const actionNames = actions.map(a => a.name);

    expect(actionNames).toContain('addItem');
    expect(actionNames).toContain('clearCart');
    // 基类内置方法应被过滤
    expect(actionNames).not.toContain('on');
    expect(actionNames).not.toContain('off');
    expect(actionNames).not.toContain('emit');
    expect(actionNames).not.toContain('resolve');
    expect(actionNames).not.toContain('destroy');
  });

  it('hasMcpTool 正确标注有 @mcpTool 注解的方法', () => {
    // 构造带 @mcpTool 注解的 Service 类
    class OrderService {
      @mcpTool({ description: '获取订单', name: 'getOrders' })
      getOrders() {
        return [];
      }

      normalMethod() {
        return null;
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

    const result = executeListServices(container);
    const actions = result.services[0]!.actions;

    const getOrdersAction = actions.find(a => a.name === 'getOrders');
    const normalAction = actions.find(a => a.name === 'normalMethod');

    expect(getOrdersAction?.hasMcpTool).toBe(true);
    expect(getOrdersAction?.description).toBe('获取订单');
    expect(normalAction?.hasMcpTool).toBe(false);
  });

  it('identifier 为 Constructor 时 identifierType 为 "constructor"', () => {
    class CartService {}
    const instance = makeMockInstance('CartService#0');

    const container = mockContainer('app', [
      { identifier: CartService, factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const result = executeListServices(container);
    expect(result.services[0]?.identifierType).toBe('constructor');
    expect(result.services[0]?.identifierLabel).toBe('CartService');
  });

  it('identifier 为字符串时 identifierType 为 "string"', () => {
    const instance = makeMockInstance('cart#0');

    const container = mockContainer('app', [
      { identifier: 'cartService', factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const result = executeListServices(container);
    expect(result.services[0]?.identifierType).toBe('string');
    expect(result.services[0]?.identifierLabel).toBe('cartService');
  });

  it('identifier 为 Symbol 时 identifierType 为 "symbol"', () => {
    const sym = Symbol('cartService');
    const instance = makeMockInstance('cart#0');

    const container = mockContainer('app', [
      { identifier: sym, factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const result = executeListServices(container);
    expect(result.services[0]?.identifierType).toBe('symbol');
    expect(result.services[0]?.identifierLabel).toBe('Symbol(cartService)');
  });

  it('递归遍历子容器', () => {
    const parentInstance = makeMockInstance('ParentService#0', { doParent: () => {} });
    const childInstance = makeMockInstance('ChildService#0', { doChild: () => {} });

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

    const result = executeListServices(rootContainer);

    expect(result.services).toHaveLength(2);
    const instanceIds = result.services.map(s => s.instanceId);
    expect(instanceIds).toContain('ParentService#0');
    expect(instanceIds).toContain('ChildService#0');
  });

  it('方法名以 _ 开头时被过滤，不出现在 actions 列表中', () => {
    const instance = makeMockInstance('SvcA#0', {
      publicMethod: () => 'ok',
      _internalHelper: () => 'hidden',
    });

    const container = mockContainer('app', [
      { identifier: 'SvcA', factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const result = executeListServices(container);
    const actionNames = result.services[0]!.actions.map(a => a.name);

    expect(actionNames).toContain('publicMethod');
    expect(actionNames).not.toContain('_internalHelper');
  });

  it('scalarState 包含基本类型字段，objectState 包含复杂类型字段，均不含函数和私有属性', () => {
    const instance = makeMockInstance(
      'DataService#0',
      {
        fetchData: () => {},
      },
      {
        count: 0,
        name: 'test',
        _private: 'hidden',
        items: ['a', 'b'],
        meta: { key: 'value' },
      }
    );

    const container = mockContainer('app', [
      { identifier: 'DataService', factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const result = executeListServices(container);
    const svcDesc = result.services[0]!;

    // 标量字段进入 scalarState
    expect(svcDesc.scalarState).toHaveProperty('count');
    expect(svcDesc.scalarState['count']).toBe('number');
    expect(svcDesc.scalarState).toHaveProperty('name');
    expect(svcDesc.scalarState['name']).toBe('string');

    // 复杂类型进入 objectState
    expect(svcDesc.objectState).toContain('items');
    expect(svcDesc.objectState).toContain('meta');

    // 函数和私有属性不出现在任何分类中
    expect(svcDesc.scalarState).not.toHaveProperty('_private');
    expect(svcDesc.scalarState).not.toHaveProperty('fetchData');
    expect(svcDesc.objectState).not.toContain('_private');
    expect(svcDesc.objectState).not.toContain('fetchData');
  });
});

// ─── createListServicesTool ──────────────────────────────────────────────────

describe('createListServicesTool', () => {
  it('返回正确的 Tool 定义结构', () => {
    const container = mockContainer('root', []);
    const tool = createListServicesTool(container);

    expect(tool.name).toBe('list_services');
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('execute 函数调用返回服务列表', () => {
    const instance = makeMockInstance('TestService#0');
    const container = mockContainer('app', [
      { identifier: 'TestService', factory: class {} as any, scope: 'singleton' as any, instance },
    ]);

    const tool = createListServicesTool(container);
    const result = tool.execute({}) as ReturnType<typeof executeListServices>;

    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.instanceId).toBe('TestService#0');
  });
});
