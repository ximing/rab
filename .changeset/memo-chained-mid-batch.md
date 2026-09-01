---
'@rabjs/service': patch
---

fix(service): 链式 @Memo mid-batch 读到过期缓存 —— 计算期间采集 memo→memo 依赖边，缓存命中前递归校验链有效性（#248 链式补全）
