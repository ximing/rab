---
'@rabjs/service': patch
---

`@Debounce`/`@Throttle`: a reentrant call made from inside the decorated method's own body is no longer silently dropped — `invokeFunc`'s reference release now only clears the pending state when no newer call arrived during the invocation, so the reentrant call's armed timer still fires.

Subclass re-decoration of the same method name no longer skips the base decorator layer's cleanup: `runAllCleanups` executes every layer's cleanup (cleanups are idempotent), and `cancelDebounce`/`cancelThrottle` cancel all layers — a base-layer timer armed via `super.save()` no longer ghost-fires after `destroy()`.

`CleanupAllMemosOptions` is now re-exported from the package root.
