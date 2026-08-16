---
"@rabjs/observer": patch
---

Fixes reactivity correctness and safety issues in @rabjs/observer:

- **数组枚举依赖失灵（正确性）**: 注册侧把 iterate 依赖存在 ITERATION_KEY symbol 下，通知侧对数组却按 "length" 查找 —— 两者永不相交。`Object.keys(arr)` / `for...in` / 展开等枚举依赖在 `push` / `delete` 时不再静默失效；`arr.length = N` 收缩时会通知被截断索引的依赖（此前直接读 `arr[i]` 的 reaction 会一直读到脏数据）。
- **`Object.defineProperty` 绕过响应式（正确性）**: 补齐 `defineProperty` trap（base 与 shadow 两个 handler），defineProperty 修改属性现在会正常触发 reactions。set trap 转发期间有重入守卫，避免普通赋值被双重通知。
- **原型污染（安全）**: 读取 `__proto__` 不再把 `Object.prototype` / `Array.prototype` 包装成 observable（此前 `state.__proto__.x = 1` 会污染全局原型并进入响应式系统）；对 observable 赋值 `__proto__` 现在抛 `TypeError`（fail-fast），堵住 JSON 注入 + 深合并的静默改原型路径；原型链上的 `constructor` / `prototype` 保持原生语义不再被包装。
- **shadowObservable 集合 unknown-key（兼容性）**: 此前 `map.constructor` 为 `undefined`、`String(map)` 抛 `TypeError`；现在回退到原生属性，原生方法绑定 raw target（`constructor` 保持恒等性不受绑定影响）。
- **集合依赖的 key 强持有（内存）**: Map/Set/WeakMap/WeakSet 的对象 key 现以 WeakRef 包装存储，不再阻止 key 被 GC（WeakMap 语义恢复）；无 WeakRef 的旧 RN JSC 环境自动退化为原行为。
- **性能**: 原始值属性读取跳过 `getOwnPropertyDescriptor`（微基准约 -26% 读取耗时）；无依赖写入提前返回，不再分配空数组。

注意: 此前依赖"对 observable 赋值 `__proto__`"或"defineProperty 不触发通知"的代码行为会变化（前者抛错）。`new Function("return this")` 的 globalObj fallback 按旧 React Native 兼容性要求保留未动。
