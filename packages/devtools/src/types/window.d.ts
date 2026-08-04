import type { RSRootContainerHandle } from '../root-container-handle';

declare global {
  interface Window {
    /**
     * RSJS 根容器调试访问接口
     *
     * 通过 `setupWindowRootContainer()` 挂载后可用。
     * 供调试工具、浏览器插件、E2E 测试框架等在框架组件树之外访问 Service 实例。
     *
     * @example
     * // 列出所有已实例化的 Service
     * window.__RS_ROOT_CONTAINER__?.listServices()
     *
     * // 通过 instanceId 获取 Service 实例
     * window.__RS_ROOT_CONTAINER__?.getService('CartService_abc123')
     *
     * // 通过 containerName 获取容器实例
     * window.__RS_ROOT_CONTAINER__?.getContainer('ProductPage_2')
     */
    __RS_ROOT_CONTAINER__?: RSRootContainerHandle;
  }
}

export type { RSRootContainerHandle } from '../root-container-handle';
