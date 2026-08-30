---
'@rabjs/service': patch
---

`@Inject` caches are now per-instance instead of shared across every instance of the class. Previously the first instance's resolved dependency (from whatever container it belonged to) leaked into all other instances, including cross-container and re-bound scenarios, and a manual `set` on one instance overwrote every other instance's injection (#219).
