---
'@rabjs/react': patch
---

Class `view()` skips reaction creation when `enableStaticRendering(true)` is set, matching `observer()` / `useObserver` so SSR does not leak subscriptions (#197).
