---
'@rabjs/react': patch
---

view class components: when a user `componentDidMount` throws and the mount finalization's dependency-collection render re-run also throws, the user's original error is now preserved for the error boundary (the secondary error is demoted to a dev-mode warning) instead of replacing the in-flight error via `finally` semantics — same "never replace an in-flight exception" principle as `batch` (#212).

A component whose instance is `Object.freeze`d inside `componentDidMount` now emits a dev-mode warning that reactivity is disabled, instead of silently degrading for its entire lifetime.

`CleanupAllMemosOptions` is now re-exported from the package root's type exports.
