---
'@rabjs/service': patch
---

`@Debounce` / `@Throttle` state (timers, pending args, `this`, results) is now stored per instance instead of in the decorator closure shared by every instance of the class. Previously one instance's pending call was silently dropped when another instance invoked the same method, and destroying one instance cancelled every other instance's pending calls (#220).
