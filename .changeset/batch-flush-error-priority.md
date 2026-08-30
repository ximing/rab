---
'@rabjs/observer': patch
---

`batch(fn)` no longer lets a flush-time reaction error replace the callback's own in-flight exception. Previously `try { batch(mutate) } catch` caught the reaction's error while the callback's original error was silently dropped; the flush error is now attached as `cause` on the original error when possible (#212).
