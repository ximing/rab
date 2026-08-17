---
"@rabjs/observer": patch
---

Fixes reactivity correctness and safety issues in @rabjs/observer:

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

注意: 此前依赖"对 observable 赋值 `__proto__`"或"defineProperty 不触发通知"的代码行为会变化（前者抛错）；shadow 集合依赖"存入 proxy、经 get 返回 proxy 并追踪嵌套变更"的用法需迁移为 deep 集合（见上）。`new Function("return this")` 的 globalObj fallback 按旧 React Native 兼容性要求保留未动。
