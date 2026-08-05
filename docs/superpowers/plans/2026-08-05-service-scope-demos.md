# Service 作用域交互示例 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在文档站 Service 指南中增加一个可交互 Demo，展示嵌套 Service 的父子作用域、同级隔离和全局 Service 的注册解析。

**Architecture:** 新建一个 `service-scope` Demo 目录，按现有 Demo 约定拆分 Service 定义、live UI 和源码字符串。外层 `bindServices` 注册应用级服务，内层 `bindServices` 注册页面及面板服务；全局示例使用 `@rabjs/react` 重新导出的 `register` 和 `resolve`。Service 指南页只负责通过 `DemoCard` 接入 Demo，不增加新路由。

**Tech Stack:** React 19, TypeScript, `@rabjs/react`, Vite, 现有 `DemoCard` / CSS demo 类。

## Global Constraints

- 复用现有 `DemoCard`、CSS 类和 Service API。
- 不增加依赖，不创建新的路由。
- 展示源码与 live Demo 保持同步。
- 只修改文档站展示层，不修改 `@rabjs/react` 或 `@rabjs/service` 运行时实现。

---

## 文件结构

- Create: `website/src/demos/service-scope/ServiceScopeServices.ts` — `AppService`、`PageService`、`PanelService`、`GlobalService` 定义。
- Create: `website/src/demos/service-scope/ServiceScopeDemo.tsx` — 嵌套容器、同级面板和全局服务的 live UI。
- Create: `website/src/demos/service-scope/index.ts` — 默认导出 Demo、导出 Service 和完整 `serviceScopeDemoCode` 字符串。
- Modify: `website/src/pages/guides/Service.tsx` — 引入 Demo，并在 Container 章节后渲染 `DemoCard`。

### Task 1: Add Service definitions

**Files:**
- Create: `website/src/demos/service-scope/ServiceScopeServices.ts`

**Interfaces:**
- Produces `AppService` with `theme: "signal" | "paper"`, `visits: number`, `toggleTheme()` and `visit()`.
- Produces `PageService` with `title: string`, `updates: number` and `update()`.
- Produces `PanelService` with a stable `panelId: string`, `count: number` and `increment()`.
- Produces `GlobalService` with `count: number` and `increment()`.

- [ ] **Step 1: Create the Service definitions using the existing base class import.**

```ts
import { Service } from "@rabjs/react";

export class AppService extends Service {
  theme: "signal" | "paper" = "signal";
  visits = 0;

  toggleTheme() {
    this.theme = this.theme === "signal" ? "paper" : "signal";
  }

  visit() {
    this.visits += 1;
  }
}

export class PageService extends Service {
  title = "嵌套页面";
  updates = 0;

  update() {
    this.updates += 1;
  }
}

let nextPanelId = 0;

export class PanelService extends Service {
  readonly panelId = `panel-${++nextPanelId}`;
  count = 0;

  increment() {
    this.count += 1;
  }
}

export class GlobalService extends Service {
  count = 0;

  increment() {
    this.count += 1;
  }
}
```

- [ ] **Step 2: Run the website typecheck to catch Service API or type errors.**

Run: `pnpm --filter @rabjs/website typecheck`

Expected: PASS, or only failures unrelated to the new directory.

- [ ] **Step 3: Commit the Service definitions.**

```bash
git add website/src/demos/service-scope/ServiceScopeServices.ts
git commit -m "docs: add Service scope demo models"
```

### Task 2: Build the live nested/global Demo

**Files:**
- Create: `website/src/demos/service-scope/ServiceScopeDemo.tsx`

**Interfaces:**
- Consumes the four Service classes from `ServiceScopeServices.ts`.
- Produces a default `ServiceScopeDemo` React component.

- [ ] **Step 1: Implement the innermost panel component and bind each panel to its own `PanelService` container.**

```tsx
const Panel = observer(() => {
  const panel = useService(PanelService);
  return (
    <div className="demo-panel">
      <strong>{panel.panelId}</strong>
      <span>count: {panel.count}</span>
      <button className="demo-btn" onClick={() => panel.increment()}>
        +1
      </button>
    </div>
  );
});

const BoundPanel = bindServices(Panel, [PanelService]);
```

- [ ] **Step 2: Implement the page component so it resolves `AppService` from the parent and `PageService` from the current container.**

```tsx
const Page = observer(() => {
  const app = useService(AppService);
  const page = useService(PageService);

  return (
    <div className="demo-stack">
      <div className="demo-row">
        <span>父级主题：{app.theme}</span>
        <span>应用访问：{app.visits}</span>
        <span>页面更新：{page.updates}</span>
      </div>
      <div className="demo-row">
        <button className="demo-btn" onClick={() => app.toggleTheme()}>
          切换父级主题
        </button>
        <button className="demo-btn" onClick={() => app.visit()}>
          记录应用访问
        </button>
        <button className="demo-btn" onClick={() => page.update()}>
          更新当前页面
        </button>
      </div>
      <div className="demo-grid">
        <BoundPanel />
        <BoundPanel />
      </div>
    </div>
  );
});

const BoundPage = bindServices(Page, [PageService]);
```

- [ ] **Step 3: Implement the global Service section with idempotent registration and global resolution.**

