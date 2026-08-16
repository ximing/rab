# rab-rn-debug 设计文档

日期：2026-08-16
状态：已确认设计，待实现

## 1. 背景与目标

rabjs 已支持 React Native。浏览器端已有 `rab-cdp-debug` skill（Agent 通过 Chrome DevTools MCP 的 `evaluate_script` 操控 `window.__RS_ROOT_CONTAINER__` 调试 Service），但 RN 端没有 CDP，Agent 无法触达真机/模拟器上运行的应用。

本设计实现 `rab-rn-debug`：一套让 Agent 通过指令调试 RN 应用的机制：

- 电脑上启动一个本地调试服务（`@rabjs/rn-debug-server`）。
- RN 应用集成 Debug SDK（`@rabjs/rn-debug`），通过 WebSocket 长连接接入服务，顺序执行指令并回传结果。
- Agent 通过 HTTP 向服务发送指令；请求挂起（pending），待设备执行完毕经服务端中转后返回结果。
- 服务自带调试页面，实时展示设备连接状态与指令收发流水。
- 配套 skill `skills/rab-rn-debug/SKILL.md`，指导 Agent 使用。

### 非目标（YAGNI）

- 不做组件树快照（依赖 React internals，复杂度高）。
- 不做任意 JS eval 指令（结构化指令为主，保证 release 可用与安全）。
- 不做 mDNS 自动发现（手动配置 IP+端口即可）。
- 不做指令的持久化存储 / 历史回放。

## 2. 总体架构

```
┌─────────┐  HTTP(同步pending)  ┌──────────────────────┐  WebSocket  ┌──────────────┐
│  Agent  │ ─────────────────▶ │  rn-debug-server      │ ◀─────────▶ │ RN App (SDK) │
│ (Claude)│ ◀───────────────── │  localhost:9229       │  JSON 消息   │ @rabjs/rn-   │
└─────────┘   设备执行完才返回   │  · 设备注册表          │             │   debug      │
                               │  · 每设备串行队列       │             │ · WS 客户端   │
┌─────────┐  HTTP + WS(events) │  · HTTP API for Agent │             │ · 指令调度器  │
│ 调试页面 │ ◀───────────────▶ │  · 静态调试页面         │             │ · handler 表 │
└─────────┘                    └──────────────────────┘             └──────────────┘
```

关键链路语义：

- Agent 的 HTTP 请求**同步挂起**，直到设备执行完并经 WS 回传结果（或服务端超时）。
- 同一设备的指令**严格串行**：服务端保证每设备最多一个 in-flight 指令（其余排队），SDK 侧也按序执行，双保险。
- 多设备同时连接，按 `deviceId` 路由。

## 3. 包划分

monorepo 新增两个 package + 一个 skill：

| 名称 | 类型 | 职责 |
|------|------|------|
| `@rabjs/rn-debug` | RN 端 SDK | WS 客户端、指令调度、内置 handler、console 拦截 |
| `@rabjs/rn-debug-server` | Node CLI | WS 服务、Agent HTTP API、调试页面 |
| `skills/rab-rn-debug/SKILL.md` | skill 文档 | 指导 Agent 使用本机制 |

## 4. `@rabjs/rn-debug`（RN 端 SDK）

### 4.1 入口

```ts
import { setupRNDebug } from '@rabjs/rn-debug';

setupRNDebug({
  host: '192.168.1.5',   // 电脑局域网 IP，手动配置
  port: 9229,
  appName: 'MyApp',       // 可选，默认取应用名
  handlers: {             // 可选，应用自定义指令
    'app.clearCache': async () => { /* ... */ return { cleared: true }; },
  },
});
```

- 仅 `__DEV__` 为 true 时生效；生产构建中调用为空操作（no-op），不产生任何网络连接。
- 幂等：重复调用不重复建连。

### 4.2 WS 客户端

- 连接 `ws://<host>:<port>/device`。
- 断线自动重连，指数退避（1s → 2s → 4s → … → 上限 30s）。
- 心跳：每 15s 发 `{"kind":"ping"}`，服务端据此更新 `lastSeen`。
- 连接成功后立即发送 `register`：

```jsonc
{
  "kind": "register",
  "deviceId": "rn-ios-<nanoid>",   // SDK 生成，进程生命周期内稳定
  "info": {
    "appName": "MyApp",
    "platform": "ios",             // Platform.OS
    "osVersion": "17.5",
    "sdkVersion": "0.1.0"          // @rabjs/rn-debug 版本
  }
}
```

### 4.3 指令调度器

- 收到 `{"kind":"command","id","type","payload"}` 后按接收顺序逐个执行（内部 FIFO 队列，不并发）。
- 查 handler 表 → 执行（支持 async）→ 回传：

