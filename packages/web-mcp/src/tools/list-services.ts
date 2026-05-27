import type { Service } from '@rabjs/service';

import type {
  ActionDescriptor,
  ListServicesResult,
  ServiceDescriptor,
} from '../types';
import { getIdentifierLabel, getIdentifierType } from '../utils/identifier';
import { getMcpToolMetadataList } from '../utils/reflect';
import { resolveSchema } from '../utils/schema';
import { getStateKeys } from '../utils/serialize';

function buildActions(instance: Service): ActionDescriptor[] {
  const actions: ActionDescriptor[] = [];
  const prototype = Object.getPrototypeOf(instance);

  const mcpToolMetaList = getMcpToolMetadataList(prototype);
  const mcpToolMetaMap = new Map(mcpToolMetaList.map(m => [m.methodName, m]));

  const methodNames = new Set<string>();
  let current: object | null = prototype;

  while (current && current !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === 'constructor') continue;
      if (name.startsWith('_')) continue;
      if (methodNames.has(name)) continue;

      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor?.value && typeof descriptor.value === 'function') {
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

function collectFromContainer(
  container: import('@rabjs/service').Container,
  result: ServiceDescriptor[]
): void {
  const containerName = String(container.getName());
  const definitions = container.getServiceDefinitions();

  for (const definition of definitions) {
    if (!definition.instance) continue;

    const instance = definition.instance as Service;
    if (!instance.instanceId) continue;

    const identifierLabel = getIdentifierLabel(definition.identifier);
    const identifierType = getIdentifierType(definition.identifier);

    result.push({
      instanceId: instance.instanceId,
      containerName,
      identifierType,
      identifierLabel,
      scope: definition.scope,
      actions: buildActions(instance),
      stateKeys: getStateKeys(instance),
    });
  }

  for (const child of container.getChildren()) {
    collectFromContainer(child, result);
  }
}

export function executeListServices(
  rootContainer: import('@rabjs/service').Container
): ListServicesResult {
  const services: ServiceDescriptor[] = [];
  collectFromContainer(rootContainer, services);
  return { services };
}

export function createListServicesTool(
  rootContainer: import('@rabjs/service').Container
): import('../types').WebMcpToolDefinition {
  return {
    name: 'list_services',
    description: '列出页面中所有已激活的 Service 实例，获取它们的 instanceId、可用方法和状态键',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: () => executeListServices(rootContainer),
  };
}
