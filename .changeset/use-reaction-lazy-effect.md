---
'@rabjs/react': minor
---

`useReaction` gains a two-function (MobX `reaction`-style) overload `useReaction(dataFn, effect, { fireImmediately })`: the data function collects dependencies on mount without running the effect, and the effect runs with `(current, previous)` only after dependencies change. This provides the "don't run on mount" semantics that the single-function form's `immediate: false` cannot express, since the effect and dependency collection share one function there (#200). The single-function form's `immediate` JSDoc now documents this honestly.
