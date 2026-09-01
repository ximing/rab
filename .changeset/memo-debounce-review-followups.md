---
'@rabjs/service': patch
---

fix(service): review followups —— symbol 命名的 @Memo 纳入 cleanupAllMemos 清理；cleanupAllMemos 通知阶段 reaction 抛错不再中断清理；@Debounce/@Throttle 分离调用的哨兵状态随 destroy 一并清理；@Memo 同步失效钩子声明 wantsOldValue=false 豁免 clear 快照；@Memo flush 不再丢弃 mid-batch 重算（dirty 记账，不纯 getter 值发散修复）
