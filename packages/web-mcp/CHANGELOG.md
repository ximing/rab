# @rabjs/web-mcp

## 9.4.0

### Patch Changes

- Updated dependencies [946f148]
- Updated dependencies [cf93d8d]
- Updated dependencies [946f148]
- Updated dependencies [358f357]
- Updated dependencies [5095f54]
- Updated dependencies [946f148]
- Updated dependencies [946f148]
- Updated dependencies [cf0c308]
  - @rabjs/service@9.4.0
  - @rabjs/shared@9.4.0

## 9.3.5

### Patch Changes

- Updated dependencies [fff3c7f]
  - @rabjs/service@9.3.5
  - @rabjs/shared@9.3.5

## 9.3.4

### Patch Changes

- Updated dependencies [08833d1]
  - @rabjs/service@9.3.4
  - @rabjs/shared@9.3.4

## 9.3.3

### Patch Changes

- 07db341: web-mcp 支持 Zod 4 原生 `z.toJSONSchema`，并保留 Zod 3 的 `zod-to-json-schema` 回退；react 在测试环境（`IS_REACT_ACT_ENVIRONMENT`）下用 `React.act` 包装 store 通知，消除 React 19 的 act 警告。
- @rabjs/service@9.3.3
  - @rabjs/shared@9.3.3

## 9.3.2

### Patch Changes

- unify all @rabjs packages to a single 9.3.2 version; future bumps stay in lockstep via changesets fixed
- Updated dependencies
  - @rabjs/service@9.3.2
  - @rabjs/shared@9.3.2

## 9.2.2

### Patch Changes

- 7621c98: esbuild 0.28 with es2020 targets; rn-debug-server reports the actual listen port
- Updated dependencies [7621c98]
  - @rabjs/service@9.2.2
  - @rabjs/shared@9.2.1

## 9.2.1

### Patch Changes

- Updated dependencies [c3db642]
  - @rabjs/service@9.2.1

## 9.2.0

### Minor Changes

- 同步上游 reactive-state 最新迭代

  - observer/react/service/web-mcp：kebab-case 文件命名重构、事件监听器注册表、RN 环境兼容性修复等
  - devtools：同步 cdp-debug 能力，新增 assert 断言（expect/reporter）
  - 新增 @rabjs/shared 包：断言、路径解析等共享工具

### Patch Changes

- Updated dependencies
  - @rabjs/service@9.2.0
  - @rabjs/shared@9.2.0

## 9.1.0

### Minor Changes

- feat: sync updates from upstream

  - react: add useReaction hook
  - react: fix bindServices ViewComp created outside render, restore options param
  - service: fix Inject decorator to return descriptor for TS/Babel compatibility

### Patch Changes

- Updated dependencies
  - @rabjs/service@9.1.0
