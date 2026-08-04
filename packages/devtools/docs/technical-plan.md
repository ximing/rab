# `@rabjs/devtools` 技术方案

## 背景与动机

### 现状问题

`window.__RS_ROOT_CONTAINER__` 调试挂载功能目前实现在 `@rabjs/react` 的 `src/domain/root-container-handle.ts` 中，并在 `src/main.ts` 末尾的模块初始化阶段调用 `setupWindowRootContainer()`。

这样的布局存在以下问题：

1. **职责不清晰**：`@rabjs/react` 是 React 响应式集成库，调试工具挂载与 React 无关，却耦合在其中
2. **SSR 检测依赖 rs-react 内部实现**：`isUsingStaticRendering()` 是 `@rabjs/react` 的内部函数，外部包无法复用
3. **非 React 场景无法使用**：Vue / 原生 JS 项目也需要同等调试能力，但无法引入 `@rabjs/react` 仅为挂载调试工具
4. **可选性差**：调试工具默认随 `@rabjs/react` 加载，无法按需引入（Tree-shake 困难）

### 目标

将 `window.__RS_ROOT_CONTAINER__` 调试挂载功能从 `@rabjs/react` 抽离，建立独立的 `@rabjs/devtools` 包，使其：

1. **框架无关**：不依赖 React，可在任意前端框架（Vue、React、原生 JS）中使用
2. **按需引入**：作为独立包，用户可选择性安装
3. **职责单一**：专注于 DevTools / CDP 调试场景的容器访问桥接
4. **SSR 安全**：内置独立的 SSR 检测机制，不依赖 rs-react 的 `isUsingStaticRendering()`

---

## 包信息

| 字段 | 值 |
|------|-----|
| 包名 | `@rabjs/devtools` |
| 版本 | `0.0.1` |
| 路径 | `reactive-state/cdp-debug/` |
| 依赖 | `@rabjs/service` (peerDependency) |
| 输出 | `lib/main.cjs` + `lib/main.js` + `lib/main.d.ts` |

---

## 架构设计

### 包在依赖图中的位置

```
@rabjs/observer          ← 响应式内核
@rabjs/service           ← IOC 容器（Container / Service / getGlobalContainer）
      │
      ├── @rabjs/react   ← React 集成（不再包含调试挂载逻辑）
      │
      └── @rabjs/devtools   ← 调试工具（NEW，框架无关）
               │
               └── window.__RS_ROOT_CONTAINER__
```

### 为什么不依赖 rs-react？

`root-container-handle.ts` 的核心逻辑只依赖两件事：

- `getGlobalContainer()` —— 来自 `@rabjs/service`
- SSR 环境检测 —— 通过 `typeof window` 即可完成，无需引入 `isUsingStaticRendering()`

将 SSR 检测改为纯 `typeof window` 判断后，整个包的唯一运行时依赖就是 `@rabjs/service`，不需要 React。

---

## 文件结构

```
reactive-state/cdp-debug/
├── docs/
│   └── technical-plan.md       ← 本文档
├── src/
│   ├── main.ts                 ← 包入口，导出所有公开 API
│   ├── root-container-handle.ts ← 核心实现（从 rs-react 迁移）
│   └── __tests__/
│       └── root-container-handle.test.ts
├── package.json
├── tsconfig.json
├── build.config.ts
├── jest.config.js
└── eslint.config.js
```

---

## API 设计

### 公开 API（`src/main.ts` 导出）

```ts
// 接口类型（供外部消费者使用）
export type { RSRootContainerHandle } from './root-container-handle';

// 工厂函数（供高级用户手动创建 handle）
export { createRSRootContainerHandle } from './root-container-handle';

// 挂载函数（最常用入口：模块初始化时调用一次）
export { setupWindowRootContainer } from './root-container-handle';
```

### `RSRootContainerHandle` 接口（保持不变）

