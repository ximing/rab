/**
 * get_state Tool 实现（降级版本）
 *
 * 基于 instanceId 路由到具体 Service 实例，返回其状态快照。
 *
 * 降级策略（规避 OOM / crash）：
 * - 标量字段（string/number/boolean/null）：直接返回当前值
 * - 复杂对象字段：只返回类型摘要（"[Object]" 或 "[Array(N)]"），不递归序列化
 *
 * 对于需要深入验证对象内部的场景，请使用 assert_state + 点分路径代替。
 */

import type { Service } from '@rabjs/service';

import type {
  GetStateInput,
  GetStateResult,
  WebMcpToolDefinition,
} from '../types';
import { serializeModel, serializeStateSafe } from '../utils/serialize';

/**
 * 执行 get_state Tool
 *
 * @param instanceMap instanceId → Service 实例的路由 Map
 * @param input 工具输入参数
 * @returns 状态快照（标量值 + 复杂对象摘要）
 */
export function getState(
  instanceMap: Map<string, Service>,
  input: GetStateInput
): GetStateResult {
  const { instanceId, keys } = input;

  // 查找实例
  const instance = instanceMap.get(instanceId);
  if (!instance) {
    return {
      state: {},
      model: {},
    };
  }

  return {
    state: serializeStateSafe(instance, keys),
    model: serializeModel(instance),
  };
}

/**
 * get_state Tool 的 WebMCP 定义
 */
export function createGetStateTool(
  instanceMap: Map<string, Service>
): WebMcpToolDefinition {
  return {
    name: 'get_state',
    description: '获取指定 Service 实例的状态快照。标量字段（string/number/boolean/null）返回当前值，复杂对象字段只返回类型摘要（"[Object]"/"[Array(N)]"）以避免大对象序列化 crash。如需验证对象内部，请使用 assert_state + 点分路径。',
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
