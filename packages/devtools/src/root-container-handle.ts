/**
 * window.__RS_ROOT_CONTAINER__ 挂载工具
 *
 * 在浏览器环境下将 global 容器的访问 API 挂载到 window.__RS_ROOT_CONTAINER__，
 * 供调试工具、浏览器插件、E2E 测试框架等在 React 组件树之外访问 Service 实例。
 *
 * 挂载时机：模块初始化时（应用入口调用），与前端框架无关。
 * SSR 安全：通过 typeof window 检测跳过，框架无关。
 */

import { getGlobalContainer } from '@rabjs/service';
import type { Container, Service } from '@rabjs/service';

import { RSExpectBuilder } from './assert/expect';

/**
 * 递归遍历 Container 树，通过 instanceId 查找 Service 实例
 */
function walkContainerForInstanceId(
  container: Container,
  instanceId: string
): Service | undefined {
  for (const definition of container.getServiceDefinitions()) {
    if (!definition.instance) continue;
    const svc = definition.instance as Service;
    if ((svc as Service & { instanceId?: string }).instanceId === instanceId) return svc;
  }
  for (const child of container.getChildren()) {
    const found = walkContainerForInstanceId(child, instanceId);
    if (found) return found;
  }
  return undefined;
}

/**
 * 递归遍历 Container 树，通过 containerName 查找容器
 */
function walkContainerForName(
  container: Container,
  containerName: string
): Container | undefined {
  if (String(container.getName()) === containerName) return container;
  for (const child of container.getChildren()) {
    const found = walkContainerForName(child, containerName);
    if (found) return found;
  }
  return undefined;
}

/**
 * 挂载到 window 上的根容器访问接口
 */
export interface RSRootContainerHandle {
  /**
   * global 容器实例（容器树的真正根节点）
   * 与 getGlobalContainer() 返回的是同一对象引用
   */
  container: Container;

  /**
   * 通过 instanceId 获取 Service 实例
   *
   * instanceId 由 @rabjs/service 在 Service 实例化时自动生成，
   * 格式通常为 `ClassName_nanoid`，可通过 listServices() 查看。
   *
   * @param instanceId Service 实例的唯一标识符
   * @returns Service 实例，如果未找到则返回 undefined
   *
   * @example
   * window.__RS_ROOT_CONTAINER__.getService('CartService_abc123')
   */
  getService(instanceId: string): Service | undefined;

  /**
   * 通过 containerName 获取容器实例
   *
   * 返回容器内存对象本身，可进一步调用 container.resolve()、container.getChildren() 等方法。
   * containerName 来自 bindServices 的 options.name，或自动生成的 `ComponentName_id` 格式。
   * 可先通过 listServices() 查看各 Service 所在的 containerName。
   *
   * @param containerName 容器名称
   * @returns Container 实例，如果未找到则返回 undefined
   *
   * @example
   * const container = window.__RS_ROOT_CONTAINER__.getContainer('ProductPage_2');
   * container?.getChildren(); // 查看子容器
   */
  getContainer(containerName: string): Container | undefined;

  /**
   * 列出所有已实例化的 Service 内存对象（快照）
   * 用于工作台调试，直接返回 Service 实例引用，开发者可在控制台直接操作
   *
   * 与 web-mcp 的 list_services 不同：MCP 场景需要序列化描述信息供 AI Agent 读取；
   * 工作台场景直接暴露内存对象，方便开发者实时调试。
   *
   * @example
   * // 控制台列出所有 Service
   * window.__RS_ROOT_CONTAINER__.listServices()
   * // => [
   * //   { instanceId: 'CartService_abc', containerName: 'CartDomain_3', identifierLabel: 'CartService', instance: CartService { ... } },
   * //   ...
   * // ]
   *
   * // 直接拿到实例并调用方法
   * window.__RS_ROOT_CONTAINER__.listServices()[0].instance.someMethod()
   */
  listServices(): Array<{
    instanceId: string;
    containerName: string;
    identifierLabel: string;
    instance: Service;
  }>;

  /**
   * 创建针对指定 Service 实例的链式断言构建器
   *
   * @param instanceId Service 实例的唯一标识符（通过 listServices() 查看）
   * @returns RSExpectBuilder 链式断言构建器
   *
   * @example
   * window.__RS_ROOT_CONTAINER__
   *   .expect('CartService_abc')
   *   .toBe('items.length', 3)
   *   .toExist('currentUser')
   *   .check()
   */
  expect(instanceId: string): RSExpectBuilder;
}

/**
 * 创建 RSRootContainerHandle
 * 以 global 容器为根，遍历整棵容器树
 */
export function createRSRootContainerHandle(): RSRootContainerHandle {
  // global 容器是整棵树的根，所有 bindServices 子容器都挂在它下面
  const rootContainer = getGlobalContainer();

  return {
    container: rootContainer,

    getService(instanceId: string) {
      return walkContainerForInstanceId(rootContainer, instanceId);
    },

    getContainer(containerName: string) {
      return walkContainerForName(rootContainer, containerName);
    },

    listServices() {
      const result: Array<{
        instanceId: string;
        containerName: string;
        identifierLabel: string;
        instance: Service;
      }> = [];

      function walk(container: Container) {
        const name = String(container.getName());
        for (const def of container.getServiceDefinitions()) {
          if (!def.instance) continue;
          const svc = def.instance as Service & { instanceId?: string };
          if (!svc.instanceId) continue;
          const label =
            typeof def.identifier === 'function'
              ? (def.identifier as { name?: string }).name || 'AnonymousService'
              : String(def.identifier);
          // 直接返回 Service 内存对象，供工作台调试使用
          result.push({
            instanceId: svc.instanceId,
            containerName: name,
            identifierLabel: label,
            instance: svc,
          });
        }
        for (const child of container.getChildren()) {
          walk(child);
        }
      }

      walk(rootContainer);
      return result;
    },

    expect(instanceId: string) {
      return new RSExpectBuilder(instanceId, (id: string) =>
        walkContainerForInstanceId(rootContainer, id) as object | undefined
      );
    },
  };
}

/**
 * 将 global 容器的访问 API 挂载到 window.__RS_ROOT_CONTAINER__
 * 仅在浏览器环境下执行，SSR 环境（typeof window === 'undefined'）自动跳过
 *
 * 调用时机：应用入口文件初始化时调用一次，与前端框架无关
 *
 * @example
 * // 应用入口（如 main.ts / index.ts）
 * import { setupWindowRootContainer } from '@rabjs/devtools';
 * setupWindowRootContainer();
 */
export function setupWindowRootContainer(): void {
  // 在 Node.js（真实 SSR）环境中 window 不存在，安全跳过
  if (globalThis.window === undefined) return;
  (globalThis.window as Window & typeof globalThis).__RS_ROOT_CONTAINER__ = createRSRootContainerHandle();
}
