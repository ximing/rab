import type { Service } from '@rabjs/service';

import type {
  GetStateInput,
  GetStateResult,
  WebMcpToolDefinition,
} from '../types';
import { serializeModel, serializeState } from '../utils/serialize';

export function getState(
  instanceMap: Map<string, Service>,
  input: GetStateInput
): GetStateResult {
  const { instanceId, keys } = input;

  const instance = instanceMap.get(instanceId);
  if (!instance) {
    return {
      state: {},
      model: {},
    };
  }

  return {
    state: serializeState(instance, keys),
    model: serializeModel(instance),
  };
}

export function createGetStateTool(
  instanceMap: Map<string, Service>
): WebMcpToolDefinition {
  return {
    name: 'get_state',
    description: '获取指定 Service 实例的状态快照，包含数据属性和方法的 loading/error 状态',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: {
          type: 'string',
          description: 'Service 实例的唯一标识符，通过 list_services 获取',
        },
        keys: {
          type: 'array',
          description: '可选，指定要读取的状态属性名列表，不传则返回全部',
          items: {
            type: 'string',
          },
        },
      },
      required: ['instanceId'],
    },
    execute: (input: unknown) => {
      const { instanceId, keys } = input as GetStateInput;
      return getState(instanceMap, { instanceId, keys });
    },
  };
}
