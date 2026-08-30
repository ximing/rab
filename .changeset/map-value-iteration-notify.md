---
'@rabjs/observer': minor
---

Map value overwrites (`map.set(k, v)` for an existing key) now notify value-side iteration dependencies (`forEach` / `values` / `entries` / `for...of` / `size`), which previously never re-ran and kept reading stale data. `Map.keys()` iterations moved to a separate key-side bucket (Vue's `MAP_KEY_ITERATE_KEY` design) so they are still only triggered by add/delete/clear, not by value overwrites (#211). Forged `[object Map]` plain objects still use the object set path and do not re-run `ownKeys` observers.
