import type { McpToolOptions, ParamDescriptor } from '../types';

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

function metadataToJsonSchema(target: object, methodName: string): Record<string, unknown> | null {
  try {
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

      if (type === String) jsonType = 'string';
      else if (type === Number) jsonType = 'number';
      else if (type === Boolean) jsonType = 'boolean';
      else if (type === Array) jsonType = 'array';
      else if (type === Object || (typeof type === 'function' && type !== String && type !== Number && type !== Boolean && type !== Array)) {
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

export function resolveSchema(
  options: McpToolOptions,
  target: object,
  methodName: string
): Record<string, unknown> {
  if (options.inputSchema) {
    try {
      const { zodToJsonSchema } = require('zod-to-json-schema') as {
        zodToJsonSchema: (schema: unknown, options?: unknown) => Record<string, unknown>;
      };
      return zodToJsonSchema(options.inputSchema) as Record<string, unknown>;
    } catch {
      // zod-to-json-schema 不可用时降级
    }
  }

  if (options.params && options.params.length > 0) {
    return paramsToJsonSchema(options.params);
  }

  const metadataSchema = metadataToJsonSchema(target, methodName);
  if (metadataSchema) {
    return metadataSchema;
  }

  return {};
}
