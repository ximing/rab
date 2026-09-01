---
'@rabjs/observer': patch
'@rabjs/react': patch
'@rabjs/service': patch
---

fix(observer): `untracked()` 窗口内被写入同步触发重跑的 reaction 不再丢失全部依赖 —— untracked 只屏蔽「调用时刻的当前派生」（MobX 语义），reaction 运行边界重置深度计数器，此前窗口内重跑的 reaction 会以零依赖收场、永久失效；新增 `isUntracked()` 内部查询导出

fix(observer): `setToOwner` 反查表（#12 空 entry 清理）改为弱持有 ConnectionMap —— 此前任一存活 reaction 会经 `cleaners → Set → setToOwner value` 钉住同 target 整张 ConnectionMap，连带钉住其他 key 上所有 reaction 闭包引用的对象，架空 connectionStore 根 WeakMap 对不可达 target 的回收

fix(service): `@Debounce`/`@Throttle` 修复 leading/maxWait/窗口过期立即执行路径的幽灵尾调用 —— invokeFunc 释放 lastArgs/lastThis 后，trailing 定时器到点会以 `this=undefined`、空参数重放用户方法（轻则定时器回调抛 TypeError，重则方法多执行一次）；trailing 现在只在「上次 invoke 之后有新调用」时触发（lodash 语义），窗口内的后续调用行为不变

fix(service): `@Memo` 链式依赖记账遵守 `untracked()` 边界（`untracked(() => this.memoB)` 不再构成 A→B 链式边）；链式边（memoDeps）在 WeakRef 环境下弱持有上游 CacheState，长寿命实例的 memo 不再把读过的 transient 上游实例保留到自己重算/销毁为止

fix(react): view 类组件 Suspense/Offscreen 隐藏→显示（reveal）时 DOM 不再停留在隐藏前的旧值 —— cDM 重放路径没有快照可比对，按 master 语义无条件 forceUpdate 完成重渲染与依赖收集；componentWillUnmount 现在重置 `_committed`，隐藏树被驱动重渲染时回到 commit 前探针路径，修复「隐藏中 render 重建存活 reaction、随后子树在隐藏中删除导致 reaction 永不释放」的泄漏

fix(react): view 挂载快照支持 `key-iterate` 依赖类型（Map.keys() 的 key 集合变更此前恒判「无差异」）；快照捕获/对比不再执行用户 accessor（此前 `Reflect.get(rawTarget, key)` 会以 raw 身份执行 @Memo getter：挂载期多算一次，且留下注册不到依赖、永不失效的 raw 身份缓存）—— accessor 一律按「已变化」处理，宁可多更一次
