---
'@rabjs/observer': patch
'@rabjs/service': patch
'@rabjs/react': patch
---

`@Memo` getters now notify outer `observe` / `observer` when their deps change (#196). Observer exports `notify(target, key)` for this; React re-exports it.
