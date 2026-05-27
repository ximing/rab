import type { Service } from '@rabjs/service';

import type {
  SetStateInput,
  SetStateResult,
  WebMcpToolDefinition,
} from '../types';
import { getStateKeys } from '../utils/serialize';

export function setState(
  instanceMap: Map<string, Service>,
  input: SetStateInput
): SetStateResult {
  const { instanceId, patch } = input;

  const instance = instanceMap.get(instanceId);
  if (!instance) {
    return {
      success: false,
      updated: [],
      rejected: Object.keys(patch).map(key => ({
        key,
        reason: `Service instance not found: instanceId="${instanceId}". Call list_services to get valid instanceIds.`,
      })),
    };
  }

  const validKeys = new Set(getStateKeys(instance));

  const updated: string[] = [];
  const rejected: Array<{ key: string; reason: string }> = [];

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'instanceId') {
      rejected.push({ key, reason: '"instanceId" is read-only and cannot be modified.' });
      continue;
    }

    if (!validKeys.has(key)) {
      const rawValue = (instance as any)[key];
      if (typeof rawValue === 'function') {
        rejected.push({ key, reason: `"${key}" is a method, not a state property. Use execute_action to call methods.` });
      } else if (key.startsWith('_') || key.startsWith('$')) {
        rejected.push({ key, reason: `"${key}" is a private property and cannot be modified externally.` });
      } else {
        rejected.push({ key, reason: `"${key}" does not exist on this Service instance. Check stateKeys from list_services.` });
      }
      continue;
    }

    try {
      (instance as any)[key] = value;
      updated.push(key);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      rejected.push({ key, reason: `Failed to set "${key}": ${message}` });
    }
  }

  return {
    success: rejected.length === 0,
    updated,
    rejected,
  };
}

export function createSetStateTool(
  instanceMap: Map<string, Service>
): WebMcpToolDefinition {
  return {
    name: 'set_state',
    description: '直接修改指定 Service 实例的状态属性值。仅允许修改已存在的公开状态属性（非函数、非私有）。修改会触发响应式更新，驱动页面重渲染。',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: {
          type: 'string',
          description: 'Service 实例的唯一标识符，通过 list_services 获取',
        },
        patch: {
          type: 'object',
          description: '要修改的状态键值对，key 为属性名（必须在 stateKeys 列表中），value 为新值',
          additionalProperties: true,
        },
      },
      required: ['instanceId', 'patch'],
    },
    execute: (input: unknown) => {
      const { instanceId, patch } = input as SetStateInput;
      return setState(instanceMap, { instanceId, patch: patch ?? {} });
    },
  };
}
