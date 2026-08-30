---
'@rabjs/react': patch
---

`useAsObservableSource` now wraps a shallow copy of the input instead of the original object, so passing React component props no longer throws `TypeError: 'set' on proxy: trap returned falsish` in dev mode (React freezes props) (#216). The caller's original object is never mutated.
