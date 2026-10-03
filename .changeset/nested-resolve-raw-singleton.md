---
'@rabjs/service': patch
---

fix(service): resolve/emit/on/once 一律走 raw 容器，修复嵌套 resolve 缓存失去响应式的单例

在 Service 构造器或方法里首次 `this.resolve(X)` 时，`this._container` 经 observable 代理读取被包装成容器代理，下游 definition 随之成为代理；其 set trap 将待缓存的实例 `toRawIfProxy` 解包成 raw target，导致单例永久失去响应式——之后组件 `useService`/`container.resolve` 拿到的实例不再触发任何 UI 更新。

现在 `Service.resolve`/`emit`/`on`/`once` 统一在使用点内联 `raw(this._container)` 解包（不能封装 getter：proxy 的 get trap 会重新包装返回值），嵌套实例化与组件实例化一样缓存代理实例。附 `nested-resolve-reactive` 回归测试。
