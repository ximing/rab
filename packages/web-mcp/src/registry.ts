import type { Container, Service } from '@rabjs/service';
import { getGlobalContainer } from '@rabjs/service';

import { executeAction as executeActionFn } from './tools/execute-action';
import { createExecuteActionTool } from './tools/execute-action';
import { getState as getStateFn } from './tools/get-state';
import { createGetStateTool } from './tools/get-state';
import { createListServicesTool } from './tools/list-services';
import { setState as setStateFn } from './tools/set-state';
import { createSetStateTool } from './tools/set-state';
import type { McpToolMetadata, WebMcpToolDefinition } from './types';
import { getMcpToolMetadataList } from './utils/reflect';
import { resolveSchema } from './utils/schema';

interface UnregisterHandle {
  unregister(): void;
}

export class McpRegistry {
  private static instance: McpRegistry;

  private unregisterHandles: UnregisterHandle[] = [];
  private mounted: boolean = false;
  private registeredMcpToolKeys: Set<string> = new Set();
  private pendingMcpTools: Array<{ instance: Service; meta: McpToolMetadata }> = [];
  private containerListeners: WeakMap<Container, {
    onInstantiated: (instance: Service) => void;
    onChildAdded: (child: Container) => void;
  }> = new WeakMap();
  private subscribedContainers: Set<Container> = new Set();

  private constructor() {
    this.subscribeContainerEvents(getGlobalContainer());
  }

  static getInstance(): McpRegistry {
    if (!McpRegistry.instance) {
      McpRegistry.instance = new McpRegistry();
    }
    return McpRegistry.instance;
  }

  buildInstanceMap(): Map<string, Service> {
    const map = new Map<string, Service>();
    this.walkContainer(getGlobalContainer(), map);
    return map;
  }

  private walkContainer(container: Container, map: Map<string, Service>): void {
    for (const definition of container.getServiceDefinitions()) {
      if (!definition.instance) continue;

      const svc = definition.instance as Service;
      if (svc.instanceId) {
        map.set(svc.instanceId, svc);
      }
    }

    for (const child of container.getChildren()) {
      this.walkContainer(child, map);
    }
  }

  async mount(): Promise<void> {
    if (this.mounted) {
      console.warn('[web-mcp] McpRegistry is already mounted. Call unmount() first if you want to re-mount.');
      return;
    }

    try {
      const polyfillId = '@mcp-b/global';
      // @ts-ignore -- dynamic optional import
      await import(/* @vite-ignore */ polyfillId);
    } catch {
      // polyfill 加载失败，继续尝试使用原生 navigator.modelContext
    }

    if (!navigator.modelContext) {
      console.warn('[web-mcp] navigator.modelContext is not available. WebMCP may not be supported in this environment.');
      return;
    }

    const rootContainer = getGlobalContainer();

    const getLiveInstanceMap = (): Map<string, Service> => this.buildInstanceMap();

    this.registerTool(createListServicesTool(rootContainer));

    this.registerTool({
      name: 'execute_action',
      description: '执行指定 Service 实例的某个方法。需要先通过 list_services 获取 instanceId',
      inputSchema: {
        type: 'object',
        properties: {
          instanceId: { type: 'string', description: 'Service 实例的唯一标识符，通过 list_services 获取' },
          action: { type: 'string', description: '要执行的方法名' },
          args: { type: 'array', description: '方法参数数组，顺序与方法签名一致', items: {} },
        },
        required: ['instanceId', 'action', 'args'],
      },
      execute: (input: unknown) => {
        const { instanceId, action, args } = input as { instanceId: string; action: string; args: unknown[] };
        return executeActionFn(getLiveInstanceMap(), { instanceId, action, args: args ?? [] });
      },
    });

    this.registerTool({
      name: 'get_state',
      description: '获取指定 Service 实例的状态快照，包含数据属性和方法的 loading/error 状态',
      inputSchema: {
        type: 'object',
        properties: {
          instanceId: { type: 'string', description: 'Service 实例的唯一标识符，通过 list_services 获取' },
          keys: { type: 'array', description: '可选，指定要读取的状态属性名列表，不传则返回全部', items: { type: 'string' } },
        },
        required: ['instanceId'],
      },
      execute: (input: unknown) => {
        const { instanceId, keys } = input as { instanceId: string; keys?: string[] };
        return getStateFn(getLiveInstanceMap(), { instanceId, keys });
      },
    });

    this.registerTool({
      name: 'set_state',
      description: '直接修改指定 Service 实例的状态属性值。仅允许修改已存在的公开状态属性（非函数、非私有）。修改会触发响应式更新，驱动页面重渲染。',
      inputSchema: {
        type: 'object',
        properties: {
          instanceId: { type: 'string', description: 'Service 实例的唯一标识符，通过 list_services 获取' },
          patch: {
            type: 'object',
            description: '要修改的状态键值对，key 为属性名（必须在 stateKeys 列表中），value 为新值',
            additionalProperties: true,
          },
        },
        required: ['instanceId', 'patch'],
      },
      execute: (input: unknown) => {
        const { instanceId, patch } = input as { instanceId: string; patch: Record<string, unknown> };
        return setStateFn(getLiveInstanceMap(), { instanceId, patch: patch ?? {} });
      },
    });

    if (this.subscribedContainers.size === 0) {
      this.subscribeContainerEvents(rootContainer);
    }

    this.mounted = true;

    for (const { instance, meta } of this.pendingMcpTools) {
      this.registerIndependentMcpTool(instance, meta);
    }
    this.pendingMcpTools = [];

    this.registerMcpToolsFromContainer(rootContainer);
  }

