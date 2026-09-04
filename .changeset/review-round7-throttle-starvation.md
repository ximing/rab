---
'@rabjs/service': patch
'@rabjs/react': patch
---

Review round 7 — cross-audit fixes for throttle/debounce edge semantics and a frozen-instance snapshot pin:

- `@Throttle(wait, { leading: false })` no longer starves under a continuous call stream. Two re-arm bugs stacked: (1) the first-call path treated `lastInvokeTime === 0` as “always first” and reset the trailing timer on every in-window call; (2) after the first trailing invoke, later calls land in the window-expired branch (because `startTimer` schedules a full `wait` from the arming call, which is after `lastInvoke`), and that branch cancelled the in-flight timer and re-armed a full `wait` — pushing the deadline past the next event forever. The trailing timer is now left alone once armed, so a throttled method fires once per window while events keep arriving.
- `@Throttle` with `leading: false` never invokes synchronously anymore: the window-expired branch now defers to the trailing timer instead of calling the method inline.
- `@Debounce(wait, { leading: false, maxWait })` no longer invokes the **first** call synchronously (the maxWait branch mistook `lastInvokeTime === 0` for "max wait exceeded"). `maxWait` is now enforced by a per-burst cap timer armed at burst start, so deferral is capped even when no further call arrives to re-check the condition.
- `@Debounce` / `@Throttle`: reentrant calls made from inside the method body are never invoked synchronously (recursion/stack-overflow guard); they are deferred to the trailing timer instead.
- `@Throttle` trailing no longer re-checks `Date.now() - lastInvokeTime >= wait` in the timer callback. That second clock comparison dropped the in-window last call when the timer fired slightly early, the clock stepped backwards, or `Date.now` was frozen. The wait is already enforced by `setTimeout`; the callback only looks at `hasPendingCall`.
- `view` class components that freeze `this` inside `componentDidMount` now release the mount-snapshot contents on the degradation path instead of pinning every observable read during the first render until GC.
