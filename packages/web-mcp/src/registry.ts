/**
 * McpRegistry - 全局 Container 树遍历注册器
 *
 * 持有 rootContainer（globalContainer），在每次 Tool 调用时实时遍历 Container 树，
 * 收集所有已实例化的 Service 实例，构建 instanceId → instance 的路由 Map。
 *
 * 适用场景：
 * - React / 多 Container 场景（bindServices 创建了多个子容器）
 * - 只需在应用入口调用一次 McpRegistry.getInstance().mount()
 *
 * 与 McpBridge 的关系：
 * - McpRegistry 遍历全局 Container 树，自动感知所有容器
 * - McpBridge 绑定到指定的单个 Container，适合手动控制场景
 */

import type { Container, Service } from '@rabjs/service';
import { getGlobalContainer } from '@rabjs/service';

import { assertState as assertStateFn } from './tools/assert-state';
import { createAssertStateTool } from './tools/assert-state';
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

/**
 * 注销句柄
 */
interface UnregisterHandle {
  unregister(): void;
}

/**
 * McpRegistry 全局注册器
 *
 * 单例模式，通过 McpRegistry.getInstance() 获取
 */
export class McpRegistry {
  private static instance: McpRegistry;

  /** 已注册的 Tool 注销句柄 */
  private unregisterHandles: UnregisterHandle[] = [];

  /** 是否已挂载 */
  private mounted: boolean = false;

  /**
   * 已注册为独立 Tool 的 instanceId + methodName 组合，避免重复注册
   * key: `${instanceId}::${methodName}`
   */
  private registeredMcpToolKeys: Set<string> = new Set();

  /**
   * 待注册的 @mcpTool 队列
   * 在 mount() 之前收集到的 @mcpTool 实例和元数据，等 mount() 执行后批量注册
   */
  private pendingMcpTools: Array<{ instance: Service; meta: McpToolMetadata }> = [];

  /**
   * 已订阅的 Container 事件监听器，用于精准移除（避免 removeAllListeners 误伤其他代码）
   * 使用 WeakMap 以允许 Container 被 GC 回收时自动释放
   */
  private containerListeners: WeakMap<Container, {
    onInstantiated: (instance: Service) => void;
    onChildAdded: (child: Container) => void;
  }> = new WeakMap();

  /**
   * 所有已订阅的 Container 实例集合（配合 WeakMap 精准取消订阅用）
   * 注：持有容器的强引用，但 unmount() 时会完全清理。
   * 已销毁容器（destroy 后）内存极小，不影响实际使用。
   */
  private subscribedContainers: Set<Container> = new Set();

  private constructor() {
    // 立即开始监听 Container 树事件，这样不会错过任何 Service 实例化事件
    // 无论 mount() 的 async 代码何时执行，都能捕获到所有 Service 实例化
    this.subscribeContainerEvents(getGlobalContainer());
  }

  /**
   * 获取单例实例
   */
  static getInstance(): McpRegistry {
    if (!McpRegistry.instance) {
      McpRegistry.instance = new McpRegistry();
    }
    return McpRegistry.instance;
  }

  /**
   * 递归遍历 Container 树，收集所有已实例化的 Service 实例
   * 以 instanceId 为 key 构建路由 Map
   *
   * 每次 Tool 调用时重新构建，保证实时性
   */
  buildInstanceMap(): Map<string, Service> {
    const map = new Map<string, Service>();
    this.walkContainer(getGlobalContainer(), map);
    return map;
  }

