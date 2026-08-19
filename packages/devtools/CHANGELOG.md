# @rabjs/devtools

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
