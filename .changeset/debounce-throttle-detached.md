---
'@rabjs/service': patch
---

`@Debounce`/`@Throttle` no longer throw `TypeError: Invalid value used as weak map key` on detached calls (`this` null/undefined, e.g. `arr.map(service.save)` or destructured methods). Detached calls share one module-level sentinel state, matching the pre-WeakMap closure behavior (#250).
