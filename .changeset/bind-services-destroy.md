---
'@rabjs/react': patch
---

`bindServices` now destroys its container on unmount instead of waiting for the FinalizationRegistry/GC fallback. Service cleanup (event listeners, debounce/throttle timers) previously stayed pending for an unbounded window. Destroy is scheduled on a microtask so React StrictMode's fake unmount/remount does not tear down a live container; the GC fallback is kept for concurrent renders that never commit (#218).
