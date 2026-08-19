/**
 * McpBridge - 单 Container 快速接入
 *
 * 将一个指定的 Container 绑定到 WebMCP，自动发现容器内所有已实例化 Service。
 * 适用场景：单 Container 或手动管理 Container 的场景。
 *
 * 多 Container（React bindServices）场景请使用 McpRegistry。
 *
 * @example
 * ```typescript
 * import { McpBridge } from '@rabjs/web-mcp';
 * import { Container } from '@rabjs/service';
 *
 * const container = new Container({ name: 'app' });
 * container.register(CartService);
 * container.resolve(CartService); // 触发实例化
 *
 * const bridge = new McpBridge();
 * await bridge.mount(container);
 *
 * // 卸载
 * bridge.unmount();
 * ```
 */

import type { Container, Service } from '@rabjs/service';

import { executeAction } from './tools/execute-action';
import { createExecuteActionTool } from './tools/execute-action';
import { createGetStateTool } from './tools/get-state';
import { createListServicesTool } from './tools/list-services';
import { createSetStateTool } from './tools/set-state';
import type { McpToolMetadata, WebMcpToolDefinition } from './types';
import { getMcpToolMetadataList } from './utils/reflect';
import { resolveSchema } from './utils/schema';

/**
 * 注销句柄
 */
interface UnregisterHandle {
  unregister(): void;
}

/**
 * McpBridge - 单 Container 快速接入
 */
export class McpBridge {
  /** 绑定的 Container */
  private container: Container | null = null;

  /** 已注册的 Tool 注销句柄 */
  private unregisterHandles: UnregisterHandle[] = [];

  /** 是否已挂载 */
  private mounted: boolean = false;

  /**
   * 挂载到指定容器
   * 自动注册三个通用 Tools + 业务 @mcpTool Tools
   *
   * @param container 要绑定的 Container
   */
  async mount(container: Container): Promise<void> {
    if (this.mounted) {
      console.warn(
        '[rs-web-mcp] McpBridge is already mounted. Call unmount() first if you want to re-mount.'
      );
      return;
    }

    this.container = container;

    // 动态 import WebMCP polyfill，避免 SSR/Node 环境报错
    // @mcp-b/global 是可选的 polyfill，不强依赖
    try {
      // 通过变量绕过 Vite 静态分析，@mcp-b/global 是可选的 polyfill，不存在时静默忽略
      const polyfillId = '@mcp-b/global';
      // @ts-ignore -- dynamic optional import
      await import(/* @vite-ignore */ polyfillId);
    } catch {
      // polyfill 加载失败，继续尝试使用原生 navigator.modelContext
    }

    // navigator.modelContext is a browser API used at runtime
    if (!navigator.modelContext) {
      console.warn(
        '[rs-web-mcp] navigator.modelContext is not available. WebMCP may not be supported in this environment.'
      );
      return;
    }

    // 构建初始 instanceMap（以 Container 为根遍历）
    const instanceMap = this.buildInstanceMap(container);

    // 注册四个通用 Tools
    this.registerTool(createListServicesTool(container));
    this.registerTool(createExecuteActionTool(instanceMap));
    this.registerTool(createGetStateTool(instanceMap));
    this.registerTool(createSetStateTool(instanceMap));

    // 扫描 @mcpTool 注解，注册独立 Tools
    this.registerMcpToolsFromContainer(container, instanceMap);

    this.mounted = true;
  }

  /**
   * 卸载，注销所有已注册的 Tools
   */
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

  /**
   * 手动注册额外 Service（不在容器内的场景）
   * 注意：此方法仅在 mount() 之后调用才有效
   *
   * @param name Service 名称（作为 instanceId 前缀）
   * @param instance Service 实例
   */
  addService(_name: string, _instance: Service): void {
    console.warn(
      '[rs-web-mcp] addService() is not yet implemented. Use McpRegistry for dynamic service discovery.'
    );
  }

  /**
   * 检查是否已挂载
   */
  isMounted(): boolean {
    return this.mounted;
  }

  /**
   * 遍历 Container 树构建 instanceId → Service 路由 Map
   */
  private buildInstanceMap(container: Container): Map<string, Service> {
    const map = new Map<string, Service>();
    this.walkContainer(container, map);
    return map;
  }

  /**
   * 递归遍历 Container 树
   */
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

  /**
   * 注册单个 WebMCP Tool
   *
   * 自动将 execute 函数的返回值包装为 MCP 标准格式：
   * { content: [{ type: 'text', text: JSON.stringify(result) }] }
   */
  private registerTool(tool: WebMcpToolDefinition): void {
    // navigator.modelContext is a browser API used at runtime
    if (!navigator.modelContext) return;

    try {
      // 包装 execute 函数，将返回值转换为 MCP 标准格式
      const wrappedTool: WebMcpToolDefinition = {
        ...tool,
        execute: async (input: unknown) => {
          const result = await tool.execute(input);
          // 如果已经是 MCP 格式（有 content 字段），直接返回
          if (result && typeof result === 'object' && 'content' in result) {
            return result;
          }
          // 否则包装为 MCP 标准格式
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        },
      };
      // navigator.modelContext is a browser API used at runtime
      const handle = navigator.modelContext.registerTool(wrappedTool);
      this.unregisterHandles.push(handle);
    } catch (error: unknown) {
      console.error(`[rs-web-mcp] Failed to register tool "${tool.name}":`, error);
    }
  }

  /**
   * 遍历 Container 树，为所有有 @mcpTool 注解的方法注册独立 Tool
   */
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

  /**
   * 为单个 @mcpTool 注解方法注册独立 Tool
   */
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
