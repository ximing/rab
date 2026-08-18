---
"@rabjs/react": patch
"@rabjs/service": patch
---

依赖升级：`@rabjs/observer` 升至 9.1.0（响应式正确性与安全性修复，含行为变更——详见 @rabjs/observer 9.1.0 changeset 与 PR #91）。react/service 自身无代码变更，随依赖 bump patch 版本。

注意：react/service 的 jest 已映射到 observer workspace 源码（PR #91），全部测试（react 175 / service 218）在新 observer 行为下验证通过。
