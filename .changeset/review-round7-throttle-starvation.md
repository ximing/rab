---
'@rabjs/service': patch
'@rabjs/react': patch
---

Review round 7 — cross-audit fixes for throttle/debounce edge semantics and a frozen-instance snapshot pin:

- `@Throttle(wait, { leading: false })` no longer starves under a continuous call stream: the trailing timer is no longer re-armed on every in-window call (which kept pushing the deadline past the next call forever), so a throttled method now fires once per window while events keep arriving. Previously such streams never executed the method until the stream stopped.
- `@Throttle` with `leading: false` never invokes synchronously anymore: the window-expired branch now defers to the trailing timer instead of calling the method inline.
- `@Debounce(wait, { leading: false, maxWait })` no longer invokes the **first** call synchronously (the maxWait branch mistook `lastInvokeTime === 0` for "max wait exceeded"). `maxWait` is now enforced by a per-burst cap timer armed at burst start, so deferral is capped even when no further call arrives to re-check the condition.
- `@Debounce` / `@Throttle`: reentrant calls made from inside the method body are never invoked synchronously (recursion/stack-overflow guard); they are deferred to the trailing timer instead.
- `view` class components that freeze `this` inside `componentDidMount` now release the mount-snapshot contents on the degradation path instead of pinning every observable read during the first render until GC.
