---
'@rabjs/observer': patch
---

Fix two leftover observer issues from PR #91:

- **#92**：跨 realm Map/Set 在 `observable()` 包装前已预置 observable proxy key 时，条目现在会归一化为 raw（`instanceof` 对跨 realm 集合不成立，改用与集合路由相同的 tag + duck-check）。此前 `has`/`get`/`delete` 双身份都失灵，再 `set` 同一逻辑 key 还会产生重复条目。
- **#93**：新增 `batch(fn)`；数组变异方法（`push`/`pop`/`splice`/`fill` 等）一次调用只通知每个 reaction 一次，且读到最终值。`batch` 之外的单次赋值仍立即同步执行。`Array.prototype.push.call(arr, ...)` 仍不自动 batch。
