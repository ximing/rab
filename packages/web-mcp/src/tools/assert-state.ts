/**
 * assert_state Tool 实现
 *
 * 核心设计：断言在浏览器内部执行，只传出标量结果，彻底规避大对象序列化 crash。
 * 通过 resolvePath 按点分路径读取末端值参与计算，中间节点不序列化、不传输。
 */

import type { Service } from '@rabjs/service';

import type { AssertStateInput, AssertStateResult, WebMcpToolDefinition } from '../types';
import { executeAssertions } from '../utils/assert';

/**
 * 执行 assert_state Tool
 *
 * @param instanceMap instanceId → Service 实例的路由 Map
 * @param input 工具输入参数
 * @returns 断言汇总结果
 */
export function assertState(
  instanceMap: Map<string, Service>,
  input: AssertStateInput
): AssertStateResult {
  const { instanceId, assertions } = input;

  // 查找实例
  const instance = instanceMap.get(instanceId);
  if (!instance) {
    // 实例不存在时，所有断言都标记为失败，返回统一错误
    const errorMsg = `Service instance not found: instanceId="${instanceId}". Call list_services to get valid instanceIds.`;
    return {
      passed: false,
      summary: { passed: 0, total: assertions.length },
      results: assertions.map(assertion => ({
        path: assertion.path,
        op: assertion.op,
        expected: assertion.expected,
        actual: undefined,
        passed: false,
        message: assertion.message,
        error: errorMsg,
      })),
    };
  }

  // 空断言列表视为通过
  if (assertions.length === 0) {
    return {
      passed: true,
      summary: { passed: 0, total: 0 },
      results: [],
    };
  }

  return executeAssertions(instance, assertions);
}

/**
 * assert_state Tool 的 WebMCP 定义
 */
export function createAssertStateTool(instanceMap: Map<string, Service>): WebMcpToolDefinition {
  return {
    name: 'assert_state',
    description:
      '验证指定 Service 实例的状态是否符合预期。支持批量断言，一次调用返回完整断言报告。断言在浏览器内执行，中间节点不序列化，彻底规避大对象 crash。',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: {
          type: 'string',
          description: 'Service 实例的唯一标识符，通过 list_services 获取',
        },
        assertions: {
          type: 'array',
          description: '断言列表，一次调用支持多个断言',
          items: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description:
                  '点分路径，支持数组下标（.数字 形式）：如 "isInitialized"、"ladingMonitorData.list.length"、"ladingMonitorData.list.0.status"',
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
                  'between',
                  'hasKeys',
                  'matchObject',
                  'some',
                  'every',
                ],
                description:
                  '断言操作符。between: 闭区间 [lo,hi]；hasKeys: 对象包含指定 key（string 或 string[]）；matchObject: 对象浅层匹配（expected 为键值对）；some/every: 数组元素断言（expected 为 {path,op,expected}）',
              },
              expected: {
                description:
                  '期望值。exists/notExists 时不需要传；type 时传 typeof 字符串如 "string"；matches 时传正则字符串如 "^route-"；between 时传 [lo, hi]；hasKeys 时传 string 或 string[]；matchObject/some/every 时传对应结构',
              },
              message: {
                type: 'string',
                description: '可选：这条断言的说明，出现在失败报告里',
              },
            },
            required: ['path', 'op'],
          },
        },
        description: {
          type: 'string',
          description: '可选：整组断言的描述，出现在报告中',
        },
      },
      required: ['instanceId', 'assertions'],
    },
    execute: (input: unknown) => {
      const { instanceId, assertions, description } = input as AssertStateInput;
      return assertState(instanceMap, {
        instanceId,
        assertions: assertions ?? [],
        description,
      });
    },
  };
}