```ts
import type { Container, Service } from '@rabjs/service';

export interface RSRootContainerHandle {
  /**
   * global 容器实例（容器树的真正根节点）
   * 与 getGlobalContainer() 返回的是同一对象引用
   */
  container: Container;

  /**
   * 通过 instanceId 获取 Service 实例
   * instanceId 格式通常为 `ClassName_nanoid`，可通过 listServices() 查看
   *
   * @example
   * window.__RS_ROOT_CONTAINER__.getService('CartService_abc123')
   */
  getService(instanceId: string): Service | undefined;

  /**
   * 通过 containerName 获取容器实例
   * containerName 来自 bindServices 的 options.name，或自动生成的 `ComponentName_id` 格式
   *
   * @example
   * const container = window.__RS_ROOT_CONTAINER__.getContainer('ProductPage_2');
   * container?.getChildren();
   */
  getContainer(containerName: string): Container | undefined;

  /**
   * 列出所有已实例化的 Service 内存对象（快照）
   * 直接返回 Service 实例引用，开发者可在控制台直接操作
   *
   * @example
   * window.__RS_ROOT_CONTAINER__.listServices()
   * // => [{ instanceId, containerName, identifierLabel, instance }]
   */
  listServices(): Array<{
    instanceId: string;
    containerName: string;
    identifierLabel: string;
    instance: Service;
  }>;
}
```

### `setupWindowRootContainer()` 的变化

**原实现**（rs-react 中）：

```ts
import { isUsingStaticRendering } from '../static-rendering'; // ← 依赖 rs-react 内部

export function setupWindowRootContainer(): void {
  if (typeof window === 'undefined' || isUsingStaticRendering()) return;
  window.__RS_ROOT_CONTAINER__ = createRSRootContainerHandle();
}
```

**新实现**（cdp-debug 中）：

```ts
export function setupWindowRootContainer(): void {
  if (typeof window === 'undefined') return;  // ← 只做 window 检测，无 SSR 额外依赖
  window.__RS_ROOT_CONTAINER__ = createRSRootContainerHandle();
}
```

> **为什么去掉 `isUsingStaticRendering()` 检测？**
>
> - `isUsingStaticRendering()` 是 `@rabjs/react` 的 SSR 控制开关，专为 React 服务端渲染设计
> - `@rabjs/devtools` 是框架无关的包，不应依赖 React 的 SSR 机制
> - 在真正的 SSR 环境（Node.js）中，`typeof window === 'undefined'` 已经足够保证安全
> - 如需框架级 SSR 集成（例如 Next.js），由上层调用方控制是否调用 `setupWindowRootContainer()`

### Window 全局类型扩展

`@rabjs/devtools` 需要向全局 `Window` 接口注入类型，通过 `src/types/window.d.ts` 完成：

```ts
// src/types/window.d.ts
import type { RSRootContainerHandle } from '../root-container-handle';

declare global {
  interface Window {
    __RS_ROOT_CONTAINER__?: RSRootContainerHandle;
  }
}

export {};
```

---

## rs-react 侧的改造

抽包完成后，`@rabjs/react` 中的相关代码需要做如下处理：

### 方案 A：移除后由使用方手动调用（采用）

**`@rabjs/react` 不依赖 `@rabjs/devtools`**，调试能力完全由业务方按需引入。

**从 `@rabjs/react` 中删除以下内容**：
- `src/domain/root-container-handle.ts` 整个文件
- `src/main.ts` 中的 `setupWindowRootContainer()` 调用
- `src/domain/index.ts` 中 `RSRootContainerHandle` 的导出

**业务方按需引入方式**：

```diff
// 应用入口文件（如 main.ts / index.ts）
+ import { setupWindowRootContainer } from '@rabjs/devtools';
+ setupWindowRootContainer();
```

> **优点**：`@rabjs/react` 职责清晰，不引入任何调试相关依赖；调试能力完全按需引入，不使用调试功能的项目零开销
> **代价**：有 Breaking Change，需要 semver major bump 或通过 changelog 告知

### ~~方案 B：rs-react 转为代理导出~~（不采用）

> ❌ 此方案要求 `@rabjs/react` 依赖 `@rabjs/devtools`，违背“调试能力由业务方按需引入”的原则：不使用调试功能的项目也会被迂带进调试包。

---

## 构建配置

### `package.json`