```tsx
const globalContainer = getGlobalContainer();
if (!globalContainer.has(GlobalService)) {
  register(GlobalService);
}

const GlobalSection = observer(() => {
  const global = resolve(GlobalService);
  return (
    <div className="demo-row">
      <span>全局计数：{global.count}</span>
      <button className="demo-btn" onClick={() => global.increment()}>
        修改全局 Service
      </button>
    </div>
  );
});
```

`globalContainer.has(GlobalService)` checks the same global container used by `register(GlobalService)` and `resolve(GlobalService)` when no explicit container argument is provided. This keeps the demo safe if the live component re-renders.

- [ ] **Step 4: Compose the outer component and bind the application-level Service.**

```tsx
const ScopeDemo = observer(() => {
  const app = useService(AppService);
  return (
    <div className="demo-stack">
      <p>外层 AppService 实例：{app.instanceId}</p>
      <BoundPage />
      <GlobalSection />
    </div>
  );
});

export default bindServices(ScopeDemo, [AppService]);
```

- [ ] **Step 5: Run the website typecheck.**

Run: `pnpm --filter @rabjs/website typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the live Demo.**

```bash
git add website/src/demos/service-scope/ServiceScopeDemo.tsx
git commit -m "docs: add interactive Service scope demo"
```

### Task 3: Add exports and synchronized source code

**Files:**
- Create: `website/src/demos/service-scope/index.ts`

**Interfaces:**
- Produces default export `ServiceScopeDemo`.
- Produces named exports `AppService`, `PageService`, `PanelService`, `GlobalService`.
- Produces `serviceScopeDemoCode: string` containing the complete copyable example.

- [ ] **Step 1: Add exports and write `serviceScopeDemoCode` with the same registration, nesting, and global API calls used by the live Demo.**

The source string must include:

```tsx
import {
  Service,
  bindServices,
  getGlobalContainer,
  observer,
  register,
  resolve,
  useService,
} from "@rabjs/react";
```

It must show `AppService` in the outer `bindServices`, `PageService` in the nested `bindServices`, two `bindServices(Panel, [PanelService])` siblings, and the idempotent global registration followed by `resolve(GlobalService)`.

- [ ] **Step 2: Compare the source string against `ServiceScopeServices.ts` and `ServiceScopeDemo.tsx`; update comments or behavior so the live code and displayed code describe the same API.**

- [ ] **Step 3: Run typecheck.**

Run: `pnpm --filter @rabjs/website typecheck`

Expected: PASS.

- [ ] **Step 4: Commit the exports and source string.**

```bash
git add website/src/demos/service-scope/index.ts
git commit -m "docs: expose Service scope demo source"
```

### Task 4: Insert the Demo into the Service guide

**Files:**
- Modify: `website/src/pages/guides/Service.tsx`

**Interfaces:**
- Consumes `ServiceScopeDemo` and `serviceScopeDemoCode` from `../../demos/service-scope`.
- Produces one `DemoCard` under the existing `Container 与 bindServices` section.

- [ ] **Step 1: Add the import beside the existing `collab` Demo import.**

```tsx
import ServiceScopeDemo, {
  serviceScopeDemoCode,
} from "../../demos/service-scope";
```

- [ ] **Step 2: Render the DemoCard immediately after the `bindServices` explanation and before `实例化时机与生命周期`.**

```tsx
<DemoCard
  title="嵌套 Service 与全局 Service"
  description="观察父子容器解析、同级实例隔离，以及全局容器注册与解析"
  code={serviceScopeDemoCode}
>
  <ServiceScopeDemo />
</DemoCard>
```

- [ ] **Step 3: Run typecheck.**

Run: `pnpm --filter @rabjs/website typecheck`

Expected: PASS.

- [ ] **Step 4: Commit the Service guide integration.**

```bash
git add website/src/pages/guides/Service.tsx
git commit -m "docs: add Service scope demo to guide"
```

### Task 5: Verify the website build and interaction contract

**Files:**
- Verify: `website/src/demos/service-scope/ServiceScopeServices.ts`
- Verify: `website/src/demos/service-scope/ServiceScopeDemo.tsx`
- Verify: `website/src/demos/service-scope/index.ts`
- Verify: `website/src/pages/guides/Service.tsx`

- [ ] **Step 1: Run the full website build.**

Run: `pnpm --filter @rabjs/website build`

Expected: TypeScript emits no errors and Vite produces the website bundle.

- [ ] **Step 2: Inspect the final diff for formatting and scope.**

Run: `git diff --check; git diff -- website/src/demos/service-scope website/src/pages/guides/Service.tsx`

Expected: no whitespace errors, no package/runtime files changed, and the DemoCard is placed after the Container section.

- [ ] **Step 3: Manually verify the live Demo.**

Open the website Service guide and verify:

1. `AppService` controls update the values shown inside the nested page.
2. `PageService` updates do not alter the AppService counters.
3. Clicking the first panel only changes its own `panelId` counter; the second panel remains unchanged, and vice versa.
4. The global counter updates when the global button is clicked.
5. The displayed code includes both nested `bindServices` and global `register` / `resolve` usage.

- [ ] **Step 4: Create the final task commit once all checks pass.**

```bash
git add website/src/demos/service-scope website/src/pages/guides/Service.tsx
git commit -m "docs: add interactive Service scope examples"
```