```jsonc
// 成功
{"kind":"result","id":"cmd-123","status":"ok","result":{ ... }}
// handler 抛错
{"kind":"result","id":"cmd-123","status":"error","error":{"message":"...","stack":"..."}}
// 未注册的指令类型
{"kind":"result","id":"cmd-123","status":"error","error":{"message":"unknown command type: xxx"}}
```

- handler 返回值必须是 JSON 可序列化的；SDK 在发送前做一次可序列化清洗（移除循环引用、函数、undefined 字段），清洗失败按 error 回传。

### 4.4 内置 handler

| 指令 type | payload | 说明 |
|-----------|---------|------|
| `ping` | — | 返回 `{pong: true, time}` |
| `device.info` | — | 返回 register 时的 info + 当前连接状态 |
| `rab.listServices` | — | 枚举容器树中所有已实例化 Service（instanceId / containerName / identifierLabel） |
| `rab.getServiceState` | `{instanceId? , identifierLabel?, paths?}` | 读取 Service 状态；`paths` 为点号路径数组，缺省返回顶层可序列化字段 |
| `rab.callServiceMethod` | `{instanceId, method, args?}` | 调用 Service 方法（支持 async），返回方法返回值的可序列化结果 |
| `rab.expect` | `{instanceId, description?, assertions: [{op, path, expected?, message?}]}` | 复用 RSExpectBuilder 断言，返回 `.run()` 的结构化结果 |
| `console.getLogs` | `{level?, limit?}` | 返回环形缓冲中的日志条目 |

`rab.*` 系列依赖一个平台无关的容器 handle：与 `@rabjs/devtools` 的 root-container-handle 同思路，但基于 `getGlobalContainer()`（`@rabjs/service`）构建，不依赖 `window`。`setupRNDebug` 时自动构建。断言能力复用 devtools 的 `RSExpectBuilder`（`op` 取值与 rab-cdp-debug skill 文档一致）。

### 4.5 console 日志

- dev 下 patch `console.log/info/warn/error/debug`，原文输出不受影响，同时写入环形缓冲（容量 500 条）。
- 每条记录 `{level, args（可序列化清洗后）, time}`。
- 同时通过 WS 发送 `{"kind":"event","event":"console","data":{...}}`，服务端实时转发给调试页面（服务端不落盘）。

### 4.6 自定义 handler

```ts
import { registerHandler } from '@rabjs/rn-debug';

registerHandler('app.gotoScreen', async ({ name }) => {
  navigationRef.navigate(name);
  return { current: name };
});
```

- `registerHandler(type, handler)`：`type` 全局唯一，重复注册抛错（防覆盖内置指令）。
- handler 可同步或返回 Promise，返回值须 JSON 可序列化。

## 5. `@rabjs/rn-debug-server`（Node CLI）

### 5.1 启动

```bash
npx rab-rn-debug            # 默认端口 9229
npx rab-rn-debug --port 9300
```

- 依赖仅 `ws`；HTTP 用 `node:http`，调试页面为单文件自包含 HTML（内嵌于包内），无前端构建链。
- 启动后在终端打印：监听地址、本机局域网 IP 列表（方便用户填进 SDK 配置）、调试页面 URL。

### 5.2 设备注册表

`Map<deviceId, { ws, info, connectedAt, lastSeen }>`。WS 断开即标记离线并从列表移除；调试页面实时反映。

### 5.3 Agent HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/devices` | 设备列表 `[{deviceId, info, connectedAt, lastSeen}]` |
| POST | `/api/devices/:deviceId/commands` | 向指定设备发指令 |
| POST | `/api/commands` | 不带 deviceId：唯一在线设备直接路由；多设备返回 409 并在 body 列出候选；无设备返回 404 |
| GET | `/api/commands/:id` | 查询指令状态（pending/ok/error/timeout），用于调试页面展示 |

请求体：

```jsonc
{ "type": "rab.listServices", "payload": {}, "timeout": 30000 }  // timeout 可选，默认 30000，上限 120000
```

响应（HTTP 200，业务状态在 body 内）：

```jsonc
{ "id": "cmd-123", "status": "ok", "result": { ... }, "durationMs": 42 }
{ "id": "cmd-124", "status": "error", "error": { "message": "...", "stack": "..." }, "durationMs": 7 }
{ "id": "cmd-125", "status": "timeout", "durationMs": 30000 }
```

路由错误：设备不存在/已离线 → 404；多设备歧义 → 409。

### 5.4 串行化与 pending 实现

- 每设备维护一个 promise 链（`queue = queue.then(() => sendAndAwait(cmd))`），保证严格串行。
- `sendAndAwait`：写入 WS → 将 `{resolve, reject, timer}` 存入 `pendingMap<cmdId>` → 收到 `result` 时 resolve；超时 reject 并清理。
- 设备 WS 断开时，该设备所有 pending 指令立即以 `{status:'error', error:{message:'device disconnected'}}` 结束，队列清空。

