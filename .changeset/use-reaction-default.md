---
'@rabjs/react': patch
---

`useReaction(effect)` now runs on mount and tracks dependencies by default (`immediate` defaults to true, #195). Passing `immediate: false` still primes the reaction once so later updates fire.
