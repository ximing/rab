import type { Container, Service } from '@rabjs/service';

import { executeAction } from './tools/execute-action';
import { createExecuteActionTool } from './tools/execute-action';
import { createGetStateTool } from './tools/get-state';
import { createListServicesTool } from './tools/list-services';
import { createSetStateTool } from './tools/set-state';
import type { McpToolMetadata, WebMcpToolDefinition } from './types';
import { getMcpToolMetadataList } from './utils/reflect';
import { resolveSchema } from './utils/schema';

interface UnregisterHandle {
  unregister(): void;
}

export class McpBridge {
  private container: Container | null = null;
  private unregisterHandles: UnregisterHandle[] = [];
  private mounted: boolean = false;

  async mount(container: Container): Promise<void> {
    if (this.mounted) {
      console.warn('[web-mcp] McpBridge is already mounted. Call unmount() first if you want to re-mount.');
      return;
    }

    this.container = container;

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

    const instanceMap = this.buildInstanceMap(container);

    this.registerTool(createListServicesTool(container));
    this.registerTool(createExecuteActionTool(instanceMap));
    this.registerTool(createGetStateTool(instanceMap));
    this.registerTool(createSetStateTool(instanceMap));

    this.registerMcpToolsFromContainer(container, instanceMap);

    this.mounted = true;
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
    this.container = null;
    this.mounted = false;
  }

  addService(_name: string, _instance: Service): void {
    console.warn('[web-mcp] addService() is not yet implemented. Use McpRegistry for dynamic service discovery.');
  }

  isMounted(): boolean {
    return this.mounted;
  }

  private buildInstanceMap(container: Container): Map<string, Service> {
    const map = new Map<string, Service>();
    this.walkContainer(container, map);
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

  private registerMcpToolsFromContainer(
    container: Container,
    instanceMap: Map<string, Service>
  ): void {
    for (const definition of container.getServiceDefinitions()) {
      if (!definition.instance) continue;

      const instance = definition.instance as Service;
      if (!instance.instanceId) continue;

      const prototype = Object.getPrototypeOf(instance);
      const mcpToolMetaList: McpToolMetadata[] = getMcpToolMetadataList(prototype);

      for (const meta of mcpToolMetaList) {
        this.registerIndependentMcpTool(instance, meta, instanceMap);
      }
    }

    for (const child of container.getChildren()) {
      this.registerMcpToolsFromContainer(child, instanceMap);
    }
  }

  private registerIndependentMcpTool(
    instance: Service,
    meta: McpToolMetadata,
    instanceMap: Map<string, Service>
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
      execute: (input: unknown) => {
        const { instanceId, args } = input as { instanceId: string; args: unknown[] };
        return executeAction(instanceMap, {
          instanceId,
          action: meta.methodName,
          args: Array.isArray(args) ? args : [],
        });
      },
    });
  }
}
