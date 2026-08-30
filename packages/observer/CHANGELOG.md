# @rabjs/observer

## 9.3.5

## 9.3.4

### Patch Changes

- f067d9f: Tighten collection builtin-method forwarding (#193): only own methods on Map/Set prototypes are forwarded (so `valueOf`/`toString` stay on the proxy and no longer subscribe to iterate). ES2024 methods also subscribe to an observable `other` operand, and cross-realm `Set.union` is applied to the raw target instead of throwing.
- 647b3d3: Map/Set `forEach` now forwards `thisArg` and passes the observable proxy as the third callback argument, so writes like `map.set(...)` inside `forEach` notify reactions (#191). Shadow collections do the same for the third argument while still exposing raw values.
- 08833d1: `@Memo` getters now notify outer `observe` / `observer` when their deps change (#196). Observer exports `notify(target, key)` for this; React re-exports it.
- 94f2fc3: Fix two leftover observer issues from PR #91:

  - **#92**：跨 realm Map/Set 在 `observable()` 包装前已预置 observable proxy key 时，条目现在会归一化为 raw（`instanceof` 对跨 realm 集合不成立，改用与集合路由相同的 tag + duck-check）。此前 `has`/`get`/`delete` 双身份都失灵，再 `set` 同一逻辑 key 还会产生重复条目。
  - **#93**：新增 `batch(fn)`；数组变异方法（`push`/`pop`/`splice`/`fill` 等）一次调用只通知每个 reaction 一次，且读到最终值。`batch` 之外的单次赋值仍立即同步执行。`Array.prototype.push.call(arr, ...)` 仍不自动 batch。

- 906c86a: Deep `Set` `keys()` / `entries()` / `forEach` now wrap members the same way as `values()`, restoring the native `keys === values` and `entryKey === entryValue` identity (#192). Map keys stay raw.
- 5203be4: `observable()` 不再包装 TypedArray / DataView（`ArrayBuffer.isView`）。此前 9 种旧 TypedArray 被错误包进 base proxy，`length`/`fill`/`[...ta]` 抛 `incompatible receiver`（#190）；`BigInt64Array` / `Float16Array` 则本来就不包装。现在与 Date 一样原样返回，方法可用。若曾依赖 `ta[0] =` 触发 reaction，请改用普通数组，或把 view 放在容器里替换整段 buffer（`state.bytes = new Uint8Array(...)`）。
- baf2986: `wrapKey` now WeakRef-wraps function collection keys the same as object keys, so `observe(() => wm.has(fn))` no longer pins `fn` for the life of the WeakMap (#194).

## 9.3.3

## 9.3.2

### Patch Changes

- unify all @rabjs packages to a single 9.3.2 version; future bumps stay in lockstep via changesets fixed

## 9.3.1

### Patch Changes

- 7621c98: esbuild 0.28 with es2020 targets; rn-debug-server reports the actual listen port

## 9.3.0

### Minor Changes

- fa0dcdb: Fixes reactivity correctness and safety issues in @rabjs/observer:

  - **数组枚举依赖失灵（正确性）**: 注册侧把 iterate 依赖存在 ITERATION_KEY symbol 下，通知侧对数组却按 "length" 查找 —— 两者永不相交。`Object.keys(arr)` / `for...in` / 展开等枚举依赖在 `push` / `delete` 时不再静默失效；`arr.length = N` 收缩时会通知被截断索引的依赖（此前直接读 `arr[i]` 的 reaction 会一直读到脏数据）。
  - **`Object.defineProperty` 绕过响应式（正确性）**: 补齐 `defineProperty` trap（base 与 shadow 两个 handler），defineProperty 修改属性现在会正常触发 reactions。set trap 转发期间有重入守卫，避免普通赋值被双重通知。
  - **原型污染（安全）**: 读取 `__proto__` 不再把 `Object.prototype` / `Array.prototype` 包装成 observable（此前 `state.__proto__.x = 1` 会污染全局原型并进入响应式系统）；对 observable 赋值 `__proto__` 现在抛 `TypeError`（fail-fast），堵住 JSON 注入 + 深合并的静默改原型路径；原型链上的 `constructor` / `prototype` 保持原生语义不再被包装。
  - **shadowObservable 集合 unknown-key（兼容性）**: 此前 `map.constructor` 为 `undefined`、`String(map)` 抛 `TypeError`；现在回退到原生属性，原生方法绑定 raw target（`constructor` 保持恒等性不受绑定影响）。
  - **集合依赖的 key 强持有（内存）**: Map/Set/WeakMap/WeakSet 的对象 key 现以 WeakRef 包装存储，不再阻止 key 被 GC（WeakMap 语义恢复）；无 WeakRef 的旧 RN JSC 环境自动退化为原行为。
  - **集合 key/value 统一解包（正确性）**: `map.set(key, value)` / `set.add(value)` / `get` / `has` / `delete` 现统一把传入的 observable proxy 解包为 raw —— 此前 proxy 与 raw 混用会导致 `m.get(rawKey)` 查找失灵、且依赖注册与通知落在不同身份上永久漏通知。Map/Set 被包装时会把既有条目中的 proxy key/value 一并归一化为 raw（构造期传入 `new Map([[observableBox, 42]])` 的场景）。由此推导的可见行为变化：
    - **shadow 集合嵌套响应性（迁移注意）**: `shadowObservable` 集合的 `set`/`add` 现把 observable value 解包为 raw 落盘，`get`/迭代返回 raw 而非传入的 proxy —— 经返回值直接修改嵌套对象不再被追踪（此前仅当用户恰好传入已包装 proxy 时才偶然响应式，字面量初始化的嵌套值从来返回 raw）。需要嵌套响应式请使用 deep 集合（`observable(map)`）。
    - **迭代 key 身份**: `map.set(proxyKey, v)` 后 `keys()`/`entries()` 迭代出的 key 是 raw 身份（value 半边仍经包装返回 proxy）。与 Vue 3 一致（Vue 也不包装 key）。
    - **WeakMap/WeakSet 边界**: 不可枚举，无法在包装时归一化 —— 构造期存入的 proxy key 依旧不可达，需经 trap 重新写入。
  - **对象属性赋值的函数解包对齐（正确性）**: 对象 set trap（base 与 shadow）现把赋入的 observable 函数 proxy 解包为 raw 落盘（`raw(state).data === fn`），与集合 trap 对齐，消除 raw 结构中残留 function proxy 的身份分裂；读取往返身份不变（get 返回缓存的 proxy）。
  - **性能**: 原始值属性读取跳过 `getOwnPropertyDescriptor`（微基准约 -26% 读取耗时）；无依赖写入提前返回，不再分配空数组。

  后续多轮对抗审查（G1-G8）的修复：

  - **数组 length 收缩通知精度（G1）**: `arr.length = N` 收缩通知改用 trap 捕获的旧 length 计算被截断索引窗口（含引擎 ToUint32 折叠、`pop`/`splice` 路径）；被引擎拒绝的写入（sealed/frozen）不再发"幽灵通知"；同值类型化写入（如 `arr.length = '5'`）按折叠后的规范 length 比较不再误报；跳过 symbol 与非规范数字 key 的越界索引；`'3' in arr` 等 has 依赖同样在截断时被通知。
  - **set 转发窗口按 {target, key} 帧栈精确作用域（G2）**: 此前的模块级转发布尔/单 target 方案会在原型链 setter 场景跨 target 误伤（`defineProperty` 丢通知）或漏标（双通知）。现在 base 与 shadow 两个 handler 共享一个转发帧栈，帧按 `{target, key}` 匹配；covered 标记锚定 receiver 链根并记录已通知值（notifiedValue）——嵌套 setter 在同一窗口内对同 key 落下不同值时仍会补发差量，reaction 重入写回 in-flight key 既不双计也不丢更新（先标记后通知）；`Reflect.set(parent, k, v, child)` 路由回的引擎 defineProperty 只标记栈顶帧，链上各层保持单通知语义。
  - **值比较与 getter 隔离（G3）**: set / deleteProperty / defineProperty trap 不再触发用户 accessor getter——oldValue 只读 own data descriptor，accessor 旧值记为 undefined 并靠 descriptor 种类翻转检测变更，避免 throwing getter 在写入落盘前后丢写/丢通知、副作用 getter 以 `this=raw` 绕过全部 trap。变更检测统一改 `Object.is`（重复写 NaN 静默、`+0`→`-0` 视为真实变更）；set trap 比较写入落盘后的实际值（transform setter 赋入值与旧值相等但落盘值不同时不再丢通知），通知携带落盘值；defineProperty 以 `'value' in descriptor` 判定数据描述符（显式 `{ value: undefined }` 不再静默）；data↔accessor 互相重定义与 `{enumerable}` 翻转会通知（枚举依赖不再永久脏读）；失败的 set / define / delete 一律不再发幽灵通知。
  - **批量通知错误隔离（G4）**: 同一批次中某个 reaction（或 scheduler.add）抛错不再阻断其余 reaction 执行；首个错误在整批执行完后于变更调用点重新抛出，错误仍可见。
  - **集合 trap 对函数 observable 的解包（G5）**: `observable(fn)` 返回的函数 proxy 作为 Map/Set 的 key/value 时同样解包为 raw（此前 `m.get(fnProxy)` 查找失灵、依赖注册与通知落在不同身份上永久漏通知）。
  - **deep/shadow 模式缓存分离与连接清理（G6）**: rawToProxy 缓存按深度模式分桶——先 `shadowObservable(raw)` 再 `observable(raw)` 此前会拿到 shadow proxy（deep 响应性静默失效、options 丢失），反序同理；`observable(obj, options)` 重新转发 options 并导出 `ObservableOptions` 类型；为同一 raw 创建第二模式 proxy 不再清空既有依赖连接；依赖释放时同步清理空 Set 及其 Map 条目（动态 key 场景约 200B/key 的累积泄漏）；运行中 reaction 若已 unobserve 则跳过新依赖注册（不再被后续写入"复活"，连接计数可归零）。两种模式共享 `(raw, key) -> reactions` 连接表，任一 proxy 侧的写入都会通知另一侧注册的依赖。
  - **集合路由与 clear oldValue（G7）**: Map/Set/WeakMap/WeakSet 子类经 tag/instanceof 优先路由到 instrumented collection handler（此前 `class MyMap extends Map` 回落 base handler 抛 "incompatible receiver"，自定义 `Symbol.toStringTag` 同样失灵）；带内部槽的内置对象（Date/RegExp/Promise/ArrayBuffer…，含跨 realm 的 `vm`/iframe 场景）按 tag 黑名单拒绝包装，跨 realm 真实集合正常路由，伪造 toStringTag 的普通对象需通过原生方法 duck-check 否则回落 base handler；用户自定义 Error/Date/RegExp 等子类恢复 base 包装、自有属性不再静默失去响应式；ES2024 Set 方法（`union`/`intersection`/`difference`/`symmetricDifference`/`isSubsetOf` 等）以 raw receiver 转发可正常使用；含 NaN key/value 的 Map/Set 构造不再死循环（替换判定改 `Object.is`）；shadow 集合的子类自定义方法以 proxy 为 receiver 调用（内部 `this.set` 走 trap 通知）；`clear()` 的 oldValue 仅在实际存在 debugger 消费者（如 `@rabjs/react` 的 debuggerReaction）时惰性快照——O(n) 拷贝不再无条件发生，子类/跨 realm 构造器因 clear 可重入注册消费者仍总是快照。
  - **unobserve 语义明确与对齐（G8）**: README 明确 unobserve 不撤回在途执行——手动调用或已被函数型 scheduler 排期（如 `setTimeout`）的执行仍会落地一次，期间不建立任何新依赖；仅实现 `add` 的对象型 scheduler 不再在 unobserve 时抛 `TypeError`（`ReactionScheduler.delete` 变为可选接口）；在途执行的 unobserved reaction 被压入 reaction 栈，嵌套在运行中 reaction 内手动调用时不再把读取泄漏注册到外层 reaction（外层不再被其从未读过的 key 触发）。

  注意: 本版本包含若干**行为变更**（详见 PR #91「破坏性变更」小节），建议按 minor 升级对待并回归:

  - 对 observable 赋值 `__proto__` 现在抛 `TypeError`（此前静默改原型）
  - `observe()` 首跑抛错即注销 reaction（此前半成品 reaction 会被后续写入复活）
  - reaction/debugger 抛错不再中断同批，改为全部执行后在变更调用点 rethrow 首错
  - 数组 `length` 收缩、`Object.defineProperty`、集合 key/value 身份语义等通知行为有实质修正
    业务方升级后可运行仓库内契约测试 `npx jest src/__tests__/api` 检测行为差异（见 README「升级与回归」）。

  另外: 此前依赖"对 observable 赋值 `__proto__`"或"defineProperty 不触发通知"的代码行为会变化（前者抛错）；shadow 集合依赖"存入 proxy、经 get 返回 proxy 并追踪嵌套变更"的用法需迁移为 deep 集合（见上）。`new Function("return this")` 的 globalObj fallback 按旧 React Native 兼容性要求保留未动。G6 起，同一 raw 对象经 `observable()` 与 `shadowObservable()` 返回的是两个不同 proxy（此前第二次调用会复用第一个的缓存），依赖"两种模式返回同一 proxy"的代码需调整。

  - **终审遗留修复 (A 档)**: queue 时 throwing debugger 不再中断同批其余 reaction（错误并入首错收集，且不吞掉调度本身）；`observe()` 首跑抛错自动注销 reaction（不再留下被后续写入复活的"僵尸"依赖——已成功跑过的 reaction 重跑抛错仍保持存活，两语义并存）；README 修正 add-only scheduler 契约矛盾，并文档化 debugger 在途事件、错误隔离、accessor 同值通知、ES2024 Set 方法返回 raw 成员等行为边界。

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
