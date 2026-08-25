import { getGlobalContainer, Service } from '@rabjs/service';

import { createRabHandlers } from '../rab-handlers';

class CartService extends Service {
  items: Array<{ id: string; price: number }> = [];
  total = 0;
  async addItem(item: { id: string; price: number }) {
    this.items.push(item);
    this.total = this.items.reduce((s, i) => s + i.price, 0);
    return this.items.length;
  }
}

function setupService() {
  const container = getGlobalContainer();
  // register 对同一标识符是覆盖语义，resolve 重新实例化，保证每个用例拿到干净状态
  container.register(CartService);
  return container.resolve(CartService);
}

async function call(type: string, payload: unknown) {
  const handlers = createRabHandlers();
  return handlers[type](payload);
}

describe('rab handlers', () => {
  it('rab.listServices 枚举容器内 Service', async () => {
    setupService();
    const list = (await call('rab.listServices', {})) as Array<{
      identifierLabel: string;
      instanceId: string;
    }>;
    const cart = list.find(s => s.identifierLabel === 'CartService');
    expect(cart).toBeDefined();
    expect(typeof cart!.instanceId).toBe('string');
  });

  it('rab.getServiceState 按 instanceId 读取状态，paths 过滤', async () => {
    setupService();
    const list = (await call('rab.listServices', {})) as Array<{
      identifierLabel: string;
      instanceId: string;
    }>;
    const cart = list.find(s => s.identifierLabel === 'CartService')!;
    const state = (await call('rab.getServiceState', { instanceId: cart.instanceId })) as Record<
      string,
      unknown
    >;
    expect(state.total).toBe(0);
    const partial = (await call('rab.getServiceState', {
      instanceId: cart.instanceId,
      paths: ['total'],
    })) as Record<string, unknown>;
    expect(partial).toEqual({ total: 0 });
    const withLength = (await call('rab.getServiceState', {
      instanceId: cart.instanceId,
      paths: ['items.length', 'items.0.id'],
    })) as Record<string, unknown>;
    expect(withLength).toEqual({ 'items.length': 0, 'items.0.id': undefined });
  });

  it('rab.getServiceState 找不到时抛错（executor 转为 error result）', async () => {
    setupService();
    await expect(call('rab.getServiceState', { instanceId: 'ghost' })).rejects.toThrow(
      /service not found/
    );
  });

  it('rab.callServiceMethod 调用异步方法并返回值', async () => {
    setupService();
    const list = (await call('rab.listServices', {})) as Array<{
      identifierLabel: string;
      instanceId: string;
    }>;
    const cart = list.find(s => s.identifierLabel === 'CartService')!;
    const count = await call('rab.callServiceMethod', {
      instanceId: cart.instanceId,
      method: 'addItem',
      args: [{ id: 'x1', price: 5 }],
    });
    expect(count).toBe(1);
    const state = (await call('rab.getServiceState', { instanceId: cart.instanceId })) as Record<
      string,
      unknown
    >;
    expect(state.total).toBe(5);
  });

  it('rab.expect 断言执行返回结构化结果', async () => {
    setupService();
    const list = (await call('rab.listServices', {})) as Array<{
      identifierLabel: string;
      instanceId: string;
    }>;
    const cart = list.find(s => s.identifierLabel === 'CartService')!;
    await call('rab.callServiceMethod', {
      instanceId: cart.instanceId,
      method: 'addItem',
      args: [{ id: 'x1', price: 5 }],
    });
    const result = (await call('rab.expect', {
      instanceId: cart.instanceId,
      description: '加购验证',
      assertions: [
        { op: 'eq', path: 'items.length', expected: 1 },
        { op: 'gt', path: 'total', expected: 0 },
        { op: 'exists', path: 'items.0.id' },
      ],
    })) as {
      passed: boolean;
      summary: { passed: number; total: number };
      results: Array<{ path: string; passed: boolean }>;
    };
    expect(result.passed).toBe(true);
    expect(result.summary).toEqual({ passed: 3, total: 3 });
    expect(result.results.map(r => r.path)).toEqual(['items.length', 'total', 'items.0.id']);
  });
});
