---
'@rabjs/web-mcp': patch
'@rabjs/react': patch
---

web-mcp 支持 Zod 4 原生 `z.toJSONSchema`，并保留 Zod 3 的 `zod-to-json-schema` 回退；react 在测试环境（`IS_REACT_ACT_ENVIRONMENT`）下用 `React.act` 包装 store 通知，消除 React 19 的 act 警告。
