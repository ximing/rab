# `window.__RS_ROOT_CONTAINER__` 设计方案

## 背景

在大型前端应用中，开发工具链（如 `@rabjs/web-mcp`、浏览器 DevTools 插件、E2E 测试框架）经常需要在 React 组件树之外访问运行时的 Service 实例。

`@rabjs/service` 的 `getGlobalContainer()` 返回 `global` 容器，这是整个容器树的真正根节点——所有 `bindServices` 创建的子容器（包括 `RSRoot` 的容器）都通过 `setParent` 挂到这棵树上。因此，从 `global` 容器出发可以遍历到页面上所有已实例化的 Service。

本方案的目标是：在非 SSR 环境下，将 `getGlobalContainer()` 及基于它的查询工具函数挂载到 `window.__RS_ROOT_CONTAINER__`，供外部工具访问。

---

## 容器树结构说明

```
global (getGlobalContainer())           ← 真正的根，与 React 无关
  └─ RSRootInner_1                      ← RSRoot 的 bindServices 容器
       └─ ProductPage_2                 ← 页面级 bindServices 容器
            └─ CartDomain_3             ← Domain 级 bindServices 容器
```

**关键事实**：

- `global` 容器由 `@rabjs/service` 在模块加载时懒创建，与 React 生命周期无关
- `bindServices` 每次创建的新容器都调用 `container.setParent(parentContainer)`，默认 parent 是 `global`
- 从 `global` 出发递归遍历子容器，即可访问到所有已实例化的 Service
- **无需等待 RSRoot 挂载**，`global` 容器在应用初始化时就已存在

---

## 目标

1. 在模块加载时（非 React 生命周期）把 `global` 容器的查询 API 挂到 `window.__RS_ROOT_CONTAINER__`
2. 暴露 `getService(instanceId: string)` / `getContainer(containerName: string)` / `listServices()` 方法
3. **SSR 安全**：在 SSR 环境（Node.js，无 `window`）下跳过挂载，不报错
4. 该功能为 **可选增强**，不影响现有业务代码

---

## 非目标

1. 不修改 `@rabjs/service` 的任何 API
2. `window.__RS_ROOT_CONTAINER__` 不作为响应式数据来源，只作调试/工具访问入口
3. 不承诺 `window.__RS_ROOT_CONTAINER__` 是稳定的公开 API（属于内部工具协议）

---

## 设计原则

### 1. 挂载时机：模块初始化时（非 React 生命周期）

> **与原始方案的区别**：原始方案打算在 `RSRoot` 的 `useEffect` 中挂载，理由是"需要等根容器真正存活"。
>
> **实际情况**：`global` 容器与 React 没有任何关联，它在 `getGlobalContainer()` 首次调用时就创建了（模块加载阶段），不存在"被 Concurrent Mode 丢弃"的问题。`RSRoot` 的容器只是 `global` 的一个子节点，没有理由以它为遍历起点。
>
> 因此直接在 `@rabjs/react` 模块初始化时执行挂载，无需涉及任何 React 生命周期。

挂载逻辑放在 `src/domain/root-container-handle.ts` 的模块级代码中，由 `setupWindowRootContainer()` 函数负责，在 `main.ts` 的末尾调用一次即可。

### 2. SSR 兼容：typeof window 检测

由于 `window` 在 SSR 环境（Node.js）中不存在，挂载逻辑通过双重检测跳过：

```ts
if (typeof window !== 'undefined' && !isUsingStaticRendering()) {
  // 挂载逻辑
}
```

`enableStaticRendering(true)` 是 `@rabjs/react` 现有的 SSR 控制开关，复用此标记。

---

## API 设计

### `window.__RS_ROOT_CONTAINER__` 对象接口

```ts
/**
 * 挂载到 window 上的根容器访问接口
 */
interface RSRootContainerHandle {
  /**
   * global 容器实例（容器树的真正根节点）
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
   * container?.resolve(CartService);
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
}
```

