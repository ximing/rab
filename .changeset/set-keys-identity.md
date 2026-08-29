---
'@rabjs/observer': patch
---

Deep `Set` `keys()` / `entries()` / `forEach` now wrap members the same way as `values()`, restoring the native `keys === values` and `entryKey === entryValue` identity (#192). Map keys stay raw.
