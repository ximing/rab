/**
 * execute_action Tool 实现
 *
 * 基于 instanceId 路由到具体 Service 实例，执行指定方法。
 * 支持可选的 assertAfter 参数，在一次调用内完成"操作 + 断言"，减少 Agent 调用轮次。
 */

import type { Service } from '@rabjs/service';

import type { ExecuteActionInput, ExecuteActionResult, WebMcpToolDefinition } from '../types';
import { executeAssertions } from '../utils/assert';

/**
 * 执行 execute_action Tool
 *
 * @param instanceMap instanceId → Service 实例的路由 Map
 * @param input 工具输入参数
 * @returns 执行结果（含可选的断言报告）
 */
export async function executeAction(
  instanceMap: Map<string, Service>,
  input: ExecuteActionInput
): Promise<ExecuteActionResult> {
  const { instanceId, action, args, assertAfter } = input;

  // 查找实例
  const instance = instanceMap.get(instanceId);
  if (!instance) {
    return {
      result: null,
      loading: false,
      error: `Service instance not found: instanceId="${instanceId}". Call list_services to get valid instanceIds.`,
    };
  }

  // 查找方法
  const method = (instance as any)[action];
  if (typeof method !== 'function') {
    return {
      result: null,
      loading: false,
      error: `Method "${action}" not found on service "${instanceId}". Check actions list from list_services.`,
    };
  }

  let executeError: string | null = null;
  let result: unknown = null;

  try {
    // 执行方法（语义等同 Function.apply(instance, args)）
    result = await Promise.resolve(method.apply(instance, args));
  } catch (error: unknown) {
    executeError = error instanceof Error ? error.message : String(error);
  }

  // 读取最新的 loading/error 状态
  const modelState = (instance as any).$model?.[action];
  const loading = modelState?.loading ?? false;
  // 优先使用 $model 中的 error，其次使用执行时抛出的异常
  const finalError =
    executeError ??
    (modelState?.error ? String(modelState.error.message || modelState.error) : null);

  const executeResult: ExecuteActionResult = {
    result,
    loading,
    error: finalError,
  };

  // 若有 assertAfter，在方法执行（或报错）后立即执行断言
  // 注意：即使方法报错，断言仍会执行（基于报错后的状态）
  if (assertAfter && assertAfter.length > 0) {
    executeResult.assertion = executeAssertions(instance, assertAfter);
  }

  return executeResult;
}

/**
 * execute_action Tool 的 WebMCP 定义
 */
export function createExecuteActionTool(instanceMap: Map<string, Service>): WebMcpToolDefinition {
  return {
    name: 'execute_action',
    description:
      '执行指定 Service 实例的某个方法。需要先通过 list_services 获取 instanceId。支持可选的 assertAfter 参数，在一次调用内完成"操作 + 断言"',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: {
          type: 'string',
          description: 'Service 实例的唯一标识符，通过 list_services 获取',
        },
        action: {
          type: 'string',
          description: '要执行的方法名',
        },
        args: {
          type: 'array',
          description: '方法参数数组，顺序与方法签名一致',
          items: {},
        },
        assertAfter: {
          type: 'array',
          description:
            '可选：执行方法后立即运行的断言列表，语义等同于 assert_state。当方法为异步时，等待 Promise resolve 后再执行断言',
          items: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: '点分路径，支持数组下标（.数字 形式）',
              },
              op: {
                type: 'string',
                enum: [
                  'eq',
                  'neq',
                  'gt',
                  'gte',
                  'lt',
                  'lte',
                  'exists',
                  'notExists',
                  'includes',
                  'notIncludes',
                  'matches',
                  'type',
                  'length',
                  'lengthGt',
                  'lengthGte',
                  'lengthLt',
                  'lengthLte',
                  'deepEq',
                ],
                description: '断言操作符',
              },
              expected: {
                description: '期望值',
              },
              message: {
                type: 'string',
                description: '可选：这条断言的说明',
              },
            },
            required: ['path', 'op'],
          },
        },
      },
      required: ['instanceId', 'action', 'args'],
    },
    execute: (input: unknown) => {
      const { instanceId, action, args, assertAfter } = input as ExecuteActionInput;
      return executeAction(instanceMap, { instanceId, action, args: args ?? [], assertAfter });
    },
  };
}
