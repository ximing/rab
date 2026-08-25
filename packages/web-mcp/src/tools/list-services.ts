/**
 * list_services Tool 实现
 *
 * 遍历 Container 树，只扫描已实例化（definition.instance 存在）的 Service
 * 返回每个实例的描述信息，供 AI Agent 发现可操作的 Service
 *
 * 增强：将 stateKeys 细化为 scalarState（基本类型字段及其类型）和 objectState（复杂对象字段名列表），
 * 供 Agent 快速了解可直接断言的字段，以及可通过点分路径深入的字段。
 */

import type { Service } from '@rabjs/service';

import type { ActionDescriptor, ListServicesResult, ServiceDescriptor } from '../types';
import { getIdentifierLabel, getIdentifierType } from '../utils/identifier';
import { getMcpToolMetadataList } from '../utils/reflect';
import { resolveSchema } from '../utils/schema';

/**
 * 判断属性名是否为私有属性
 * 规则：以 _ 或 $ 开头，除 $model 外
 */
function isPrivateKey(key: string): boolean {
  if (key === '$model') return false;
  return key.startsWith('_') || key.startsWith('$');
}

/**
 * 构建 Service 实例的 scalarState 和 objectState
 *
 * scalarState：基本类型（string/number/boolean/null）的字段及其当前类型
 * objectState：复杂类型（object/array）字段的名称列表（不展开内容）
 */
function buildStateCategories(instance: Service): {
  scalarState: Record<string, 'string' | 'number' | 'boolean' | 'null'>;
  objectState: string[];
} {
  const scalarState: Record<string, 'string' | 'number' | 'boolean' | 'null'> = {};
  const objectState: string[] = [];

  for (const key of Object.keys(instance)) {
    if (key === 'instanceId') continue;
    if (isPrivateKey(key)) continue;

    const value = (instance as any)[key];
    if (typeof value === 'function') continue;

    if (value === null) {
      scalarState[key] = 'null';
    } else if (typeof value === 'string') {
      scalarState[key] = 'string';
    } else if (typeof value === 'number') {
      scalarState[key] = 'number';
    } else if (typeof value === 'boolean') {
      scalarState[key] = 'boolean';
    } else if (typeof value === 'object') {
      // 包括 Array 和普通 object，统一归入 objectState
      objectState.push(key);
    }
    // undefined 值忽略（未初始化的字段）
  }

  return { scalarState, objectState };
}

/**
 * 构建 Service 实例的 actions 列表
 * 包含所有公开方法，标注哪些有 @mcpTool 注解
 */
function buildActions(instance: Service): ActionDescriptor[] {
  const actions: ActionDescriptor[] = [];
  const prototype = Object.getPrototypeOf(instance);

  // 收集所有 @mcpTool 元数据
  const mcpToolMetaList = getMcpToolMetadataList(prototype);
  const mcpToolMetaMap = new Map(mcpToolMetaList.map(m => [m.methodName, m]));

  // 遍历原型链上的方法（与 Service.__getMethodNames 保持一致的过滤逻辑）
  const methodNames = new Set<string>();
  let current: object | null = prototype;

  while (current && current !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === 'constructor') continue;
      if (name.startsWith('_')) continue;
      if (methodNames.has(name)) continue;

      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor?.value && typeof descriptor.value === 'function') {
        // 过滤掉 Service 基类本身的方法（on/off/once/emit/resolve/destroy）
        const serviceBaseNames = new Set(['on', 'off', 'once', 'emit', 'resolve', 'destroy']);
        if (!serviceBaseNames.has(name)) {
          methodNames.add(name);
        }
      }
    }
    current = Object.getPrototypeOf(current);
  }

  for (const name of methodNames) {
    const mcpMeta = mcpToolMetaMap.get(name);
    const actionDesc: ActionDescriptor = {
      name,
      hasMcpTool: !!mcpMeta,
    };

    if (mcpMeta) {
      actionDesc.description = mcpMeta.options.description;
      actionDesc.inputSchema = resolveSchema(mcpMeta.options, prototype, name);
    }

    actions.push(actionDesc);
  }

  return actions;
}

/**
 * 从单个 Container 中收集已实例化的 Service 描述列表
 */
function collectFromContainer(
  container: import('@rabjs/service').Container,
  result: ServiceDescriptor[]
): void {
  const containerName = String(container.getName());
  const definitions = container.getServiceDefinitions();

  for (const definition of definitions) {
    // 只处理已实例化的 Service
    if (!definition.instance) continue;

    const instance = definition.instance as Service;
    if (!instance.instanceId) continue; // Transient 或未完成实例化的跳过

    const identifierLabel = getIdentifierLabel(definition.identifier);
    const identifierType = getIdentifierType(definition.identifier);
    const { scalarState, objectState } = buildStateCategories(instance);

    result.push({
      instanceId: instance.instanceId,
      containerName,
      identifierType,
      identifierLabel,
      scope: definition.scope,
      actions: buildActions(instance),
      scalarState,
      objectState,
    });
  }

  // 递归遍历子容器
  for (const child of container.getChildren()) {
    collectFromContainer(child, result);
  }
}

/**
 * 执行 list_services Tool
 *
 * @param rootContainer 根容器（从这里开始遍历整个 Container 树）
 * @returns 已实例化 Service 的描述列表
 */
export function executeListServices(
  rootContainer: import('@rabjs/service').Container
): ListServicesResult {
  const services: ServiceDescriptor[] = [];
  collectFromContainer(rootContainer, services);
  return { services };
}

/**
 * list_services Tool 的 WebMCP 定义
 */
export function createListServicesTool(
  rootContainer: import('@rabjs/service').Container
): import('../types').WebMcpToolDefinition {
  return {
    name: 'list_services',
    description:
      '列出页面中所有已激活的 Service 实例，获取它们的 instanceId、可用方法、scalarState（基本类型状态字段）和 objectState（复杂对象字段名，可通过点分路径深入）',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: () => executeListServices(rootContainer),
  };
}
