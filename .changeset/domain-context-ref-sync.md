---
'@rabjs/react': patch
---

`useDomainContext` now syncs its internal ref on every render, so consumers (`useService` / `useContainer` / `useContainerEvents`) follow `DomainContext.Provider` value changes instead of permanently resolving against the first-render container (#217).
