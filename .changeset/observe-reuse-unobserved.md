---
'@rabjs/observer': patch
---

`observe(r)` on a previously unobserved reaction now resets the `unobserved` flag, restoring it as a live reaction that collects dependencies and reacts to changes. Previously the reuse path returned a reaction that executed once (appearing revived) but never tracked dependencies again, silently ignoring all subsequent changes (#215).