### TypeScript 全局类型扩展

在 `@rabjs/react` 的 `types/` 目录下扩展 `Window` 接口：

```ts
// types/window.d.ts
import type { RSRootContainerHandle } from '../domain/root-container-handle';

declare global {
  interface Window {
    __RS_ROOT_CONTAINER__?: RSRootContainerHandle;
  }
}
```

---

## 实现方案

### 1. 工具函数与挂载逻辑

在 `domain/` 下新增 `root-container-handle.ts`：

```ts
// domain/root-container-handle.ts

import { getGlobalContainer } from '@rabjs/service';
import type { Container, Service } from '@rabjs/service';
import { isUsingStaticRendering } from '@rabjs/observer';

/**
 * 递归遍历 Container 树，通过 instanceId 查找 Service 实例
 */
function walkContainerForInstanceId(container: Container, instanceId: string): Service | undefined {
  for (const definition of container.getServiceDefinitions()) {
    if (!definition.instance) continue;
    const svc = definition.instance as Service;
    if (svc.instanceId === instanceId) return svc;
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
function walkContainerForName(container: Container, containerName: string): Container | undefined {
  if (String(container.getName()) === containerName) return container;
  for (const child of container.getChildren()) {
    const found = walkContainerForName(child, containerName);
    if (found) return found;
  }
  return undefined;
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
          const svc = def.instance as Service;
          if (!svc.instanceId) continue;
          const label =
            typeof def.identifier === 'function' ? def.identifier.name : String(def.identifier);
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
  };
}

/**
 * 将 global 容器的访问 API 挂载到 window.__RS_ROOT_CONTAINER__
 * 仅在浏览器环境下执行，SSR 环境自动跳过
 *
 * 调用时机：模块初始化时（main.ts 末尾），与 React 生命周期无关
 */
export function setupWindowRootContainer(): void {
  if (typeof window === 'undefined' || isUsingStaticRendering()) return;
  window.__RS_ROOT_CONTAINER__ = createRSRootContainerHandle();
}

export interface RSRootContainerHandle {
  container: Container;
  getService(instanceId: string): Service | undefined;
  getContainer(containerName: string): Container | undefined;
  listServices(): Array<{
    instanceId: string;
    containerName: string;
    identifierLabel: string;
    instance: Service;
  }>;
}
```

### 2. `main.ts` 中调用挂载

```ts
// src/main.ts 末尾追加
import { setupWindowRootContainer } from './domain/root-container-handle';

// 在浏览器环境下将 global 容器挂到 window，供调试工具访问
setupWindowRootContainer();
```

### 3. 全局类型声明

```ts
// src/types/window.d.ts
import type { RSRootContainerHandle } from '../domain/root-container-handle';

declare global {
  interface Window {
    __RS_ROOT_CONTAINER__?: RSRootContainerHandle;
  }
}

export {};
```

---

## SSR 场景行为

| 场景                     | `typeof window` | `isUsingStaticRendering()` | 行为                                   |
| ------------------------ | --------------- | -------------------------- | -------------------------------------- |
| 浏览器正常渲染           | `'object'`      | `false`                    | ✅ 挂载 `window.__RS_ROOT_CONTAINER__` |
| Next.js SSR（服务端）    | `'undefined'`   | `true`                     | ⛔ 跳过，不挂载                        |
| Next.js 客户端 Hydration | `'object'`      | `false`                    | ✅ 挂载                                |
| SSG 构建时               | `'undefined'`   | `true`                     | ⛔ 跳过，不挂载                        |

> **注意**：使用者在 SSR 框架中需调用 `enableStaticRendering(true)` 声明 SSR 环境。

---

## 使用示例

### 调试控制台

