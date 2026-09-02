---
'@rabjs/observer': patch
'@rabjs/react': patch
'@rabjs/service': patch
---

fix(react): view 挂载快照补全 WeakMap/WeakSet 处理 —— collection-handler 对 WeakMap.get/has、WeakSet.has 同样注册 get/has 依赖，快照侧此前只识别 Map/Set：WeakMap 落入数据属性读取恒得 undefined、WeakSet 经 Reflect.has 恒得 false，捕获与对比两端恒等，commit 窗口内的 set/add 被静默丢失（DOM 停留在首渲染旧值）。observer 侧导出 isWeakMapTarget/isWeakSetTarget（与 instrumented 路由同一套 tag 判定），快照按原生方法读取，不触发用户代码

fix(observer): untracked 窗口内手动执行的 unobserved reaction 不再向其自身 debugger 投递 —— reaction 运行边界的深度重置只服务 tracked reaction 重建依赖，unobserved 分支本就不注册依赖，同步重置破坏了「untracked 窗口内的读取对响应式系统完全不可见」的契约

fix(service): 同一方法被同类型装饰器重复装饰（@Debounce(50) @Debounce(100)）时 destroy 清理全部装饰层的 pending 定时器 —— 清理注册由按 propertyKey 去重改为组合，后装饰层的 store 定时器不再在 destroy 后残留并幽灵触发

chore(observer,service): test:release 增加 NODE_OPTIONS=--expose-gc —— WeakRef 回收类测试（memo 链式边弱持有、weak-keys-gc）此前在发布门禁下静默 skip，核心内存修复无 CI 守护