### 5.5 调试页面（`GET /`）

单文件 HTML + 原生 JS，通过 WS `ws://<host>:<port>/events` 订阅服务端事件流：

- 设备面板：在线设备列表（deviceId、appName、platform、连接时长、心跳存活指示）。
- 指令面板：指令发送表单（选设备、type、payload JSON 编辑器），提交走与 Agent 相同的 HTTP API。
- 流水面板：指令时间线（发送时间、设备、type、状态、耗时、请求/响应 JSON 可展开）。
- 日志面板：设备实时转发的 console 事件流（按 level 过滤）。

服务端事件来源：设备 register/disconnect、指令 lifecycle（sent/result）、console event。

### 5.6 WS 协议汇总

```jsonc
// 设备 → 服务端
{"kind":"register","deviceId":"...","info":{...}}
{"kind":"ping"}
{"kind":"result","id":"cmd-123","status":"ok|error","result":{...},"error":{...}}
{"kind":"event","event":"console","data":{"level","args","time"}}

// 服务端 → 设备
{"kind":"command","id":"cmd-123","type":"rab.listServices","payload":{}}
{"kind":"pong"}

// 服务端 → 调试页面（/events）
{"kind":"device","action":"connected|disconnected","device":{...}}
{"kind":"command","action":"sent|completed","command":{...}}
{"kind":"console","deviceId":"...","data":{...}}
```

## 6. skill `skills/rab-rn-debug/SKILL.md`

结构与 `rab-cdp-debug` 对齐，frontmatter 带 `npm: '@rabjs/rn-debug'`、`sourcePath: packages/rn-debug`。内容大纲：

1. **前置条件**：App 入口集成 `setupRNDebug`（含 IP 配置说明）；`npx rab-rn-debug` 启动服务；`curl localhost:9229/api/devices` 确认设备在线。目标 App 未接入时先引导用户完成接入。
2. **能力概述**：指令模型（结构化 type + payload）、同步 pending 语义、串行保证。
3. **HTTP 调用说明**：`POST /api/commands` 用法与 curl 示例；多设备时如何指定 deviceId。
4. **常用调试操作**：与 rab-cdp-debug 的清单对齐——ping、枚举 Service、读状态、调用方法（含异步）、断言 `rab.expect`、拉取 console 日志。
5. **典型验证流程**：确认设备在线 → 枚举 Service → 状态快照 → 触发操作 → 断言验证。
6. **断言用法**：`rab.expect` 的 assertions 数组与 op 速查表（引用 devtools RSExpectBuilder 语义）。
7. **常见问题**：设备连不上（同网段/IP/`__DEV__`/Metro 端口冲突）、指令 timeout、多设备 409、日志为空（确认 SDK 版本）。

## 7. 错误处理

| 场景 | 行为 |
|------|------|
| Agent 请求超时（默认 30s，上限 120s） | `{status:'timeout'}`，服务端清理 pending；设备晚到的 result 丢弃 |
| 设备离线时下发指令 | 404（指定 deviceId）或 409（歧义）；已排队/在途指令立即以 error 结束 |
| handler 抛异常 | `{status:'error', error:{message,stack}}` |
| 未知指令 type | `{status:'error', error:{message:'unknown command type'}}` |
| 返回值不可序列化 | SDK 清洗失败按 error 回传 |
| SDK 断线 | 指数退避自动重连；重连后重新 register（deviceId 不变） |
| 服务端重启 | 设备自动重连；Agent 期间请求按超时/断线处理 |

## 8. 测试

- **`@rabjs/rn-debug` 单测**（jest）：
  - 调度器：顺序执行、错误回传、未知 type、可序列化清洗。
  - 内置 handler：`rab.*` 系列基于真实 `@rabjs/service` 容器构造 fixture 验证；console 环形缓冲容量与 level 过滤。
  - WS 客户端：mock WebSocket 验证 register/重连退避/心跳。
- **`@rabjs/rn-debug-server` 集成测试**（jest）：
  - 用 `ws` 客户端模拟设备连接 + `fetch` 模拟 Agent：走通 register → 发指令 → pending → result 全链路。
  - 串行化：并发发 3 条指令，断言设备端按序收到。
  - 超时、设备断开时 pending 指令的清理、`/api/commands` 的 404/409 分支。
- **调试页面**：手动验收（连真实 RN 示例 App 跑一遍典型流程）。
- **skill 文档**：文档审查，无代码测试。

## 9. 里程碑拆分（实现顺序建议）

1. `@rabjs/rn-debug-server`：WS 服务 + 设备注册表 + Agent HTTP API（含 pending/串行/超时）。
2. `@rabjs/rn-debug`：WS 客户端 + 调度器 + ping/device.info/自定义 handler。
3. SDK 内置 rab Service 系列 handler + console 日志。
4. 调试页面。
5. `skills/rab-rn-debug/SKILL.md`。
