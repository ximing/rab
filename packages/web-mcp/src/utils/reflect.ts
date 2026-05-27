import type { McpToolMetadata } from '../types';

export const MCP_TOOL_METADATA_KEY = Symbol('rs:mcp:tools');

export function getMcpToolMetadataList(target: object): McpToolMetadata[] {
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

export function setMcpToolMetadata(target: object, metadata: McpToolMetadata): void {
  let metadataMap: Map<string, McpToolMetadata> | undefined =
    Object.prototype.hasOwnProperty.call(target, MCP_TOOL_METADATA_KEY)
      ? (target as any)[MCP_TOOL_METADATA_KEY]
      : undefined;

  if (!metadataMap) {
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
