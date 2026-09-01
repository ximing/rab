---
'@rabjs/react': patch
---

fix(react): view 包装器对密封/freeze 实例降级而非构造期崩溃 —— 内部字段改 declare + 守护赋值，重绑定与生命周期写字段全部 try/catch 兜底并发 dev 警告