  /**
   * 递归遍历单个容器及其子容器
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
   * 挂载 WebMCP，注册三个通用 Tools 和所有 @mcpTool 独立 Tools
   *
   * 调用后 AI Agent 即可通过 WebMCP 协议与页面中的所有 Service 交互
   *
   * @example
   * ```typescript
   * // app/main.tsx
   * import { McpRegistry } from '@rabjs/web-mcp';
   * McpRegistry.getInstance().mount();
   * ```
   */
  async mount(): Promise<void> {
    if (this.mounted) {
      console.warn('[rs-web-mcp] McpRegistry is already mounted. Call unmount() first if you want to re-mount.');
      return;
    }

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

    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- navigator.modelContext is a browser API used at runtime
    if (!navigator.modelContext) {
      console.warn('[rs-web-mcp] navigator.modelContext is not available. WebMCP may not be supported in this environment.');
      return;
    }

    const rootContainer = getGlobalContainer();

    // 构建懒加载 instanceMap 的工厂函数（每次调用时实时遍历）
    // eslint-disable-next-line unicorn/consistent-function-scoping -- captures `this` context for instance map building
    const getLiveInstanceMap = (): Map<string, Service> => this.buildInstanceMap();

    // 注册五个通用 Tools（instanceMap 在每次执行时动态构建，保证实时性）
    this.registerTool(
      createListServicesTool(rootContainer)
    );

    this.registerTool({
      name: 'execute_action',
      description: '执行指定 Service 实例的某个方法。需要先通过 list_services 获取 instanceId。支持可选的 assertAfter 参数，在一次调用内完成"操作 + 断言"',
      inputSchema: {
        type: 'object',
        properties: {
          instanceId: { type: 'string', description: 'Service 实例的唯一标识符，通过 list_services 获取' },
          action: { type: 'string', description: '要执行的方法名' },
          args: { type: 'array', description: '方法参数数组，顺序与方法签名一致', items: {} },
          assertAfter: {
            type: 'array',
            description: '可选：执行方法后立即运行的断言列表',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '点分路径' },
                op: { type: 'string', description: '断言操作符' },
                expected: { description: '期望值' },
                message: { type: 'string', description: '断言说明' },
              },
              required: ['path', 'op'],
            },
          },
        },
        required: ['instanceId', 'action', 'args'],
      },
      execute: (input: unknown) => {
        const { instanceId, action, args, assertAfter } = input as { instanceId: string; action: string; args: unknown[]; assertAfter?: import('./types').Assertion[] };
        return executeActionFn(getLiveInstanceMap(), { instanceId, action, args: args ?? [], assertAfter });
      },
    });

    this.registerTool({
      name: 'get_state',
      description: '获取指定 Service 实例的状态快照。标量字段返回当前值，复杂对象字段只返回类型摘要（"[Object]"/"[Array(N)]"）以避免大对象序列化 crash。如需验证对象内部，请使用 assert_state + 点分路径。',
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
            description: '要修改的状态键值对，key 为属性名，value 为新值',
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

    this.registerTool({
      name: 'assert_state',
      description: '验证指定 Service 实例的状态是否符合预期。支持批量断言，一次调用返回完整断言报告。断言在浏览器内执行，中间节点不序列化，彻底规避大对象 crash。',
      inputSchema: {
        type: 'object',
        properties: {
          instanceId: { type: 'string', description: 'Service 实例的唯一标识符，通过 list_services 获取' },
          assertions: {
            type: 'array',
            description: '断言列表，一次调用支持多个断言',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '点分路径，支持数组下标（.数字 形式）' },
                op: {
                  type: 'string',
                  enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'notExists', 'includes', 'notIncludes', 'matches', 'type', 'length', 'lengthGt', 'lengthGte', 'lengthLt', 'lengthLte', 'deepEq', 'between', 'hasKeys', 'matchObject', 'some', 'every'],
                  description: '断言操作符。between: 闭区间 [lo,hi]；hasKeys: 对象包含指定 key（string 或 string[]）；matchObject: 对象浅层匹配；some/every: 数组元素断言（expected 为 {path,op,expected}）',
                },
                expected: { description: '期望值' },
                message: { type: 'string', description: '断言说明' },
              },
              required: ['path', 'op'],
            },
          },
          description: { type: 'string', description: '可选：整组断言的描述' },
        },
        required: ['instanceId', 'assertions'],
      },
      execute: (input: unknown) => {
        const { instanceId, assertions, description } = input as { instanceId: string; assertions: import('./types').Assertion[]; description?: string };
        return assertStateFn(getLiveInstanceMap(), { instanceId, assertions: assertions ?? [], description });
      },
    });

    // 如果事件订阅已被清理（如 unmount 后再次 mount），重新订阅容器树事件
    // 确保 mount 后的新实例化事件仍能被捕获
    if (this.subscribedContainers.size === 0) {
      this.subscribeContainerEvents(rootContainer);
    }

    // 先标记为已挂载，后续的 service:instantiated 事件将直接注册（不再进入 pending 队列）
    this.mounted = true;

    // 将 mount() 之前收集到的 pending @mcpTool 批量注册到 WebMCP
    for (const { instance, meta } of this.pendingMcpTools) {
      this.registerIndependentMcpTool(instance, meta);
    }
    this.pendingMcpTools = [];

    // 兜底扫描：处理可能被遗漏的已实例化 Service（如 pending 队列之外的情况）
    this.registerMcpToolsFromContainer(rootContainer);
  }

  /**
   * 递归订阅 Container 树中所有容器的 service:instantiated 和 child:added 事件
   *
   * 阶段一（mount 前）：将 @mcpTool 信息加入 pendingMcpTools 队列
   * 阶段二（mount 后）：直接调用 registerIndependentMcpTool 立即注册
   *
   * 此方法在构造函数中同步调用，确保不会错过任何 Service 实例化事件
   *
   * 注意：保存监听器引用到 containerListeners，以便 unmount 时精准移除，
   * 避免 removeAllListeners 误伤该容器上其他代码注册的监听器
   */
  private subscribeContainerEvents(container: Container): void {
    // 如果已经订阅过该容器，不重复订阅
    if (this.containerListeners.has(container)) return;

    // eslint-disable-next-line unicorn/consistent-function-scoping -- needs access to `this` for registering tools
    const onInstantiated = (instance: Service): void => {
      if (!instance.instanceId) return;
      const prototype = Object.getPrototypeOf(instance);
      const mcpToolMetaList: McpToolMetadata[] = getMcpToolMetadataList(prototype);
      for (const meta of mcpToolMetaList) {
        const key = `${instance.instanceId}::${meta.methodName}`;
        if (this.registeredMcpToolKeys.has(key)) continue;
        this.registeredMcpToolKeys.add(key);

        if (this.mounted) {
          // mount 后直接注册
          this.registerIndependentMcpTool(instance, meta);
        } else {
          // mount 前放入 pending 队列，等 mount 后批量注册
          this.pendingMcpTools.push({ instance, meta });
        }
      }
    };

    const onChildAdded = (child: Container): void => {
      this.subscribeContainerEvents(child);
      // 同时扫描新子容器中已有的实例（如果子容器加入时已有实例）
      this.collectOrRegisterFromContainer(child);
    };

    // 保存监听器引用，用于 unmount 时精准移除
    this.containerListeners.set(container, { onInstantiated, onChildAdded });
    this.subscribedContainers.add(container);

    container.events.on('service:instantiated', onInstantiated);
    container.events.on('child:added', onChildAdded);

    // 递归订阅已有的子容器
    for (const child of container.getChildren()) {
      this.subscribeContainerEvents(child);
    }
  }

  /**
   * 遍历容器，根据当前挂载状态决定直接注册还是放入 pending 队列
   */
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

  /**
   * 卸载，注销所有已注册的 Tools 并清理事件监听
   *
   * 必须同时清理 Container 树上的事件监听，否则 McpRegistry 实例的闭包
   * 会被 EventEmitter 持有引用，导致内存泄露
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
    this.registeredMcpToolKeys.clear();
    this.pendingMcpTools = [];
    this.mounted = false;

    // 精准移除已注册的所有 Container 事件监听，防止内存泄露
    this.unsubscribeAllContainerEvents();
  }

  /**
   * 精准移除所有已订阅的 Container 事件监听器
   *
   * 使用保存的具名监听器引用，通过 off() 精准移除，
   * 避免 removeAllListeners 误伤其他代码注册在同一容器上的监听器
   */
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

  /**
   * 注册单个 WebMCP Tool
   *
   * 自动将 execute 函数的返回值包装为 MCP 标准格式：
   * { content: [{ type: 'text', text: JSON.stringify(result) }] }
   */
  private registerTool(tool: WebMcpToolDefinition): void {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- navigator.modelContext is a browser API used at runtime
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
      // eslint-disable-next-line n/no-unsupported-features/node-builtins -- navigator.modelContext is a browser API used at runtime
      const handle = navigator.modelContext.registerTool(wrappedTool);
      this.unregisterHandles.push(handle);
    } catch (error: unknown) {
      console.error(`[rs-web-mcp] Failed to register tool "${tool.name}":`, error);
    }
  }

  /**
   * 遍历 Container 树，为所有有 @mcpTool 注解的方法注册独立 Tool（去重保护）
   */
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

  /**
   * 为单个 @mcpTool 注解方法注册独立 Tool
   */
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

  /**
   * 检查是否已挂载
   */
  isMounted(): boolean {
    return this.mounted;
  }
}

// 便捷导出工厂函数，用于创建独立的 Tool 定义（与 McpBridge 共享）

/**
 * 根据实时 instanceMap 工厂函数创建三个通用 Tool 定义数组
 */
export function createGenericTools(
  rootContainer: Container,
): WebMcpToolDefinition[] {
  // 使用懒加载：每次 execute 时重新遍历
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
    createAssertStateTool(buildMap()),
  ];
}

/**
 * 内部工具：递归遍历 Container 树收集已实例化 Service
 */
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