  private subscribeContainerEvents(container: Container): void {
    if (this.containerListeners.has(container)) return;

    const onInstantiated = (instance: Service): void => {
      if (!instance.instanceId) return;
      const prototype = Object.getPrototypeOf(instance);
      const mcpToolMetaList: McpToolMetadata[] = getMcpToolMetadataList(prototype);
      for (const meta of mcpToolMetaList) {
        const key = `${instance.instanceId}::${meta.methodName}`;
        if (this.registeredMcpToolKeys.has(key)) continue;
        this.registeredMcpToolKeys.add(key);

        if (this.mounted) {
          this.registerIndependentMcpTool(instance, meta);
        } else {
          this.pendingMcpTools.push({ instance, meta });
        }
      }
    };

    const onChildAdded = (child: Container): void => {
      this.subscribeContainerEvents(child);
      this.collectOrRegisterFromContainer(child);
    };

    this.containerListeners.set(container, { onInstantiated, onChildAdded });
    this.subscribedContainers.add(container);

    container.events.on('service:instantiated', onInstantiated);
    container.events.on('child:added', onChildAdded);

    for (const child of container.getChildren()) {
      this.subscribeContainerEvents(child);
    }
  }

  private collectOrRegisterFromContainer(container: Container): void {
    for (const definition of container.getServiceDefinitions()) {
      if (!definition.instance) continue;
      const instance = definition.instance as Service;
      if (!instance.instanceId) continue;

      const prototype = Object.getPrototypeOf(instance);
      const mcpToolMetaList: McpToolMetadata[] = getMcpToolMetadataList(prototype);

      for (const meta of mcpToolMetaList) {
        const key = `${instance.instanceId}::${meta.methodName}`;
        if (this.registeredMcpToolKeys.has(key)) continue;
        this.registeredMcpToolKeys.add(key);

        if (this.mounted) {
          this.registerIndependentMcpTool(instance, meta);
        } else {
          this.pendingMcpTools.push({ instance, meta });
        }
      }
    }

    for (const child of container.getChildren()) {
      this.collectOrRegisterFromContainer(child);
    }
  }

  unmount(): void {
    for (const handle of this.unregisterHandles) {
      try {
        handle.unregister();
      } catch {
        // 忽略注销错误
      }
    }
    this.unregisterHandles = [];
    this.registeredMcpToolKeys.clear();
    this.pendingMcpTools = [];
    this.mounted = false;

    this.unsubscribeAllContainerEvents();
  }

