---
'@rabjs/service': patch
'@rabjs/observer': patch
'@rabjs/react': patch
---

fix: review round 2 —— @Memo 链式场景 flush 不再丢弃 mid-batch 重算（链 notify 由版本快照裁决，不纯 getter 前后发散修复）；@Memo 失效钩子声明 reentrantSafe，isDebugging 重入窗口（用户 debugger 内的嵌套写）不再丢失失效；链式边的归属判定改用当前运行 reaction，其他 reaction 在计算窗口内的 memo 读取不再制造假边；@Memo/@Throttle/@Debounce 清理函数改按真实 propertyKey 注册，同 description 的 symbol 键不再撞名交叉清理，symbol 方法纳入 destroy 清理；view 类组件挂载不再产生伪 update commit（componentDidUpdate/getSnapshotBeforeUpdate 不再紧随 mount 触发）；箭头字段 componentWillUnmount 抛错时 reaction 仍被释放