```json
{
  "name": "@rabjs/devtools",
  "version": "0.0.1",
  "description": "RSJS 调试工具 - 将 global 容器访问 API 挂载到 window.__RS_ROOT_CONTAINER__",
  "main": "lib/main.cjs",
  "module": "lib/main.js",
  "types": "lib/main.d.ts",
  "type": "module",
  "exports": {
    ".": {
      "types": "./lib/main.d.ts",
      "import": "./lib/main.js",
      "require": "./lib/main.cjs"
    }
  },
  "scripts": {
    "build": "tsx build.config.ts",
    "dev": "tsx build.config.ts --watch",
    "clean": "rm -rf lib build dist coverage",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "peerDependencies": {
    "@rabjs/service": "workspace:*"
  },
  "devDependencies": {
    "@osgfe/eslint-config": "workspace:*",
    "@rabjs/service": "workspace:*",
    "@osgfe/tsconfig": "workspace:*",
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "esbuild": "^0.19.12",
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0",
    "ts-jest": "^29.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.1.3"
  },
  "files": [
    "lib/**/*",
    "README.md",
    "CHANGELOG.md"
  ],
  "publishConfig": {
    "registry": "https://r.npm.sankuai.com",
    "access": "public"
  },
  "author": "OSG Frontend Engineering",
  "license": "MIT"
}
```

### `build.config.ts`（与 web-mcp / service 包保持一致）

```ts
// build.config.ts
import esbuild from 'esbuild';

const commonOptions: esbuild.BuildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['@rabjs/service'],
  sourcemap: true,
};

async function build() {
  // ESM
  await esbuild.build({
    ...commonOptions,
    format: 'esm',
    outfile: 'lib/main.js',
  });

  // CJS
  await esbuild.build({
    ...commonOptions,
    format: 'cjs',
    outfile: 'lib/main.cjs',
  });
}

build().catch(console.error);
```

### `tsconfig.json`（参考 web-mcp 包配置）

```json
{
  "extends": "../../configs/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./lib",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/__tests__/**", "node_modules", "lib"]
}
```

