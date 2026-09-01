---
'@rabjs/react': patch
---

`useReaction(dataFn, effectFn)`: reads inside the effect are no longer collected as dependencies — the effect now runs untracked (MobX `reaction` semantics), so mutating observables only touched by the effect no longer spuriously re-fires it (#249). Also, passing the ignored `lazy` option to the single-function form now emits a development-mode warning instead of being silently dropped (#253).
