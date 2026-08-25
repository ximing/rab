/**
 * utils/reflect.ts 单元测试
 */

import {
  getMcpToolMetadata,
  getMcpToolMetadataList,
  MCP_TOOL_METADATA_KEY,
  setMcpToolMetadata,
} from '../../utils/reflect';
import type { McpToolMetadata } from '../../types';

/** 构造一个干净的原型对象用于测试 */
function createPrototype(): object {
  return Object.create(Object.prototype);
}

describe('setMcpToolMetadata', () => {
  it('在原型上写入元数据后可读取', () => {
    const proto = createPrototype();
    const meta: McpToolMetadata = {
      methodName: 'fetchData',
      options: { description: '获取数据' },
    };

    setMcpToolMetadata(proto, meta);

    const map: Map<string, McpToolMetadata> = (proto as any)[MCP_TOOL_METADATA_KEY];
    expect(map).toBeDefined();
    expect(map.get('fetchData')).toEqual(meta);
  });

  it('多次写入不同方法名，全部保留', () => {
    const proto = createPrototype();
    const meta1: McpToolMetadata = {
      methodName: 'fetchOrders',
      options: { description: '获取订单' },
    };
    const meta2: McpToolMetadata = {
      methodName: 'cancelOrder',
      options: { description: '取消订单' },
    };

    setMcpToolMetadata(proto, meta1);
    setMcpToolMetadata(proto, meta2);

    const map: Map<string, McpToolMetadata> = (proto as any)[MCP_TOOL_METADATA_KEY];
    expect(map.size).toBe(2);
    expect(map.get('fetchOrders')).toEqual(meta1);
    expect(map.get('cancelOrder')).toEqual(meta2);
  });

  it('覆盖同名方法的元数据', () => {
    const proto = createPrototype();
    const meta1: McpToolMetadata = { methodName: 'fetchData', options: { description: '旧描述' } };
    const meta2: McpToolMetadata = { methodName: 'fetchData', options: { description: '新描述' } };

    setMcpToolMetadata(proto, meta1);
    setMcpToolMetadata(proto, meta2);

    const map: Map<string, McpToolMetadata> = (proto as any)[MCP_TOOL_METADATA_KEY];
    expect(map.size).toBe(1);
    expect(map.get('fetchData')?.options.description).toBe('新描述');
  });

  it('子类原型与父类原型相互隔离', () => {
    const parentProto = createPrototype();
    const childProto = Object.create(parentProto);

    const parentMeta: McpToolMetadata = {
      methodName: 'parentMethod',
      options: { description: '父类方法' },
    };
    const childMeta: McpToolMetadata = {
      methodName: 'childMethod',
      options: { description: '子类方法' },
    };

    setMcpToolMetadata(parentProto, parentMeta);
    setMcpToolMetadata(childProto, childMeta);

    // 子类不应该污染父类
    const parentMap: Map<string, McpToolMetadata> = (parentProto as any)[MCP_TOOL_METADATA_KEY];
    expect(parentMap.has('parentMethod')).toBe(true);
    expect(parentMap.has('childMethod')).toBe(false);

    const childMap: Map<string, McpToolMetadata> = (childProto as any)[MCP_TOOL_METADATA_KEY];
    expect(childMap.has('childMethod')).toBe(true);
    expect(childMap.has('parentMethod')).toBe(false);
  });
});

describe('getMcpToolMetadataList', () => {
  it('空原型返回空数组', () => {
    const proto = createPrototype();
    expect(getMcpToolMetadataList(proto)).toEqual([]);
  });

  it('返回当前原型上的所有元数据', () => {
    const proto = createPrototype();
    const meta1: McpToolMetadata = {
      methodName: 'fetchOrders',
      options: { description: '获取订单' },
    };
    const meta2: McpToolMetadata = {
      methodName: 'cancelOrder',
      options: { description: '取消订单' },
    };

    setMcpToolMetadata(proto, meta1);
    setMcpToolMetadata(proto, meta2);

    const result = getMcpToolMetadataList(proto);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(meta1);
    expect(result).toContainEqual(meta2);
  });

  it('可读取父类原型的元数据', () => {
    const parentProto = createPrototype();
    const childProto = Object.create(parentProto);

    const parentMeta: McpToolMetadata = {
      methodName: 'parentMethod',
      options: { description: '父类' },
    };
    setMcpToolMetadata(parentProto, parentMeta);

    // 子类自身没有元数据，但应能查到父类的
    const result = getMcpToolMetadataList(childProto);
    expect(result).toContainEqual(parentMeta);
  });

  it('子类自身有元数据时，优先返回子类的', () => {
    const parentProto = createPrototype();
    const childProto = Object.create(parentProto);

    const parentMeta: McpToolMetadata = {
      methodName: 'parentMethod',
      options: { description: '父类' },
    };
    const childMeta: McpToolMetadata = {
      methodName: 'childMethod',
      options: { description: '子类' },
    };

    setMcpToolMetadata(parentProto, parentMeta);
    setMcpToolMetadata(childProto, childMeta);

    // 子类有自己的 Map，直接返回子类的（不合并）
    const result = getMcpToolMetadataList(childProto);
    expect(result).toContainEqual(childMeta);
    // 只返回子类自身的，不再遍历父类
    expect(result).not.toContainEqual(parentMeta);
  });
});

describe('getMcpToolMetadata', () => {
  it('可读取指定方法名的元数据', () => {
    const proto = createPrototype();
    const meta: McpToolMetadata = { methodName: 'fetchData', options: { description: '获取数据' } };
    setMcpToolMetadata(proto, meta);

    expect(getMcpToolMetadata(proto, 'fetchData')).toEqual(meta);
  });

  it('不存在时返回 undefined', () => {
    const proto = createPrototype();
    expect(getMcpToolMetadata(proto, 'nonExistent')).toBeUndefined();
  });

  it('可读取父类原型上的单个元数据', () => {
    const parentProto = createPrototype();
    const childProto = Object.create(parentProto);

    const meta: McpToolMetadata = {
      methodName: 'parentMethod',
      options: { description: '父类方法' },
    };
    setMcpToolMetadata(parentProto, meta);

    expect(getMcpToolMetadata(childProto, 'parentMethod')).toEqual(meta);
  });
});
