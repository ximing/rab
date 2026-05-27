import type { Service } from '@rabjs/service';

import type {
  ExecuteActionInput,
  ExecuteActionResult,
  WebMcpToolDefinition,
} from '../types';

export async function executeAction(
  instanceMap: Map<string, Service>,
  input: ExecuteActionInput
): Promise<ExecuteActionResult> {
  const { instanceId, action, args } = input;

  const instance = instanceMap.get(instanceId);
  if (!instance) {
    return {
      result: null,
      loading: false,
      error: `Service instance not found: instanceId="${instanceId}". Call list_services to get valid instanceIds.`,
    };
  }

  const method = (instance as any)[action];
  if (typeof method !== 'function') {
    return {
      result: null,
      loading: false,
      error: `Method "${action}" not found on service "${instanceId}". Check actions list from list_services.`,
    };
  }

  try {
    const result = await Promise.resolve(method.apply(instance, args));

    const modelState = (instance as any).$model?.[action];
    return {
      result,
      loading: modelState?.loading ?? false,
      error: modelState?.error ? String(modelState.error.message || modelState.error) : null,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      result: null,
      loading: false,
      error: errorMessage,
    };
  }
}

export function createExecuteActionTool(
  instanceMap: Map<string, Service>
): WebMcpToolDefinition {
  return {
    name: 'execute_action',
    description: '执行指定 Service 实例的某个方法。需要先通过 list_services 获取 instanceId',
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
      },
      required: ['instanceId', 'action', 'args'],
    },
    execute: (input: unknown) => {
      const { instanceId, action, args } = input as ExecuteActionInput;
      return executeAction(instanceMap, { instanceId, action, args: args ?? [] });
    },
  };
}
