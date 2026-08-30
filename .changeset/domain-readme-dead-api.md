---
'@rabjs/react': patch
---

The domain README now documents the real API (`bindServices` with tuple-style service registrations, `RSRoot`/`RSStrict`) instead of the non-existent `createDomain`/`Provider`/`createNestedDomain` functions and the object-form `{ identifier, factory }` registrations that throw at runtime. The dead `ProviderOptions`/`ProviderResult`/`DomainComponent` types and the broken `types/window.d.ts` are removed (#223).
