/**
 * @rabjs/web-mcp
 *
 * 将 @rabjs/service 的 Service 系统与 WebMCP 协议桥接，
 * 使 AI Agent 能够通过标准 MCP 接口与业务 Service 交互。
 *
 * ## 快速接入（React / 多 Container 场景）
 *
 * ```typescript
 * // app/main.tsx —— 唯一改动，应用入口初始化一次
 * import { McpRegistry } from '@rabjs/web-mcp';
 * McpRegistry.getInstance().mount();
 * ```
 *
 * ## 单 Container 场景
 *
 * ```typescript
 * import { McpBridge } from '@rabjs/web-mcp';
 * const bridge = new McpBridge();
 * await bridge.mount(container);
 * ```
 *
 * ## 业务 Service 增强（可选）
 *
 * ```typescript
 * import { z } from 'zod';
 * import { mcpTool } from '@rabjs/web-mcp';
 *
 * class OrderService extends Service {
 *   @mcpTool({
 *     description: '获取订单列表',
 *     inputSchema: z.tuple([
 *       z.number().default(1).describe('页码'),
 *     ])
 *   })
 *   async fetchOrders(page: number) { ... }
 * }
 * ```
 */

// ─── 核心类 ───────────────────────────────────────
export { McpBridge } from './bridge';
export { McpRegistry } from './registry';

// ─── 装饰器 ───────────────────────────────────────
export { mcpTool } from './decorator';

// ─── 类型定义 ─────────────────────────────────────
export type {
  // @mcpTool 装饰器选项
  McpToolOptions,
  McpToolMetadata,
  ParamDescriptor,
  // list_services
  ActionDescriptor,
  ServiceDescriptor,
  ListServicesResult,
  // execute_action
  ExecuteActionInput,
  ExecuteActionResult,
  // get_state
  GetStateInput,
  GetStateResult,
  // set_state
  SetStateInput,
  SetStateResult,
  // WebMCP 平台接口
  WebMcpToolDefinition,
  ModelContextApi,
} from './types';

// ─── 版本 ─────────────────────────────────────────
export const version = '0.0.1';