  private unsubscribeAllContainerEvents(): void {
    for (const container of this.subscribedContainers) {
      const listeners = this.containerListeners.get(container);
      if (listeners) {
        container.events.off('service:instantiated', listeners.onInstantiated);
        container.events.off('child:added', listeners.onChildAdded);
        this.containerListeners.delete(container);
      }
    }
    this.subscribedContainers.clear();
  }

  private registerTool(tool: WebMcpToolDefinition): void {
    if (!navigator.modelContext) return;

    try {
      const wrappedTool: WebMcpToolDefinition = {
        ...tool,
        execute: async (input: unknown) => {
          const result = await tool.execute(input);
          if (result && typeof result === 'object' && 'content' in result) {
            return result;
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        },
      };
      const handle = navigator.modelContext.registerTool(wrappedTool);
      this.unregisterHandles.push(handle);
    } catch (error: unknown) {
      console.error(`[web-mcp] Failed to register tool "${tool.name}":`, error);
    }
  }

  private registerMcpToolsFromContainer(container: Container): void {
    for (const definition of container.getServiceDefinitions()) {
      if (!definition.instance) continue;

      const instance = definition.instance as Service;
      if (!instance.instanceId) continue;

      const prototype = Object.getPrototypeOf(instance);
      const mcpToolMetaList: McpToolMetadata[] = getMcpToolMetadataList(prototype);

      for (const meta of mcpToolMetaList) {
        const key = `${instance.instanceId}::${meta.methodName}`;
        if (!this.registeredMcpToolKeys.has(key)) {
          this.registeredMcpToolKeys.add(key);
          this.registerIndependentMcpTool(instance, meta);
        }
      }
    }

    for (const child of container.getChildren()) {
      this.registerMcpToolsFromContainer(child);
    }
  }

  private registerIndependentMcpTool(
    instance: Service,
    meta: McpToolMetadata
  ): void {
    const serviceClassName = instance.constructor?.name || 'Service';
    const toolName = meta.options.name ?? `${serviceClassName}__${meta.methodName}`;
    const prototype = Object.getPrototypeOf(instance);
    const inputSchema = resolveSchema(meta.options, prototype, meta.methodName);

    this.registerTool({
      name: toolName,
      description: meta.options.description,
      inputSchema: {
        type: 'object',
        properties: {
          instanceId: {
            type: 'string',
            description: 'Service 实例的唯一标识符，通过 list_services 获取',
          },
          args: {
            ...inputSchema,
            description: '方法参数，语义等同 Function.apply(instance, args)',
          },
        },
        required: ['instanceId', 'args'],
      },
      execute: async (input: unknown) => {
        const { instanceId, args } = input as { instanceId: string; args: unknown[] };
        const liveMap = this.buildInstanceMap();
        const { executeAction } = await import('./tools/execute-action');
        return executeAction(liveMap, {
          instanceId,
          action: meta.methodName,
          args: Array.isArray(args) ? args : [],
        });
      },
    });
  }

  isMounted(): boolean {
    return this.mounted;
  }
}

export function createGenericTools(
  rootContainer: Container,
): WebMcpToolDefinition[] {
  const buildMap = (): Map<string, Service> => {
    const map = new Map<string, Service>();
    walkContainer(rootContainer, map);
    return map;
  };

  return [
    createListServicesTool(rootContainer),
    createExecuteActionTool(buildMap()),
    createGetStateTool(buildMap()),
    createSetStateTool(buildMap()),
  ];
}

function walkContainer(container: Container, map: Map<string, Service>): void {
  for (const definition of container.getServiceDefinitions()) {
    if (!definition.instance) continue;
    const svc = definition.instance as Service;
    if (svc.instanceId) {
      map.set(svc.instanceId, svc);
    }
  }
  for (const child of container.getChildren()) {
    walkContainer(child, map);
  }
}
