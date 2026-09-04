---
'@rabjs/react': patch
---

view class components: a throwing user `componentDidMount` (prototype method or arrow-function field) no longer skips the wrapper's mount finalization — dependency tracking is now enabled in a `finally`, matching the unmount-side guarantee that a throwing `componentWillUnmount` still releases the reaction. A component instance that survives the throw (e.g. error-boundary retry) no longer stays silently non-reactive.