### `jest.config.js`

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/__tests__/**'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

---

## 核心实现迁移

`src/root-container-handle.ts` 与当前 `@rabjs/react` 中实现的差异仅在 `setupWindowRootContainer` 函数：

| 对比项 | rs-react（现在）| cdp-debug（新包）|
|--------|----------------|-----------------|
| SSR 检测 | `typeof window === 'undefined' \|\| isUsingStaticRendering()` | `typeof window === 'undefined'` |
| 外部依赖 | `@rabjs/service` + `../static-rendering`（rs-react 内部）| `@rabjs/service`（唯一依赖）|
| 框架绑定 | 强依赖 React SSR 控制开关 | 框架无关 |

其余核心逻辑（`walkContainerForInstanceId`、`walkContainerForName`、`createRSRootContainerHandle`）**完全不变**，可以直接迁移。

---

## 测试迁移

将 `rs-react/src/domain/__tests__/root-container-handle.test.ts` 整体迁移到 `cdp-debug/src/__tests__/root-container-handle.test.ts`，调整两处差异：

### 1. 导入路径变更

```diff
- import { createRSRootContainerHandle, setupWindowRootContainer } from '../root-container-handle';
- import { enableStaticRendering } from '../../static-rendering';
+ import { createRSRootContainerHandle, setupWindowRootContainer } from '../root-container-handle';
  // enableStaticRendering 不再需要
```

### 2. 删除 SSR `isUsingStaticRendering` 相关测试用例

由于新包不再依赖 `isUsingStaticRendering()`，以下测试用例不再适用：

```
✗ enableStaticRendering(true) 后，setupWindowRootContainer 不挂载 window.__RS_ROOT_CONTAINER__
✗ 恢复 enableStaticRendering(false) 后，setupWindowRootContainer 可正常挂载
```

**替代测试**：新增 Node 环境（无 window）场景的覆盖，通过 `delete (global as any).window` 模拟 SSR 环境：

```ts
describe('SSR 安全（无 window 环境）', () => {
  it('window 不存在时，setupWindowRootContainer 不报错且不挂载', () => {
    const originalWindow = global.window;
    // @ts-expect-error
    delete global.window;
    expect(() => setupWindowRootContainer()).not.toThrow();
    global.window = originalWindow;
  });
});
```

---

## SSR 场景行为

| 场景 | `typeof window` | 行为 |
|------|----------------|------|
| 浏览器正常渲染 | `'object'` | ✅ 挂载 `window.__RS_ROOT_CONTAINER__` |
| Node.js（真实 SSR） | `'undefined'` | ⛔ 跳过，不挂载，不报错 |
| Next.js 客户端 Hydration | `'object'` | ✅ 挂载 |
| Jest jsdom 测试环境 | `'object'` | ✅ 挂载（测试可正常覆盖） |

> **与 rs-react 原实现的 SSR 行为差异**：
> 原实现在 Next.js SSR 场景下，即使 `window` 存在（部分 SSR 框架会 polyfill），也通过 `isUsingStaticRendering()` 来阻止挂载。
> 新实现依赖使用方在 SSR 框架中不调用 `setupWindowRootContainer()`（或通过环境判断包裹调用）来实现同等保护。

---

## 与 `@rabjs/web-mcp` 的关系

`@rabjs/web-mcp` 和 `@rabjs/devtools` 解决的是**同一容器访问需求的两个不同场景**：

| 对比项 | `@rabjs/web-mcp` | `@rabjs/devtools` |
|--------|--------------------|-----------------------|
| 目标消费方 | AI Agent（通过 WebMCP 协议）| 开发者（浏览器控制台 / DevTools 插件 / E2E 测试）|
| 数据形式 | 序列化描述（JSON Schema）| 内存对象引用（直接操作）|
| 注册方式 | `McpRegistry` / `McpBridge` 主动注册 | `window.__RS_ROOT_CONTAINER__` 全局挂载 |
| 容器访问来源 | 直接调用 `getGlobalContainer()` | 同，通过 `window.__RS_ROOT_CONTAINER__.container` |
| 框架依赖 | 无 | 无 |

两个包可以共存，也可以互相集成：`@rabjs/web-mcp` 可以复用 `window.__RS_ROOT_CONTAINER__.container` 代替直接调用 `getGlobalContainer()`（可选优化）。

---

## 实施步骤

```
Phase 1：新建包
```

1. **创建目录结构**：`reactive-state/cdp-debug/src/`、`__tests__/`
2. **迁移核心文件**：将 `rs-react/src/domain/root-container-handle.ts` 复制并调整
3. **创建 `src/main.ts`**：导出公开 API
4. **创建 `src/types/window.d.ts`**：扩展全局 Window 类型
5. **配置构建工具**：`package.json`、`build.config.ts`、`tsconfig.json`、`jest.config.js`
6. **迁移测试**：搬运并调整测试用例

```
Phase 2：rs-react 改造
```

7. **选择迁移策略**（采用方案 A：完全移除，不依赖 `@rabjs/devtools`）
8. **`@rabjs/react` 的 `package.json` 无需修改**：不新增任何依赖
9. **删除 `src/domain/root-container-handle.ts`**：直接删除整个文件
10. **更新 `src/main.ts`**：移除 `setupWindowRootContainer()` 调用
11. **运行全量测试**：确保 rs-react 现有测试全部通过

```
Phase 3：验收
```

12. **新包构建验证**：`pnpm --filter @rabjs/devtools build`
13. **新包测试验证**：`pnpm --filter @rabjs/devtools test:coverage`（≥80%）
14. **pnpm-workspace 注册**：确认 `pnpm-workspace.yaml` 已包含 `reactive-state/*`
15. **发布检查**：`pnpm publish:check`

---

## 风险与决策记录

### 风险 1：Breaking Change

`RSRootContainerHandle` 类型目前从 `@rabjs/react` 导出，移除后消费此类型的代码需要改为从 `@rabjs/devtools` 导入。

**缓解措施**：通过 major bump + changelog 明确说明迁移方式，引导业务方主动安装 `@rabjs/devtools` 并在应用入口调用 `setupWindowRootContainer()`。

### 风险 2：去掉 `isUsingStaticRendering()` 检测

在 Next.js 等框架中，客户端代码可能被 SSR 执行（即 `window` 存在但处于服务端环境）。

**缓解措施**：在文档中明确说明，使用方应在 SSR 框架的客户端入口（`useEffect` 或 `onMounted`）中调用 `setupWindowRootContainer()`，或通过 `typeof window !== 'undefined'` 判断。

### 风险 3：包依赖循环

**采用方案 A 后不存在此风险**：`@rabjs/react` 不依赖 `@rabjs/devtools`，两者并列地依赖 `@rabjs/service`，依赖图中不存在循环。

---

## 结论

`@rabjs/devtools` 是一个职责单一、框架无关的调试辅助包。核心逻辑（`root-container-handle.ts` 约 170 行）完全可以从 `@rabjs/react` 直接迁移，唯一需要调整的是去掉对 `isUsingStaticRendering()` 的依赖，使包的运行时依赖收敛为仅 `@rabjs/service`。

**`@rabjs/react` 不依赖 `@rabjs/devtools`**。调试能力由业务方按需安装并在应用入口手动调用 `setupWindowRootContainer()`，实现真正的按需加载。
