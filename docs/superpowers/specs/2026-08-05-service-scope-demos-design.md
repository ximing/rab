# Service 作用域交互示例设计

## 目标

在文档站的 Service 指南中增加一个可交互 Demo，直观展示嵌套 Service 的父子作用域、同级隔离，以及全局 Service 的注册与解析。

## 现状

`website/src/pages/guides/Service.tsx` 已经介绍 `bindServices`、容器父子关系和全局容器 API，但缺少能直接操作和观察这些行为的示例。网站现有 Demo 遵循 `DemoCard + src/demos/<name>/ + 展示源码字符串` 的组织方式。

## 设计

新增 `website/src/demos/service-scope/` Demo 目录，包含：

- `ServiceScopeServices.ts`：定义应用级、页面级、同级面板级和全局 Service。
- `ServiceScopeDemo.tsx`：使用 `observer`、`useService`、`bindServices` 渲染交互界面。
- `index.ts`：导出 Demo、Service 和与 live Demo 同步的完整源码字符串。

Demo 分为两个区域：

1. 嵌套作用域：外层注册 `AppService`，内层注册 `PageService`。页面区域同时读取父级和当前级 Service；两个同级面板分别注册同一个 `PanelService`，显示各自实例标识和计数，以证明同级容器不共享实例。
2. 全局 Service：通过 `register` 将 `GlobalService` 放入全局容器，通过 `resolve` 获取实例并修改计数，展示不依赖 React 组件树的全局服务用法。

页面在 `Container 与 bindServices` 章节后加入一个 `DemoCard`，提供标题、说明、live 内容和完整可复制源码。该改动只涉及文档站展示层，不修改 `@rabjs/react` 或 `@rabjs/service` 运行时实现。

## 数据流与生命周期

- 外层 `bindServices` 创建应用容器并注册 `AppService`。
- 内层 `bindServices` 创建子容器并注册 `PageService`；子容器解析不到的 Service 沿父链解析。
- 两个同级面板各自创建子容器并注册 `PanelService`，所以每个面板拥有独立实例。
- 全局 Service 使用全局容器注册和解析；Demo 卸载时不依赖局部容器销毁全局实例。

## 验证

- 运行 `pnpm --filter @rabjs/website typecheck`。
- 运行 `pnpm --filter @rabjs/website build`。
- 手动验证父级 Service 可被内层读取、两个同级面板实例互相隔离、全局计数更新后页面同步显示。

## 范围约束

- 复用现有 `DemoCard`、CSS 类和 Service API。
- 不增加依赖，不创建新的路由。
- 展示源码与 live Demo 保持同步。
