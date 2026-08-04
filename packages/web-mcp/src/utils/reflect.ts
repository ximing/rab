/**
 * 反射工具
 *
 * 读取 @mcpTool 装饰器在类原型上写入的元数据
 */

import type { McpToolMetadata } from '../types';

/**
 * @mcpTool 元数据存储的 Symbol key
 * 存储在类原型上，格式为 Map<methodName, McpToolMetadata>
 */
export const MCP_TOOL_METADATA_KEY = Symbol('rs:mcp:tools');

/**
 * 从类原型或实例上读取所有 @mcpTool 标注的方法元数据
 *
 * @param target 类的原型对象或实例
 * @returns @mcpTool 元数据列表
 */
export function getMcpToolMetadataList(target: object): McpToolMetadata[] {
  // 尝试获取原型链上的 @mcpTool 元数据
  let current: object | null = target;

  while (current && current !== Object.prototype) {
    const metadataMap: Map<string, McpToolMetadata> | undefined =
      (current as any)[MCP_TOOL_METADATA_KEY];

    if (metadataMap && metadataMap.size > 0) {
      return [...metadataMap.values()];
    }

    current = Object.getPrototypeOf(current);
  }

  return [];
}

/**
 * 获取单个方法的 @mcpTool 元数据
 *
 * @param target 类的原型对象或实例
 * @param methodName 方法名
 * @returns 元数据，不存在则返回 undefined
 */
export function getMcpToolMetadata(
  target: object,
  methodName: string
): McpToolMetadata | undefined {
  let current: object | null = target;

  while (current && current !== Object.prototype) {
    const metadataMap: Map<string, McpToolMetadata> | undefined =
      (current as any)[MCP_TOOL_METADATA_KEY];

    if (metadataMap?.has(methodName)) {
      return metadataMap.get(methodName);
    }

    current = Object.getPrototypeOf(current);
  }

  return undefined;
}

/**
 * 在类原型上写入 @mcpTool 元数据（由装饰器调用）
 *
 * @param target 类的原型对象
 * @param metadata 元数据
 */
export function setMcpToolMetadata(target: object, metadata: McpToolMetadata): void {
  let metadataMap: Map<string, McpToolMetadata> | undefined =
    Object.prototype.hasOwnProperty.call(target, MCP_TOOL_METADATA_KEY)
      ? (target as any)[MCP_TOOL_METADATA_KEY]
      : undefined;

  if (!metadataMap) {
    // 创建新的 Map，只在当前原型上存储，不影响父类
    metadataMap = new Map();
    Object.defineProperty(target, MCP_TOOL_METADATA_KEY, {
      value: metadataMap,
      enumerable: false,
      configurable: true,
      writable: false,
    });
  }

  metadataMap.set(metadata.methodName, metadata);
}
