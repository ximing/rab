---
'@rabjs/react': patch
---

`bindServices` now destroys its container on unmount instead of waiting for the FinalizationRegistry/GC fallback. Service cleanup (event listeners, debounce/throttle timers) previously stayed pending for an unbounded window. Destroy is scheduled on a microtask so React StrictMode's fake unmount/remount does not tear down a live container; the GC fallback is kept for concurrent renders that never commit (#218).

**Behavior change**: the container is private to the bound subtree by design. Service instances held outside the subtree (stored in refs, injected into parent/global containers, kept in external caches) become destroyed objects after unmount — do not let subtree services escape; if an instance's lifetime must outlive the component, register it in a parent container instead (#252).
