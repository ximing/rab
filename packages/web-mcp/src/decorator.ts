import type { McpToolOptions } from './types';
import { setMcpToolMetadata } from './utils/reflect';

export function mcpTool(options: McpToolOptions): MethodDecorator {
  return function (target, propertyKey, _descriptor) {
    const methodName = String(propertyKey);
    setMcpToolMetadata(target, { methodName, options });
  };
}
