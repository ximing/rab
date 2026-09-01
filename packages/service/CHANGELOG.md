# @rabjs/service

## 9.4.0

### Patch Changes

- 946f148: `cleanupAllMemos` now notifies outer observers per cleaned memo key (batched into a single flush), matching `invalidateMemo` semantics — mounted `observe`/`observer` consumers no longer stay stale after a cache reset. `Service.destroy` passes `{ notify: false }` to keep its deliberate silence (#255).
- cf93d8d: `cleanupAllMemos` / `cleanupAllDebounces` / `cleanupAllThrottles` now walk the full prototype chain instead of only the direct prototype. Decorated members defined on a base class are cleaned up when a subclass instance is destroyed; previously their memo reactions kept running and debounce/throttle timers kept firing on destroyed instances (#221).
- 946f148: `@Debounce`/`@Throttle` no longer throw `TypeError: Invalid value used as weak map key` on detached calls (`this` null/undefined, e.g. `arr.map(service.save)` or destructured methods). Detached calls share one module-level sentinel state, matching the pre-WeakMap closure behavior (#250).
- 358f357: `@Debounce` / `@Throttle` state (timers, pending args, `this`, results) is now stored per instance instead of in the decorator closure shared by every instance of the class. Previously one instance's pending call was silently dropped when another instance invoked the same method, and destroying one instance cancelled every other instance's pending calls (#220).
- 5095f54: `@Inject` caches are now per-instance instead of shared across every instance of the class. Previously the first instance's resolved dependency (from whatever container it belonged to) leaked into all other instances, including cross-container and re-bound scenarios, and a manual `set` on one instance overwrote every other instance's injection (#219).
- 946f148: Fix `@Memo` getters returning stale cached values when read inside `batch()` (including the implicit batch around array mutators). Cache invalidation bookkeeping (`computed = false`) now happens synchronously on the trigger path via the reaction's `debugger` hook (filtered to write operations); only the outer `notify` stays deferred to flush. The memo's inner reaction is also reused across recomputations instead of being recreated, so a notify queued mid-batch can no longer be dropped (#248).
- 946f148: Fix outer `observe`/`observer` consumers of a `@Memo` getter going permanently silent after the getter throws once. The proxy get trap registers the dependency only after the getter returns, so a throwing getter left the outer reaction with zero dependencies and no later change could wake it. The memo accessor now pre-registers the `(instance, key)` dependency through the `has` trap before computing, so recovery works once the underlying data is fixed (#247).
- cf0c308: Document that `$model.method.loading` is a boolean last-write flag (not a pending count) and `$model.method.error` cannot be attributed under overlapping same-method calls.

## 9.3.5

### Patch Changes

- fff3c7f: `invalidateMemo(instance, key)` now notifies outer `observe` / `observer` reactions after clearing the cache (#199), aligning the manual invalidation path with the dependency-change path from #196. `cleanupAllMemos` / `Service.destroy` keep the previous no-notify behavior.

## 9.3.4

### Patch Changes

- 08833d1: `@Memo` getters now notify outer `observe` / `observer` when their deps change (#196). Observer exports `notify(target, key)` for this; React re-exports it.

## 9.3.3

## 9.3.2

### Patch Changes

- unify all @rabjs packages to a single 9.3.2 version; future bumps stay in lockstep via changesets fixed

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
