/**
 * utils/schema.ts 单元测试
 */

import { resolveSchema } from '../../utils/schema';
import type { McpToolOptions, ParamDescriptor } from '../../types';

describe('resolveSchema', () => {
  const proto = Object.create(Object.prototype);
  const methodName = 'testMethod';

  // ─── 方案一：Zod inputSchema ──────────────────────────────────────────

  describe('方案一：Zod inputSchema', () => {
    it('传入 Zod Tuple 时生成对应 JSON Schema', () => {
      let z: typeof import('zod').z;
      try {
        z = require('zod').z;
      } catch {
        // zod 不可用时跳过
        return;
      }

      const schema = z.tuple([
        z.string().describe('商品 ID'),
        z.number().int().min(1).describe('数量'),
      ]);

      const options: McpToolOptions = {
        description: '添加商品',
        inputSchema: schema,
      };

      const result = resolveSchema(options, proto, methodName);
      expect(result['type']).toBe('array');
      const items = (result['prefixItems'] ?? result['items']) as Array<Record<string, unknown>>;
      expect(items[0]).toMatchObject({ type: 'string', description: '商品 ID' });
      expect(items[1]).toMatchObject({ type: 'integer', minimum: 1, description: '数量' });
    });
  });

  // ─── 方案二：params 数组 ────────────────────────────────────────────────

  describe('方案二：params 数组', () => {
    it('params 数组生成正确 JSON Schema', () => {
      const params: ParamDescriptor[] = [
        { type: 'string', description: '商品 ID', required: true },
        { type: 'number', description: '数量' },
      ];

      const options: McpToolOptions = {
        description: '添加商品',
        params,
      };

      const result = resolveSchema(options, proto, methodName);

      expect(result['type']).toBe('object');
      const properties = result['properties'] as Record<string, unknown>;
      expect(properties['arg0']).toEqual({ type: 'string', description: '商品 ID' });
      expect(properties['arg1']).toEqual({ type: 'number', description: '数量' });
      expect(result['required']).toEqual(['arg0']); // 只有 required: true 的字段
    });

    it('没有 required 字段时，schema 中不含 required', () => {
      const params: ParamDescriptor[] = [{ type: 'string', description: '可选参数' }];

      const options: McpToolOptions = {
        description: '测试方法',
        params,
      };

      const result = resolveSchema(options, proto, methodName);
      expect(result).not.toHaveProperty('required');
    });

    it('多个 required 参数都出现在 required 数组', () => {
      const params: ParamDescriptor[] = [
        { type: 'string', description: '参数1', required: true },
        { type: 'number', description: '参数2', required: true },
        { type: 'boolean', description: '参数3' },
      ];

      const options: McpToolOptions = {
        description: '测试方法',
        params,
      };

      const result = resolveSchema(options, proto, methodName);
      expect(result['required']).toEqual(['arg0', 'arg1']);
    });

    it('支持所有 ParamDescriptor 类型', () => {
      const params: ParamDescriptor[] = [
        { type: 'string', description: '字符串' },
        { type: 'number', description: '数字' },
        { type: 'boolean', description: '布尔' },
        { type: 'array', description: '数组' },
        { type: 'object', description: '对象' },
      ];

      const options: McpToolOptions = {
        description: '测试方法',
        params,
      };

      const result = resolveSchema(options, proto, methodName);
      const properties = result['properties'] as Record<string, Record<string, string>>;
      expect(properties['arg0']?.type).toBe('string');
      expect(properties['arg1']?.type).toBe('number');
      expect(properties['arg2']?.type).toBe('boolean');
      expect(properties['arg3']?.type).toBe('array');
      expect(properties['arg4']?.type).toBe('object');
    });

    it('params 为空数组时降级到方案三/四', () => {
      const options: McpToolOptions = {
        description: '测试方法',
        params: [],
      };

      // params 为空数组时应继续检查其他方案，最终降级为 {}
      const result = resolveSchema(options, proto, methodName);
      expect(result).toEqual({});
    });
  });

  // ─── 方案三：emitDecoratorMetadata ────────────────────────────────────

  describe('方案三：emitDecoratorMetadata（Reflect.metadata）', () => {
    it('存在 Reflect.getMetadata 时使用反射推断（String/Number）', () => {
      const mockReflect = {
        getMetadata: jest.fn().mockReturnValue([String, Number]),
      };
      (globalThis as any).Reflect = mockReflect;

      const options: McpToolOptions = { description: '测试方法' };
      const result = resolveSchema(options, proto, 'methodWithTypes');

      expect(result['type']).toBe('object');
      const properties = result['properties'] as Record<string, Record<string, string>>;
      expect(properties['arg0']?.type).toBe('string');
      expect(properties['arg1']?.type).toBe('number');

      // 清理 mock
      delete (globalThis as any).Reflect;
    });

    it('存在 Reflect.getMetadata 时推断 Boolean/Array/Object 类型', () => {
      const mockReflect = {
        getMetadata: jest.fn().mockReturnValue([Boolean, Array, Object]),
      };
      (globalThis as any).Reflect = mockReflect;

      const options: McpToolOptions = { description: '测试方法' };
      const result = resolveSchema(options, proto, 'methodWithTypes');

      const properties = result['properties'] as Record<string, Record<string, string>>;
      expect(properties['arg0']?.type).toBe('boolean');
      expect(properties['arg1']?.type).toBe('array');
      expect(properties['arg2']?.type).toBe('object');

      delete (globalThis as any).Reflect;
    });

    it('存在 Reflect.getMetadata 时推断自定义类作为 object 类型', () => {
      class CustomModel {}
      const mockReflect = {
        getMetadata: jest.fn().mockReturnValue([CustomModel]),
      };
      (globalThis as any).Reflect = mockReflect;

      const options: McpToolOptions = { description: '测试方法' };
      const result = resolveSchema(options, proto, 'methodWithCustomClass');

      const properties = result['properties'] as Record<string, Record<string, string>>;
      expect(properties['arg0']?.type).toBe('object');

      delete (globalThis as any).Reflect;
    });

    it('Reflect.getMetadata 抛出异常时降级为 {}', () => {
      const mockReflect = {
        getMetadata: jest.fn().mockImplementation(() => {
          throw new Error('reflect error');
        }),
      };
      (globalThis as any).Reflect = mockReflect;

      const options: McpToolOptions = { description: '测试方法' };
      const result = resolveSchema(options, proto, methodName);
      expect(result).toEqual({});

      delete (globalThis as any).Reflect;
    });

    it('Reflect.metadata 返回空数组时降级到方案四', () => {
      const mockReflect = {
        getMetadata: jest.fn().mockReturnValue([]),
      };
      (globalThis as any).Reflect = mockReflect;

      const options: McpToolOptions = { description: '测试方法' };
      const result = resolveSchema(options, proto, methodName);
      expect(result).toEqual({});

      delete (globalThis as any).Reflect;
    });
  });

  // ─── 方案四：兜底 {} ────────────────────────────────────────────────────

  describe('方案四：兜底 {}', () => {
    it('没有任何 Schema 信息时返回空对象', () => {
      const options: McpToolOptions = { description: '测试方法' };
      const result = resolveSchema(options, proto, methodName);
      expect(result).toEqual({});
    });
  });
});
