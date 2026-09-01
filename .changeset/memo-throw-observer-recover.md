---
'@rabjs/service': patch
---

Fix outer `observe`/`observer` consumers of a `@Memo` getter going permanently silent after the getter throws once. The proxy get trap registers the dependency only after the getter returns, so a throwing getter left the outer reaction with zero dependencies and no later change could wake it. The memo accessor now pre-registers the `(instance, key)` dependency through the `has` trap before computing, so recovery works once the underlying data is fixed (#247).
