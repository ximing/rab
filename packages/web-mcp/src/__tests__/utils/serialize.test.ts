/**
 * utils/serialize.ts 单元测试
 */

import { getStateKeys, serializeModel, serializeState } from '../../utils/serialize';
import type { Service } from '@rabjs/service';

/**
 * 创建 mock Service 实例
 * 直接构造 plain object 并设定 instanceId，模拟 Service 的最小接口
 */
function makeMockService(overrides: Record<string, unknown> = {}): Service {
  return {
    instanceId: 'TestService#0',
    name: '测试数据',
    count: 42,
    items: [1, 2, 3],
    _private: '私有数据',
    $model: {},
    someMethod: () => 'result',
    ...overrides,
  } as unknown as Service;
}

// ─── getStateKeys ──────────────────────────────────────────────────────────

describe('getStateKeys', () => {
  it('返回普通数据属性，过滤 instanceId', () => {
    const svc = makeMockService();
    const keys = getStateKeys(svc);

    expect(keys).toContain('name');
    expect(keys).toContain('count');
    expect(keys).toContain('items');
    expect(keys).not.toContain('instanceId'); // 路由字段应过滤
  });

  it('过滤 _ 开头的私有属性', () => {
    const svc = makeMockService({ _secret: 'hidden' });
    const keys = getStateKeys(svc);
    expect(keys).not.toContain('_secret');
    expect(keys).not.toContain('_private');
  });

  it('过滤 $ 开头的属性（除 $model 外）', () => {
    const svc = makeMockService({ $internal: 'hidden', $model: { fetchData: { loading: false, error: null } } });
    const keys = getStateKeys(svc);
    expect(keys).not.toContain('$internal');
    // $model 是特殊属性，不在 state 中暴露，但也不会出现在 getStateKeys 返回值
    // （Object.keys 不会遍历到它，除非显式设置）
  });

  it('过滤函数属性', () => {
    const svc = makeMockService({ doSomething: () => 'result' });
    const keys = getStateKeys(svc);
    expect(keys).not.toContain('doSomething');
    expect(keys).not.toContain('someMethod');
  });

  it('空属性时返回空数组', () => {
    const emptyService = { instanceId: 'Empty#0' } as unknown as Service;
    expect(getStateKeys(emptyService)).toEqual([]);
  });
});

// ─── serializeState ────────────────────────────────────────────────────────

describe('serializeState', () => {
  it('返回所有公开数据属性的快照', () => {
    const svc = makeMockService({ name: '商品', count: 10 });
    const state = serializeState(svc);

    expect(state['name']).toBe('商品');
    expect(state['count']).toBe(10);
    expect(state['items']).toEqual([1, 2, 3]);
  });

  it('指定 keys 时只返回指定字段', () => {
    const svc = makeMockService({ name: '商品', count: 10, extra: 'ignored' });
    const state = serializeState(svc, ['name']);

    expect(Object.keys(state)).toEqual(['name']);
    expect(state['name']).toBe('商品');
  });

  it('过滤函数属性', () => {
    const svc = makeMockService({ fn: () => 'result' });
    const state = serializeState(svc);
    expect(state).not.toHaveProperty('fn');
  });

  it('过滤私有属性', () => {
    const svc = makeMockService({ _secret: 'private', $other: 'private' });
    const state = serializeState(svc);
    expect(state).not.toHaveProperty('_secret');
    expect(state).not.toHaveProperty('$other');
  });

  it('处理循环引用，返回 "[Circular]"', () => {
    const obj: Record<string, unknown> = { value: 1 };
    obj['self'] = obj; // 循环引用

    const svc = makeMockService({ data: obj });
    const state = serializeState(svc);

    const data = state['data'] as Record<string, unknown>;
    expect(data['value']).toBe(1);
    expect(data['self']).toBe('[Circular]');
  });

  it('处理嵌套数组', () => {
    const svc = makeMockService({ matrix: [[1, 2], [3, 4]] });
    const state = serializeState(svc);
    expect(state['matrix']).toEqual([[1, 2], [3, 4]]);
  });

  it('null 值正常序列化', () => {
    const svc = makeMockService({ nullable: null });
    const state = serializeState(svc);
    expect(state['nullable']).toBeNull();
  });

  it('指定 keys 中包含私有属性时，该属性被过滤', () => {
    const svc = makeMockService({ _secret: 'hidden', $internal: 'also hidden' });
    // 显式传入包含私有属性名的 keys
    const state = serializeState(svc, ['name', '_secret', '$internal']);

    expect(state).toHaveProperty('name');
    expect(state).not.toHaveProperty('_secret');
    expect(state).not.toHaveProperty('$internal');
  });

  it('指定 keys 中包含函数类型属性时，该属性被过滤', () => {
    const svc = makeMockService({ doWork: () => 'result' });
    // 显式传入包含函数属性名的 keys
    const state = serializeState(svc, ['name', 'doWork']);

    expect(state).toHaveProperty('name');
    expect(state).not.toHaveProperty('doWork');
  });

  it('对象属性中包含函数属性时，safeSerialize 过滤掉函数', () => {
    // 对象值中的函数属性应当被 safeSerialize 过滤（返回 undefined，从结果中移除）
    const inner = { value: 42, fn: () => 'ignored' };
    const svc = makeMockService({ data: inner });
    const state = serializeState(svc);

    const data = state['data'] as Record<string, unknown>;
    expect(data['value']).toBe(42);
    expect(data).not.toHaveProperty('fn');
  });
});

// ─── serializeModel ────────────────────────────────────────────────────────

describe('serializeModel', () => {
  it('没有 $model 时返回空对象', () => {
    const svc = { instanceId: 'Test#0' } as unknown as Service;
    expect(serializeModel(svc)).toEqual({});
  });

  it('$model 为非对象时返回空对象', () => {
    const svc = makeMockService({ $model: null });
    expect(serializeModel(svc)).toEqual({});

    const svc2 = makeMockService({ $model: 'invalid' });
    expect(serializeModel(svc2)).toEqual({});
  });

  it('正常序列化 loading/error 状态', () => {
    const svc = makeMockService({
      $model: {
        fetchData: { loading: true, error: null },
        saveData: { loading: false, error: new Error('保存失败') },
      },
    });

    const model = serializeModel(svc);
    expect(model['fetchData']).toEqual({ loading: true, error: null });
    expect(model['saveData']).toEqual({ loading: false, error: '保存失败' });
  });

  it('error 为字符串时正确序列化', () => {
    const svc = makeMockService({
      $model: {
        fetchData: { loading: false, error: '网络错误' },
      },
    });

    const model = serializeModel(svc);
    expect(model['fetchData']?.error).toBe('网络错误');
  });

  it('忽略非对象类型的 $model 条目', () => {
    const svc = makeMockService({
      $model: {
        validMethod: { loading: false, error: null },
        invalidEntry: 'not an object',
      },
    });

    const model = serializeModel(svc);
    expect(model).toHaveProperty('validMethod');
    expect(model).not.toHaveProperty('invalidEntry');
  });
});
