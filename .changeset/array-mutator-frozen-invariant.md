---
'@rabjs/observer': patch
---

Fix a `TypeError: 'get' on proxy` when reading a frozen (non-configurable + non-writable) own array mutator property on an observable array. The batch-wrapping introduced for array mutators (#93) ran before the Proxy get invariant check and returned a different function object; the invariant check now runs first in both base and shadow get traps (#251).
