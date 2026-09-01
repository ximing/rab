---
'@rabjs/observer': patch
'@rabjs/react': patch
'@rabjs/service': patch
---

feat(observer): 新增一等 `untracked(fn)` 原语（MobX untracked 语义）—— 回调内的 observable 读取不注册依赖、不进入任何 reaction 的 debugger，异常安全、支持嵌套；取代 react 侧依赖未文档化内部行为的「屏蔽 reaction」实现

fix(react): view 类组件 commit 窗口（自身/子组件 cDM 等）内的 store 变更不再丢失 —— 首渲染用一次性探针 reaction 记录读取快照，_onDidMount 对比快照，有差才 forceUpdate（窗口内无变更仍不产生伪 update）；useReaction 双函数形式的 effect 改用核心 untracked() 原语；同时修复原型方法 componentWillUnmount 抛错跳过 reaction 清理的订阅泄漏，以及 class Sub extends view(Base) 时子类箭头生命周期字段覆盖包装器组合函数导致的响应式丢失

fix(service): cancelDebounce/cancelThrottle 不再连带取消与本实例无关的 pending 分离调用（detached 共享状态改由 destroy 路径单独清理）；@Debounce/@Throttle 触发后立即释放对调用参数与 this 的引用，避免 detached 哨兵状态把用户 payload 驻留到进程结束；detached 状态存储与清理注册下沉为 cleanup-registry 的共用实现

> 注：untracked 按惯例是 minor 级新 API，因 fixed 版本组会联动全部包，本轮随修复走 patch；如需严格 semver 可在发版前改为 minor。
