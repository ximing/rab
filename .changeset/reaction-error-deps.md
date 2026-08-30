---
'@rabjs/observer': patch
---

Failed reaction re-runs restore the last successful dependency set. Previously `runAsReaction` released all connections up front and a throw left only keys read before the throw point, so later keys went silent until the next successful run (#213).
