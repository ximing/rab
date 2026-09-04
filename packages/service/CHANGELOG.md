# @rabjs/service

## 9.4.0

### Patch Changes

- 946f148: `cleanupAllMemos` now notifies outer observers per cleaned memo key (batched into a single flush), matching `invalidateMemo` semantics — mounted `observe`/`observer` consumers no longer stay stale after a cache reset. `Service.destroy` passes `{ notify: false }` to keep its deliberate silence (#255).
- cf93d8d: `cleanupAllMemos` / `cleanupAllDebounces` / `cleanupAllThrottles` now walk the full prototype chain instead of only the direct prototype. Decorated members defined on a base class are cleaned up when a subclass instance is destroyed; previously their memo reactions kept running and debounce/throttle timers kept firing on destroyed instances (#221).
- 946f148: `@Debounce`/`@Throttle` no longer throw `TypeError: Invalid value used as weak map key` on detached calls (`this` null/undefined, e.g. `arr.map(service.save)` or destructured methods). Detached calls share one module-level sentinel state, matching the pre-WeakMap closure behavior (#250).
- 358f357: `@Debounce` / `@Throttle` state (timers, pending args, `this`, results) is now stored per instance instead of in the decorator closure shared by every instance of the class. Previously one instance's pending call was silently dropped when another instance invoked the same method, and destroying one instance cancelled every other instance's pending calls (#220).
- 5095f54: `@Inject` caches are now per-instance instead of shared across every instance of the class. Previously the first instance's resolved dependency (from whatever container it belonged to) leaked into all other instances, including cross-container and re-bound scenarios, and a manual `set` on one instance overwrote every other instance's injection (#219).
- 946f148: Fix `@Memo` getters returning stale cached values when read inside `batch()` (including the implicit batch around array mutators). Cache invalidation bookkeeping (`computed = false`) now happens synchronously on the trigger path via the reaction's `debugger` hook (filtered to write operations); only the outer `notify` stays deferred to flush. The memo's inner reaction is also reused across recomputations instead of being recreated, so a notify queued mid-batch can no longer be dropped (#248).
- 82e32e7: fix(service): 链式 @Memo mid-batch 读到过期缓存 —— 计算期间采集 memo→memo 依赖边，缓存命中前递归校验链有效性（#248 链式补全）
- 82e32e7: fix(service): review followups —— symbol 命名的 @Memo 纳入 cleanupAllMemos 清理；cleanupAllMemos 通知阶段 reaction 抛错不再中断清理；@Debounce/@Throttle 分离调用的哨兵状态随 destroy 一并清理；@Memo 同步失效钩子声明 wantsOldValue=false 豁免 clear 快照；@Memo flush 不再丢弃 mid-batch 重算（dirty 记账，不纯 getter 值发散修复）
- 946f148: Fix outer `observe`/`observer` consumers of a `@Memo` getter going permanently silent after the getter throws once. The proxy get trap registers the dependency only after the getter returns, so a throwing getter left the outer reaction with zero dependencies and no later change could wake it. The memo accessor now pre-registers the `(instance, key)` dependency through the `has` trap before computing, so recovery works once the underlying data is fixed (#247).
- cf0c308: Document that `$model.method.loading` is a boolean last-write flag (not a pending count) and `$model.method.error` cannot be attributed under overlapping same-method calls.
- c492131: fix: review round 2 —— @Memo 链式场景 flush 不再丢弃 mid-batch 重算（链 notify 由版本快照裁决，不纯 getter 前后发散修复）；@Memo 失效钩子声明 reentrantSafe，isDebugging 重入窗口（用户 debugger 内的嵌套写）不再丢失失效；链式边的归属判定改用当前运行 reaction，其他 reaction 在计算窗口内的 memo 读取不再制造假边；@Memo/@Throttle/@Debounce 清理函数改按真实 propertyKey 注册，同 description 的 symbol 键不再撞名交叉清理，symbol 方法纳入 destroy 清理；view 类组件挂载不再产生伪 update commit（componentDidUpdate/getSnapshotBeforeUpdate 不再紧随 mount 触发）；箭头字段 componentWillUnmount 抛错时 reaction 仍被释放
- c17140c: fix(observer): `untracked()` 窗口内被写入同步触发重跑的 reaction 不再丢失全部依赖 —— untracked 只屏蔽「调用时刻的当前派生」（MobX 语义），reaction 运行边界重置深度计数器，此前窗口内重跑的 reaction 会以零依赖收场、永久失效；新增 `isUntracked()` 内部查询导出

  fix(observer): `setToOwner` 反查表（#12 空 entry 清理）改为弱持有 ConnectionMap —— 此前任一存活 reaction 会经 `cleaners → Set → setToOwner value` 钉住同 target 整张 ConnectionMap，连带钉住其他 key 上所有 reaction 闭包引用的对象，架空 connectionStore 根 WeakMap 对不可达 target 的回收

  fix(service): `@Debounce`/`@Throttle` 修复 leading/maxWait/窗口过期立即执行路径的幽灵尾调用 —— invokeFunc 释放 lastArgs/lastThis 后，trailing 定时器到点会以 `this=undefined`、空参数重放用户方法（轻则定时器回调抛 TypeError，重则方法多执行一次）；trailing 现在只在「上次 invoke 之后有新调用」时触发（lodash 语义），窗口内的后续调用行为不变

  fix(service): `@Memo` 链式依赖记账遵守 `untracked()` 边界（`untracked(() => this.memoB)` 不再构成 A→B 链式边）；链式边（memoDeps）在 WeakRef 环境下弱持有上游 CacheState，长寿命实例的 memo 不再把读过的 transient 上游实例保留到自己重算/销毁为止

  fix(react): view 类组件 Suspense/Offscreen 隐藏→显示（reveal）时 DOM 不再停留在隐藏前的旧值 —— cDM 重放路径没有快照可比对，按 master 语义无条件 forceUpdate 完成重渲染与依赖收集；componentWillUnmount 现在重置 `_committed`，隐藏树被驱动重渲染时回到 commit 前探针路径，修复「隐藏中 render 重建存活 reaction、随后子树在隐藏中删除导致 reaction 永不释放」的泄漏

  fix(react): view 挂载快照支持 `key-iterate` 依赖类型（Map.keys() 的 key 集合变更此前恒判「无差异」）；快照捕获/对比不再执行用户 accessor（此前 `Reflect.get(rawTarget, key)` 会以 raw 身份执行 @Memo getter：挂载期多算一次，且留下注册不到依赖、永不失效的 raw 身份缓存）—— accessor 一律按「已变化」处理，宁可多更一次

- 2f20796: fix(react): view 挂载快照补全 WeakMap/WeakSet 处理 —— collection-handler 对 WeakMap.get/has、WeakSet.has 同样注册 get/has 依赖，快照侧此前只识别 Map/Set：WeakMap 落入数据属性读取恒得 undefined、WeakSet 经 Reflect.has 恒得 false，捕获与对比两端恒等，commit 窗口内的 set/add 被静默丢失（DOM 停留在首渲染旧值）。observer 侧导出 isWeakMapTarget/isWeakSetTarget（与 instrumented 路由同一套 tag 判定），快照按原生方法读取，不触发用户代码

  fix(observer): untracked 窗口内手动执行的 unobserved reaction 不再向其自身 debugger 投递 —— reaction 运行边界的深度重置只服务 tracked reaction 重建依赖，unobserved 分支本就不注册依赖，同步重置破坏了「untracked 窗口内的读取对响应式系统完全不可见」的契约

  fix(service): 同一方法被同类型装饰器重复装饰（@Debounce(50) @Debounce(100)）时 destroy 清理全部装饰层的 pending 定时器 —— 清理注册由按 propertyKey 去重改为组合，后装饰层的 store 定时器不再在 destroy 后残留并幽灵触发

  chore(observer,service): test:release 增加 NODE_OPTIONS=--expose-gc —— WeakRef 回收类测试（memo 链式边弱持有、weak-keys-gc）此前在发布门禁下静默 skip，核心内存修复无 CI 守护

- 54de8b5: `@Debounce`/`@Throttle`: a reentrant call made from inside the decorated method's own body is no longer silently dropped — `invokeFunc`'s reference release now only clears the pending state when no newer call arrived during the invocation, so the reentrant call's armed timer still fires.

  Subclass re-decoration of the same method name no longer skips the base decorator layer's cleanup: `runAllCleanups` executes every layer's cleanup (cleanups are idempotent), and `cancelDebounce`/`cancelThrottle` cancel all layers — a base-layer timer armed via `super.save()` no longer ghost-fires after `destroy()`.

  `CleanupAllMemosOptions` is now re-exported from the package root.

- 54de8b5: `@Debounce(wait, { leading: true })` now fires the leading edge on **every** burst, not only on the first call of the instance's lifetime: after a quiet period (≥ wait) the next call invokes immediately (lodash semantics, matching the docstring). Previously such calls fell through to trailing-only — and with `trailing: false` they were silently never executed.

  Suppressed calls that can never execute now release their `args`/`this` references instead of pinning the payload until the next invocation (process-lifetime for detached calls): `@Debounce` tails with `trailing: false` release when the disarmed timer fires; `@Throttle` in-window calls with `trailing: false` release immediately, as does a reentrant pending call that no timer can ever fire.

- c91a482: Review round 7 — cross-audit fixes for throttle/debounce edge semantics and a frozen-instance snapshot pin:

  - `@Throttle(wait, { leading: false })` no longer starves under a continuous call stream. Two re-arm bugs stacked: (1) the first-call path treated `lastInvokeTime === 0` as “always first” and reset the trailing timer on every in-window call; (2) after the first trailing invoke, later calls land in the window-expired branch (because `startTimer` schedules a full `wait` from the arming call, which is after `lastInvoke`), and that branch cancelled the in-flight timer and re-armed a full `wait` — pushing the deadline past the next event forever. The trailing timer is now left alone once armed, so a throttled method fires once per window while events keep arriving.
  - `@Throttle` with `leading: false` never invokes synchronously anymore: the window-expired branch now defers to the trailing timer instead of calling the method inline.
  - `@Debounce(wait, { leading: false, maxWait })` no longer invokes the **first** call synchronously (the maxWait branch mistook `lastInvokeTime === 0` for "max wait exceeded"). `maxWait` is now enforced by a per-burst cap timer armed at burst start, so deferral is capped even when no further call arrives to re-check the condition.
  - `@Debounce` / `@Throttle`: reentrant calls made from inside the method body are never invoked synchronously (recursion/stack-overflow guard); they are deferred to the trailing timer instead.
  - `@Throttle` trailing no longer re-checks `Date.now() - lastInvokeTime >= wait` in the timer callback. That second clock comparison dropped the in-window last call when the timer fired slightly early, the clock stepped backwards, or `Date.now` was frozen. The wait is already enforced by `setTimeout`; the callback only looks at `hasPendingCall`.
  - `view` class components that freeze `this` inside `componentDidMount` now release the mount-snapshot contents on the degradation path instead of pinning every observable read during the first render until GC.

- 882fd57: feat(observer): 新增一等 `untracked(fn)` 原语（MobX untracked 语义）—— 回调内的 observable 读取不注册依赖、不进入任何 reaction 的 debugger，异常安全、支持嵌套；取代 react 侧依赖未文档化内部行为的「屏蔽 reaction」实现

  fix(react): view 类组件 commit 窗口（自身/子组件 cDM 等）内的 store 变更不再丢失 —— 首渲染用一次性探针 reaction 记录读取快照，_onDidMount 对比快照，有差才 forceUpdate（窗口内无变更仍不产生伪 update）；useReaction 双函数形式的 effect 改用核心 untracked() 原语；同时修复原型方法 componentWillUnmount 抛错跳过 reaction 清理的订阅泄漏，以及 class Sub extends view(Base) 时子类箭头生命周期字段覆盖包装器组合函数导致的响应式丢失

  fix(service): cancelDebounce/cancelThrottle 不再连带取消与本实例无关的 pending 分离调用（detached 共享状态改由 destroy 路径单独清理）；@Debounce/@Throttle 触发后立即释放对调用参数与 this 的引用，避免 detached 哨兵状态把用户 payload 驻留到进程结束；detached 状态存储与清理注册下沉为 cleanup-registry 的共用实现

  > 注：`untracked()` 是新的公开原语，按 semver 走 minor。

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
