---
'@rabjs/observer': patch
---

The README's known-limitations section now documents the actual dependency semantics after a failed re-run: the reaction stays alive, but only dependencies read before the throw point survive; the rest recover on the next successful run (#213).
