/**
 * @mcpTool 装饰器实现
 *
 * 被标注的方法会额外注册为独立的 WebMCP Tool（与通用 4 个 Tool 并列）
 * Tool 名称格式为 {ServiceName}__{methodName}
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { mcpTool } from '@rabjs/web-mcp';
 *
 * class CartService extends Service {
 *   // 写法一：Zod Tuple（精确，推荐）
 *   @mcpTool({
 *     description: '添加商品到购物车',
 *     inputSchema: z.tuple([
 *       z.string().describe('商品 ID'),
 *       z.number().int().min(1).default(1).describe('数量'),
 *     ])
 *   })
 *   async addItem(productId: string, quantity: number) { ... }
 *
 *   // 写法二：params 数组（快速）
 *   @mcpTool({
 *     description: '移除购物车中的商品',
 *     params: [
 *       { type: 'string', description: '商品 ID', required: true }
 *     ]
 *   })
 *   async removeItem(productId: string) { ... }
 *
 *   // 写法三：只写 description，靠 emitDecoratorMetadata 兜底（需显式开启）
 *   @mcpTool({ description: '清空购物车' })
 *   async clearCart() { ... }
 * }
 * ```
 */

import type { McpToolOptions } from './types';
import { setMcpToolMetadata } from './utils/reflect';

/**
 * @mcpTool 装饰器
 *
 * 将方法注册为独立的 WebMCP Tool，获得精准的描述和参数 Schema
 * 独立 Tool 的调用格式：
 * ```
 * {ServiceName}__{methodName}({ instanceId: 'CartService#0', args: [...] })
 * ```
 *
 * @param options Tool 配置选项
 */
export function mcpTool(options: McpToolOptions): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ): void {
    const methodName = String(propertyKey);

    // 将元数据存储到类原型上
    setMcpToolMetadata(target, {
      methodName,
      options,
    });
  };
}
