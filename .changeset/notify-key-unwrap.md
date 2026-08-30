---
'@rabjs/observer': patch
---

`notify(target, key)` now unwraps a proxy-form key the same way collection traps do. Passing an observable object as a Map/Set key to `notify` previously looked up a fresh WeakRef that never matched the registered (raw-identity) dependencies, silently notifying no one (#214).
