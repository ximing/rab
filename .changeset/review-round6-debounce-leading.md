---
'@rabjs/service': patch
---

`@Debounce(wait, { leading: true })` now fires the leading edge on **every** burst, not only on the first call of the instance's lifetime: after a quiet period (≥ wait) the next call invokes immediately (lodash semantics, matching the docstring). Previously such calls fell through to trailing-only — and with `trailing: false` they were silently never executed.

Suppressed calls that can never execute now release their `args`/`this` references instead of pinning the payload until the next invocation (process-lifetime for detached calls): `@Debounce` tails with `trailing: false` release when the disarmed timer fires; `@Throttle` in-window calls with `trailing: false` release immediately, as does a reentrant pending call that no timer can ever fire.
