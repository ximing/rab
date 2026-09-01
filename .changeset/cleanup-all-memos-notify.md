---
'@rabjs/service': patch
---

`cleanupAllMemos` now notifies outer observers per cleaned memo key (batched into a single flush), matching `invalidateMemo` semantics — mounted `observe`/`observer` consumers no longer stay stale after a cache reset. `Service.destroy` passes `{ notify: false }` to keep its deliberate silence (#255).
