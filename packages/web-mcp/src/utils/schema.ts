/**
 * Schema 推断工具
 *
 * 按以下优先级推断 MCP Tool 的 JSON Schema：
 * 1. @mcpTool({ inputSchema: z.tuple([...]) })  手动传 Zod Schema（最高优先级）
 * 2. @mcpTool({ params: [...] })               简化参数描述数组
 * 3. TypeScript emitDecoratorMetadata          显式开启后的兜底推断
 * 4. 降级为 {}（无约束）                        兜底，仍可调用
 */

import type { McpToolOptions, ParamDescriptor } from '../types';

/**
 * 将简化 params 数组转换为标准 JSON Schema
 *
 * @example
 * ```typescript
 * paramsToJsonSchema([
 *   { type: 'string', description: '商品 ID', required: true },
 *   { type: 'number', description: '数量' },
 * ])
 * // → {
 * //     "type": "object",
 * //     "properties": {
 * //       "arg0": { "type": "string", "description": "商品 ID" },
 * //       "arg1": { "type": "number", "description": "数量" }
 * //     },
 * //     "required": ["arg0"]
 * //   }
 * ```
 */
function paramsToJsonSchema(params: ParamDescriptor[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  params.forEach((param, index) => {
    const key = `arg${index}`;
    properties[key] = {
      type: param.type,
      description: param.description,
    };
    if (param.required) {
      required.push(key);
    }
  });

  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema['required'] = required;
  }

  return schema;
}

/**
 * 从 emitDecoratorMetadata 推断参数 JSON Schema（兜底，仅当显式开启时）
 * 只能推断基础类型，无法获取参数描述/复杂对象结构
 */
function metadataToJsonSchema(target: object, methodName: string): Record<string, unknown> | null {
  try {
    // 仅在 Reflect.metadata 存在时才尝试推断
    const reflect = (globalThis as any).Reflect;
    if (!reflect || typeof reflect.getMetadata !== 'function') {
      return null;
    }

    const paramTypes: unknown[] = reflect.getMetadata('design:paramtypes', target, methodName);
    if (!paramTypes || !Array.isArray(paramTypes) || paramTypes.length === 0) {
      return null;
    }

    const properties: Record<string, unknown> = {};

    paramTypes.forEach((type: unknown, index: number) => {
      const key = `arg${index}`;
      let jsonType: string = 'string';

      // mixed type checks (value + typeof) are not ideal for switch
      if (type === String) jsonType = 'string';
      else if (type === Number) jsonType = 'number';
      else if (type === Boolean) jsonType = 'boolean';
      else if (type === Array) jsonType = 'array';
      else if (
        type === Object ||
        (typeof type === 'function' &&
          type !== String &&
          type !== Number &&
          type !== Boolean &&
          type !== Array)
      ) {
        jsonType = 'object';
      }

      properties[key] = { type: jsonType };
    });

    return {
      type: 'object',
      properties,
    };
  } catch {
    return null;
  }
}

/**
 * 根据 @mcpTool 选项推断 JSON Schema
 *
 * 优先级：Zod inputSchema > params 数组 > emitDecoratorMetadata > {}
 *
 * @param options @mcpTool 装饰器选项
 * @param target 类原型（用于 metadata 推断）
 * @param methodName 方法名（用于 metadata 推断）
 */
export function resolveSchema(
  options: McpToolOptions,
  target: object,
  methodName: string
): Record<string, unknown> {
  // 方案一：Zod inputSchema（最高优先级）
  if (options.inputSchema) {
    try {
      // 动态 require zod-to-json-schema，避免在不需要 Zod 时加载
      const { zodToJsonSchema } = require('zod-to-json-schema') as {
        zodToJsonSchema: (schema: unknown, options?: unknown) => Record<string, unknown>;
      };
      return zodToJsonSchema(options.inputSchema) as Record<string, unknown>;
    } catch {
      // zod-to-json-schema 不可用时降级
    }
  }

  // 方案二：简化 params 数组
  if (options.params && options.params.length > 0) {
    return paramsToJsonSchema(options.params);
  }

  // 方案三：emitDecoratorMetadata 兜底（显式 opt-in）
  const metadataSchema = metadataToJsonSchema(target, methodName);
  if (metadataSchema) {
    return metadataSchema;
  }

  // 兜底：空 schema，无类型约束，仍可调用
  return {};
}
