---
'@rabjs/observer': patch
---

`batch()` flush-error handling hardening: attaching the flush error as `cause` is skipped when the callback and a reaction threw the identical `Error` instance (a self-referential `cause` loops naive cause-chain walkers), and the `console.warn` fallback for unattached flush errors is itself isolated so throwing console shims cannot replace the in-flight exception. Also, reviving an unobserved reaction via `observe(r)` no longer overwrites its custom `scheduler`/`debugger` with global defaults.
