---
'@rabjs/react': patch
---

`bindServices` now destroys its container synchronously on unmount instead of waiting for the FinalizationRegistry/GC fallback. Service cleanup (event listeners, debounce/throttle timers) previously stayed pending for an unbounded window; the GC fallback is kept for concurrent renders that never commit (#218).
