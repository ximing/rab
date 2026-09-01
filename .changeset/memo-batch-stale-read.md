---
'@rabjs/service': patch
---

Fix `@Memo` getters returning stale cached values when read inside `batch()` (including the implicit batch around array mutators). Cache invalidation bookkeeping (`computed = false`) now happens synchronously on the trigger path via the reaction's `debugger` hook (filtered to write operations); only the outer `notify` stays deferred to flush. The memo's inner reaction is also reused across recomputations instead of being recreated, so a notify queued mid-batch can no longer be dropped (#248).
