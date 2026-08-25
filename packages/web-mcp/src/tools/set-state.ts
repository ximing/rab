/**
 * set_state Tool 实现
 *
 * 基于 instanceId 路由到具体 Service 实例，直接修改其可观测状态属性。
 * 只允许修改已存在于实例上的、非私有、非函数类型的属性。
 */

import type { Service } from '@rabjs/service';

import type { SetStateInput, SetStateResult, WebMcpToolDefinition } from '../types';
import { getStateKeys } from '../utils/serialize';

/**
 * 执行 set_state Tool
 *
 * @param instanceMap instanceId → Service 实例的路由 Map
 * @param input 工具输入参数
 * @returns 修改结果
 */
export function setState(instanceMap: Map<string, Service>, input: SetStateInput): SetStateResult {
  const { instanceId, patch } = input;

  // 查找实例
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

  // 获取合法的状态键列表
  const validKeys = new Set(getStateKeys(instance));

  const updated: string[] = [];
  const rejected: Array<{ key: string; reason: string }> = [];

  for (const [key, value] of Object.entries(patch)) {
    // 不允许修改 instanceId
    if (key === 'instanceId') {
      rejected.push({ key, reason: '"instanceId" is read-only and cannot be modified.' });
      continue;
    }

    // 只允许修改已在 stateKeys 中存在的属性（过滤私有属性和函数）
    if (!validKeys.has(key)) {
      // 给出更详细的拒绝原因
      const rawValue = (instance as any)[key];
      if (typeof rawValue === 'function') {
        rejected.push({
          key,
          reason: `"${key}" is a method, not a state property. Use execute_action to call methods.`,
        });
      } else if (key.startsWith('_') || key.startsWith('$')) {
        rejected.push({
          key,
          reason: `"${key}" is a private property and cannot be modified externally.`,
        });
      } else {
        rejected.push({
          key,
          reason: `"${key}" does not exist on this Service instance. Check stateKeys from list_services.`,
        });
      }
      continue;
    }

    // 直接赋值（会触发响应式系统的依赖追踪）
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

/**
 * set_state Tool 的 WebMCP 定义
 */
export function createSetStateTool(instanceMap: Map<string, Service>): WebMcpToolDefinition {
  return {
    name: 'set_state',
    description:
      '直接修改指定 Service 实例的状态属性值。仅允许修改已存在的公开状态属性（非函数、非私有）。修改会触发响应式更新，驱动页面重渲染。',
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
