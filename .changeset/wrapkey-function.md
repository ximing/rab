---
'@rabjs/observer': patch
---

`wrapKey` now WeakRef-wraps function collection keys the same as object keys, so `observe(() => wm.has(fn))` no longer pins `fn` for the life of the WeakMap (#194).
