# @rabjs/service

## 9.2.2

### Patch Changes

- 7621c98: esbuild 0.28 with es2020 targets; rn-debug-server reports the actual listen port

## 9.2.1

### Patch Changes

- c3db642: 依赖升级：`@rabjs/observer` 升至 9.1.0（响应式正确性与安全性修复，含行为变更——详见 @rabjs/observer 9.1.0 changeset 与 PR #91）。react/service 自身无代码变更，随依赖 bump patch 版本。

  注意：react/service 的 jest 已映射到 observer workspace 源码（PR #91），全部测试（react 175 / service 218）在新 observer 行为下验证通过。

## 9.2.0

### Minor Changes

- 同步上游 reactive-state 最新迭代

  - observer/react/service/web-mcp：kebab-case 文件命名重构、事件监听器注册表、RN 环境兼容性修复等
  - devtools：同步 cdp-debug 能力，新增 assert 断言（expect/reporter）
  - 新增 @rabjs/shared 包：断言、路径解析等共享工具

## 9.1.0

### Minor Changes

- feat: sync updates from upstream

  - react: add useReaction hook
  - react: fix bindServices ViewComp created outside render, restore options param
  - service: fix Inject decorator to return descriptor for TS/Babel compatibility

## 9.0.5

### Patch Changes

- 支持 service 内 resolve

## 9.0.4

### Patch Changes

- 70f555c: fix: 并发模式下 unmount 问题

## 9.0.3

### Patch Changes

- f3e54d5: fix: workflow publish

## 9.0.2

### Patch Changes

- a1b663b: fix: workflow

## 9.0.1

### Patch Changes

- fix: $model access

## 9.0.0

### Major Changes

- 升级到 V9,大幅度提升性能,支持 React18+,大幅度减少包体积
