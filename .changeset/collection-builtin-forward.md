---
'@rabjs/observer': patch
---

Tighten collection builtin-method forwarding (#193): only own methods on Map/Set prototypes are forwarded (so `valueOf`/`toString` stay on the proxy and no longer subscribe to iterate). ES2024 methods also subscribe to an observable `other` operand, and cross-realm `Set.union` is applied to the raw target instead of throwing.
