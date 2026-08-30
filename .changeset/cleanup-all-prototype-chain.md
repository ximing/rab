---
'@rabjs/service': patch
---

`cleanupAllMemos` / `cleanupAllDebounces` / `cleanupAllThrottles` now walk the full prototype chain instead of only the direct prototype. Decorated members defined on a base class are cleaned up when a subclass instance is destroyed; previously their memo reactions kept running and debounce/throttle timers kept firing on destroyed instances (#221).
