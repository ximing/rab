/**
 * @rabjs/web-mcp 类型定义
 */

import type { Assertion, AssertionResult } from '@rabjs/shared';
import type { ZodType } from 'zod';

// ─────────────────────────────────────────────
// 断言相关类型：从 @rabjs/shared re-export
// 保留以不破坏现有消费方的 import 路径
// ─────────────────────────────────────────────
export type {
  AssertOp,
  ScalarAssertOp,
  ElementAssertion,
  Assertion,
  AssertionResult,
} from '@rabjs/shared';

// ─────────────────────────────────────────────
// @mcpTool 装饰器相关类型
// ─────────────────────────────────────────────

/**
 * 简化参数描述对象（方案二：快速书写，无 Zod 校验）
 */
export interface ParamDescriptor {
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** 参数描述，供 AI 理解用途 */
  description: string;
  /** 是否必填，默认 false */
  required?: boolean;
}

/**
 * @mcpTool 装饰器选项
 */
export interface McpToolOptions {
  /** Tool 描述，供 AI 理解用途（必填） */
  description: string;
  /** 自定义 Tool 名，默认为 {ServiceName}__{methodName} */
  name?: string;
  /**
   * 方案一：传入 Zod Schema（推荐 z.tuple，按位置描述函数参数）
   * 语义等同 Function.apply(instance, args)
   * 运行时同时接受 Zod 3 / 4。
   */
  inputSchema?: ZodType;
  /**
   * 方案二：简化参数描述数组（快速书写，无 Zod 校验）
   * 每个元素对应一个位置参数
   */
  params?: ParamDescriptor[];
}

/**
 * @mcpTool 方法元数据（存储在类原型上）
 */
export interface McpToolMetadata {
  /** 方法名 */
  methodName: string;
  /** 装饰器选项 */
  options: McpToolOptions;
}

// ─────────────────────────────────────────────
// list_services Tool 相关类型
// ─────────────────────────────────────────────

/**
 * Action 描述（用于 list_services 输出）
 */
export interface ActionDescriptor {
  /** 方法名 */
  name: string;
  /** 方法描述（来自 @mcpTool） */
  description?: string;
  /** 是否有 @mcpTool 注解 */
  hasMcpTool: boolean;
  /** JSON Schema 描述输入参数 */
  inputSchema?: Record<string, unknown>;
}

/**
 * 服务描述（list_services 输出中的单个服务）
 */
export interface ServiceDescriptor {
  /** 服务实例唯一标识，路由主键 */
  instanceId: string;
  /** 所属容器名（展示用） */
  containerName: string;
  /** identifier 类型（展示用） */
  identifierType: 'constructor' | 'string' | 'symbol';
  /** identifier 的文本形式（展示用） */
  identifierLabel: string;
  /** 服务作用域 */
  scope: string;
  /** 方法列表 */
  actions: ActionDescriptor[];
  /**
   * 基本类型（string/number/boolean/null）的字段及其当前类型。
   * Agent 可直接对这些字段使用 eq / gt / exists 等操作符。
   */
  scalarState: Record<string, 'string' | 'number' | 'boolean' | 'null'>;
  /**
   * 复杂类型（object/array）字段的名称列表（不展开内容）。
   * Agent 可通过点分路径深入这些字段的子属性进行断言，
   * 如 "ladingMonitorData.list.length"。
   */
  objectState: string[];
}

/**
 * list_services Tool 输出
 */
export interface ListServicesResult {
  services: ServiceDescriptor[];
}

// ─────────────────────────────────────────────
// execute_action Tool 相关类型
// ─────────────────────────────────────────────

/**
 * execute_action Tool 输入
 */
export interface ExecuteActionInput {
  /** list_services 返回的 instanceId */
  instanceId: string;
  /** 方法名 */
  action: string;
  /** 方法参数数组（顺序与方法签名一致） */
  args: unknown[];
  /**
   * 可选：执行方法后立即运行的断言列表。
   * 语义等同于执行完 execute_action 后立即调用 assert_state。
   * 当方法为异步时，等待 Promise resolve 后再执行断言。
   */
  assertAfter?: Assertion[];
}

/**
 * execute_action Tool 输出
 */
export interface ExecuteActionResult {
  /** 方法返回值 */
  result: unknown;
  /** 是否正在 loading（异步方法执行后的状态） */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /**
   * assertAfter 的执行结果。
   * 仅当输入中传了 assertAfter 时存在。
   * 若方法本身执行报错（error != null），断言仍会执行（基于报错后的状态）。
   */
  assertion?: AssertStateResult;
}

// ─────────────────────────────────────────────
// get_state Tool 相关类型
// ─────────────────────────────────────────────

/**
 * get_state Tool 输入
 */
export interface GetStateInput {
  /** list_services 返回的 instanceId */
  instanceId: string;
  /** 可选，指定要读取的属性名，不传则返回全部 */
  keys?: string[];
}

/**
 * get_state Tool 输出
 */
export interface GetStateResult {
  /** 状态快照 */
  state: Record<string, unknown>;
  /** 方法的 loading/error 状态 */
  model: Record<
    string,
    {
      loading: boolean;
      error: string | null;
    }
  >;
}

// ─────────────────────────────────────────────
// set_state Tool 相关类型
// ─────────────────────────────────────────────

/**
 * set_state Tool 输入
 */
export interface SetStateInput {
  /** list_services 返回的 instanceId */
  instanceId: string;
  /** 要修改的状态键值对，key 为属性名，value 为新值 */
  patch: Record<string, unknown>;
}

/**
 * set_state Tool 输出
 */
export interface SetStateResult {
  /** 操作是否成功 */
  success: boolean;
  /** 成功修改的属性名列表 */
  updated: string[];
  /** 被拒绝修改的属性名及原因 */
  rejected: Array<{ key: string; reason: string }>;
}

// ─────────────────────────────────────────────
// assert_state Tool 相关类型
// ─────────────────────────────────────────────

/**
 * assert_state Tool 输出
 */
export interface AssertStateResult {
  /** 所有断言是否全部通过 */
  passed: boolean;
  /** 通过数 / 总数 */
  summary: {
    passed: number;
    total: number;
  };
  /** 每条断言的详细结果 */
  results: AssertionResult[];
}

/**
 * assert_state Tool 输入
 */
export interface AssertStateInput {
  /** Service 实例的唯一标识符，通过 list_services 获取 */
  instanceId: string;
  /** 断言列表，一次调用支持多个断言 */
  assertions: Assertion[];
  /** 可选：整组断言的描述，出现在报告中 */
  description?: string;
}

// ─────────────────────────────────────────────
// WebMCP 平台接口（最小化类型声明，避免直接依赖 @mcp-b/global）
// ─────────────────────────────────────────────

/**
 * WebMCP Tool 定义
 */
export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => unknown | Promise<unknown>;
}

/**
 * navigator.modelContext 的最小化接口
 */
export interface ModelContextApi {
  registerTool(tool: WebMcpToolDefinition): { unregister(): void };
}

declare global {
  interface Navigator {
    modelContext?: ModelContextApi;
  }
}
