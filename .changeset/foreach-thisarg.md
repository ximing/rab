---
'@rabjs/observer': patch
---

Map/Set `forEach` now forwards `thisArg` and passes the observable proxy as the third callback argument, so writes like `map.set(...)` inside `forEach` notify reactions (#191). Shadow collections do the same for the third argument while still exposing raw values.
