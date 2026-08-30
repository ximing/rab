---
'@rabjs/service': patch
---

`invalidateMemo(instance, key)` now notifies outer `observe` / `observer` reactions after clearing the cache (#199), aligning the manual invalidation path with the dependency-change path from #196. `cleanupAllMemos` / `Service.destroy` keep the previous no-notify behavior.
