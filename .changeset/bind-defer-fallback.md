---
'@rabjs/react': patch
---

`bindServices` container teardown scheduling now falls back `queueMicrotask` → `Promise` → `setTimeout`, so cleanup still happens in legacy JS engines without `queueMicrotask` (old React Native JSC/Hermes). Also extracts an internal `createContainer` factory used by both creation and the hidden-tree rebuild path.
