# @rabjs/react

## 9.4.0

### Minor Changes

- 641b090: `useReaction` gains a two-function (MobX `reaction`-style) overload `useReaction(dataFn, effect, { fireImmediately })`: the data function collects dependencies on mount without running the effect, and the effect runs with `(current, previous)` only after dependencies change. This provides the "don't run on mount" semantics that the single-function form's `immediate: false` cannot express, since the effect and dependency collection share one function there (#200). The single-function form's `immediate` JSDoc now documents this honestly.

### Patch Changes

- 946f148: `bindServices` container teardown scheduling now falls back `queueMicrotask` → `Promise` → `setTimeout`, so cleanup still happens in legacy JS engines without `queueMicrotask` (old React Native JSC/Hermes). Also extracts an internal `createContainer` factory used by both creation and the hidden-tree rebuild path.
- cd8ec15: `bindServices` now destroys its container on unmount instead of waiting for the FinalizationRegistry/GC fallback. Service cleanup (event listeners, debounce/throttle timers) previously stayed pending for an unbounded window. Destroy is scheduled on a microtask so React StrictMode's fake unmount/remount does not tear down a live container; the GC fallback is kept for concurrent renders that never commit (#218).

  **Behavior change**: the container is private to the bound subtree by design. Service instances held outside the subtree (stored in refs, injected into parent/global containers, kept in external caches) become destroyed objects after unmount — do not let subtree services escape; if an instance's lifetime must outlive the component, register it in a parent container instead (#252).

- 3c2fee7: `useDomainContext` now syncs its internal ref on every render, so consumers (`useService` / `useContainer` / `useContainerEvents`) follow `DomainContext.Provider` value changes instead of permanently resolving against the first-render container (#217).
- a150846: The domain README now documents the real API (`bindServices` with tuple-style service registrations, `RSRoot`/`RSStrict`) instead of the non-existent `createDomain`/`Provider`/`createNestedDomain` functions and the object-form `{ identifier, factory }` registrations that throw at runtime. The dead `ProviderOptions`/`ProviderResult`/`DomainComponent` types and the broken `types/window.d.ts` are removed (#223).
- 8bd3a16: `useAsObservableSource` now wraps a shallow copy of the input instead of the original object, so passing React component props no longer throws `TypeError: 'set' on proxy: trap returned falsish` in dev mode (React freezes props) (#216). The caller's original object is never mutated.
- 946f148: `useReaction(dataFn, effectFn)`: reads inside the effect are no longer collected as dependencies — the effect now runs untracked (MobX `reaction` semantics), so mutating observables only touched by the effect no longer spuriously re-fires it (#249). Also, passing the ignored `lazy` option to the single-function form now emits a development-mode warning instead of being silently dropped (#253).
- 946f148: Class components wrapped by `view()` now start dependency tracking only after the first commit (`componentDidMount` creates the reaction and forces one re-render to collect deps; pre-commit renders run raw). A discarded render pass can no longer leak a live reaction that keeps calling `forceUpdate` on a dead instance — class components cannot use the `useObserver` FinalizationRegistry backstop because the leaked subgraph is self-sustaining. This also moves the static-rendering check from constructor-time to render-time, matching the function-component path (#254). Additionally, lifecycle methods declared as arrow-function class fields (`componentDidMount = () => {...}`) no longer shadow the wrapper's revival/cleanup logic: they are rebound in the constructor to run both the user's field and the wrapper logic.
- Updated dependencies [946f148]
- Updated dependencies [946f148]
- Updated dependencies [6c0aa33]
- Updated dependencies [946f148]
- Updated dependencies [cf93d8d]
- Updated dependencies [946f148]
- Updated dependencies [358f357]
- Updated dependencies [5095f54]
- Updated dependencies [46f2e01]
- Updated dependencies [946f148]
- Updated dependencies [946f148]
- Updated dependencies [cf0c308]
- Updated dependencies [dd17bbd]
- Updated dependencies [1978dba]
- Updated dependencies [05d2d2a]
  - @rabjs/observer@9.4.0
  - @rabjs/service@9.4.0

## 9.3.5

### Patch Changes

- 7feb1c8: `view()` class components now flush reactive updates with `forceUpdate` instead of `setState({})`, so a user-defined `shouldComponentUpdate` returning `false` can no longer swallow observable-triggered re-renders (#198). User SCU still governs props / own-state updates.
- Updated dependencies [fff3c7f]
  - @rabjs/service@9.3.5
  - @rabjs/observer@9.3.5

## 9.3.4

### Patch Changes

- 08833d1: `@Memo` getters now notify outer `observe` / `observer` when their deps change (#196). Observer exports `notify(target, key)` for this; React re-exports it.
- ab1dc86: `useReaction(effect)` now runs on mount and tracks dependencies by default (`immediate` defaults to true, #195). Passing `immediate: false` still primes the reaction once so later updates fire.
- db9feae: Class `view()` skips reaction creation when `enableStaticRendering(true)` is set, matching `observer()` / `useObserver` so SSR does not leak subscriptions (#197).
- Updated dependencies [f067d9f]
- Updated dependencies [647b3d3]
- Updated dependencies [08833d1]
- Updated dependencies [94f2fc3]
- Updated dependencies [906c86a]
- Updated dependencies [5203be4]
- Updated dependencies [baf2986]
  - @rabjs/observer@9.3.4
  - @rabjs/service@9.3.4

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
