---
'@rabjs/observer': patch
---

fix(observer): batch 回调与 reaction 抛同一 Error 实例时不再误报 "was dropped"（严格 console 环境误 fail）；debugger 新增 wantsOldValue=false 豁免，不消费 oldValue 的 debugger 不再让 Map/Set clear() 付 O(n) 旧值快照
