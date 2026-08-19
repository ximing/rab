# @rabjs/react

## 9.3.3

### Patch Changes

- 07db341: web-mcp 支持 Zod 4 原生 `z.toJSONSchema`，并保留 Zod 3 的 `zod-to-json-schema` 回退；react 在测试环境（`IS_REACT_ACT_ENVIRONMENT`）下用 `React.act` 包装 store 通知，消除 React 19 的 act 警告。
- @rabjs/observer@9.3.3
  - @rabjs/service@9.3.3

## 9.3.2

### Patch Changes

- unify all @rabjs packages to a single 9.3.2 version; future bumps stay in lockstep via changesets fixed
- Updated dependencies
  - @rabjs/observer@9.3.2
  - @rabjs/service@9.3.2

## 9.2.2

### Patch Changes

- Updated dependencies [7621c98]
  - @rabjs/observer@9.3.1
  - @rabjs/service@9.2.2

## 9.2.1

### Patch Changes

- c3db642: 依赖升级：`@rabjs/observer` 升至 9.1.0（响应式正确性与安全性修复，含行为变更——详见 @rabjs/observer 9.1.0 changeset 与 PR #91）。react/service 自身无代码变更，随依赖 bump patch 版本。

  注意：react/service 的 jest 已映射到 observer workspace 源码（PR #91），全部测试（react 175 / service 218）在新 observer 行为下验证通过。

- Updated dependencies [fa0dcdb]
- Updated dependencies [c3db642]
  - @rabjs/observer@9.3.0
  - @rabjs/service@9.2.1

## 9.2.0

### Minor Changes

- 同步上游 reactive-state 最新迭代

  - observer/react/service/web-mcp：kebab-case 文件命名重构、事件监听器注册表、RN 环境兼容性修复等
  - devtools：同步 cdp-debug 能力，新增 assert 断言（expect/reporter）
  - 新增 @rabjs/shared 包：断言、路径解析等共享工具

### Patch Changes

- Updated dependencies
  - @rabjs/observer@9.2.0
  - @rabjs/service@9.2.0

## 9.1.0

### Minor Changes

- feat: sync updates from upstream

  - react: add useReaction hook
  - react: fix bindServices ViewComp created outside render, restore options param
  - service: fix Inject decorator to return descriptor for TS/Babel compatibility

### Patch Changes

- Updated dependencies
  - @rabjs/observer@9.1.0
  - @rabjs/service@9.1.0

## 9.0.5

### Patch Changes

- 支持 service 内 resolve
- Updated dependencies
  - @rabjs/observer@9.0.5
  - @rabjs/service@9.0.5

## 9.0.4

### Patch Changes

- 70f555c: fix: 并发模式下 unmount 问题
- Updated dependencies [70f555c]
  - @rabjs/observer@9.0.4
  - @rabjs/service@9.0.4

## 9.0.3

### Patch Changes

- f3e54d5: fix: workflow publish
- Updated dependencies [f3e54d5]
  - @rabjs/observer@9.0.3
  - @rabjs/service@9.0.3

## 9.0.2

### Patch Changes

- a1b663b: fix: workflow
- Updated dependencies [a1b663b]
  - @rabjs/observer@9.0.2
  - @rabjs/service@9.0.2

## 9.0.1

### Patch Changes

- fix: $model access
- Updated dependencies
  - @rabjs/observer@9.0.1
  - @rabjs/service@9.0.1

## 9.0.0

### Major Changes

- 升级到 V9,大幅度提升性能,支持 React18+,大幅度减少包体积

### Patch Changes

- Updated dependencies
  - @rabjs/observer@9.0.0
  - @rabjs/service@9.0.0
