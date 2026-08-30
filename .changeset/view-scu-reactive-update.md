---
'@rabjs/react': patch
---

`view()` class components now flush reactive updates with `forceUpdate` instead of `setState({})`, so a user-defined `shouldComponentUpdate` returning `false` can no longer swallow observable-triggered re-renders (#198). User SCU still governs props / own-state updates.