```js
// 浏览器控制台
const handle = window.__RS_ROOT_CONTAINER__;

// 列出所有 Service（直接返回内存对象，包含 global 下所有子容器的 Service）
handle.listServices();
// => [
//   { instanceId: 'CartService_abc', containerName: 'CartDomain_3', identifierLabel: 'CartService', instance: CartService { ... } },
//   ...
// ]

// 直接从 listServices 拿到实例并调用方法
const { instance: cartService } = handle
  .listServices()
  .find(s => s.identifierLabel === 'CartService');
cartService.addItem({ id: '1', name: 'Test' });

// 或通过 instanceId 获取实例
const cartService2 = handle.getService('CartService_abc');
cartService2.addItem({ id: '1', name: 'Test' });

// 通过 containerName 直接获取容器实例
const container = handle.getContainer('ProductPage_2');
container?.resolve(CartService); // 手动 resolve Service
container?.getChildren(); // 查看子容器列表
```

### `@rabjs/web-mcp` 集成

`McpRegistry` 可以直接使用 `window.__RS_ROOT_CONTAINER__` 的 container，而不必调用 `getGlobalContainer()`（两者实际上是同一个对象）：

```ts
// web-mcp/registry.ts（可选优化）
const rootContainer =
  (typeof window !== 'undefined' && window.__RS_ROOT_CONTAINER__?.container) ??
  getGlobalContainer();
```

### E2E 测试（Playwright / Cypress）

```ts
// tests/cart.spec.ts (Playwright)
const cartService = await page.evaluate(() => {
  return window.__RS_ROOT_CONTAINER__?.getService('CartService_abc');
});
```

---

## 边界情况与风险

### 1. Service 在 `listServices` 调用时尚未实例化

`listServices` 只返回 `definition.instance` 已存在的 Service（即已被 `resolve` 过的 Singleton）。Transient Service 和尚未被使用的 Lazy Singleton 不会出现在列表中，这是符合预期的行为。

### 2. 微前端场景下 global 容器共享

如果多个微应用共享同一个 JS 运行时（如 qiankun 沙箱关闭的场景），它们会共享同一个 `global` 容器实例，`listServices` 会返回所有微应用的 Service。这是 `getGlobalContainer()` 本身的特性，不是本方案引入的问题。

---

## 测试方案

### 1. 挂载正确性

- 模块加载后 `window.__RS_ROOT_CONTAINER__` 存在
- `container` 字段与 `getGlobalContainer()` 返回的是同一个对象引用

### 2. `getService` 正确性

- 在 RSRoot 下通过 `bindServices` 注册 CartService 并 resolve
- `window.__RS_ROOT_CONTAINER__.getService(instanceId)` 能拿到正确实例

### 3. `listServices` 正确性

- 多层嵌套容器时，`listServices` 能遍历到所有已实例化的 Service
- 返回结果中的 `instance` 字段为 Service 内存对象引用（非序列化副本），修改后能即时反映到应用状态

### 4. SSR 安全

- 调用 `enableStaticRendering(true)` 后，`setupWindowRootContainer()` 不产生 `window.__RS_ROOT_CONTAINER__`
- Node 环境（无 window）下不报错

---

## 实施步骤

1. 新建 `src/domain/root-container-handle.ts`，实现 `createRSRootContainerHandle`、`setupWindowRootContainer` 和 `RSRootContainerHandle` 接口
2. 新建 `src/types/window.d.ts`，扩展 `Window` 全局类型
3. 在 `src/main.ts` 末尾调用 `setupWindowRootContainer()`
4. 在 `src/domain/index.ts` 导出 `RSRootContainerHandle` 类型
5. 在 `src/main.ts` 透传导出 `RSRootContainerHandle` 类型
6. 编写测试覆盖以上场景

---

## 结论

本方案利用 `getGlobalContainer()` 是整棵容器树的真正根节点这一事实，在模块初始化时（`setupWindowRootContainer()`）直接将 global 容器的访问 API 挂到 `window.__RS_ROOT_CONTAINER__`。

整个方案与 React 生命周期完全无关，不需要修改 `bindServices`、`RSRoot` 或任何现有 API。通过 `typeof window` 和 `isUsingStaticRendering()` 双重检测保证 SSR 安全。
