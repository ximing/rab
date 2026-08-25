---
name: rab-rn-debug
description: 用于指导 Agent 通过本地调试服务（rab-rn-debug）以 HTTP 指令调试 React Native 真机/模拟器上的 @rabjs 应用。当用户提到 RN Service 逻辑验证、调试移动端 rab 应用、真机/模拟器 Service 状态检查、设备指令调试 时，应优先使用这个 skill。适用场景包括：向 RN 设备发送结构化指令、枚举/读取/调用 Service、执行 rab.expect 断言、拉取设备 console 日志。
version: 0.1.0
npm: '@rabjs/rn-debug'
sourcePath: packages/rn-debug
repository: git@github.com:ximing/rab.git
---

# rab-rn-debug 调试指南（React Native）

本 skill 告知 Agent 如何通过 **rab-rn-debug 本地服务**（默认 `localhost:9229`）向集成 `@rabjs/rn-debug` 的 React Native 应用发送 HTTP 指令，对 Service 层进行功能验证与状态检查。请求会**同步挂起**直到设备执行完毕返回结果。

---

## 前置条件

1. 电脑上启动调试服务（bin 名 `rab-rn-debug`，来自 `@rabjs/rn-debug-server`）：

```bash
npx rab-rn-debug            # 默认端口 9229，启动时会打印局域网 IP（setupRNDebug 的 host）
```

2. RN 应用已集成 SDK（App 入口，仅 `__DEV__` 生效）：

```ts
import { setupRNDebug } from '@rabjs/rn-debug';

setupRNDebug({ host: '<电脑局域网IP>', port: 9229, appName: 'MyApp' });
```

3. 确认设备在线：

```bash
curl -s http://localhost:9229/api/devices
# 期望: [{"deviceId":"rn-ios-xxxx","appName":"MyApp","platform":"ios","osVersion":"18.0","sdkVersion":"0.1.0","connectedAt":...,"lastSeen":...}]
```

如果目标 App 尚未接入，先引导用户完成上述步骤再调试。多设备在线时，请求需带 `deviceId`（见下）。

---

## 指令调用方式

```bash
curl -X POST http://localhost:9229/api/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"<指令type>","payload":{...},"timeout":30000}'
```

- 唯一设备在线时自动路由；多设备返回 409（body 为 `{"error":"multiple devices, specify deviceId","devices":["rn-ios-xxx","rn-android-yyy"]}`），改用 `POST /api/devices/<deviceId>/commands`；无设备返回 404；指定的 `deviceId` 不存在同样返回 404。
- 响应：`{"id","status":"ok"|"error"|"timeout","result","durationMs"}`；失败时另有 `error:{"message","stack?"}`。
- 事后可用 `GET /api/commands/<id>` 查询单条指令记录（含 `status:"pending"` 的进行中状态）。
- 同一设备指令严格串行；默认超时 30s（上限 120s，超出按 120s 计），异步方法耗时长时可加大 `timeout`。

---

## 常用调试操作

### 1. 连通性检查

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"ping"}'
# 期望 status ok, result: { "pong": true, "time": 1723766400000 }
```

### 2. 枚举所有已实例化的 Service

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"rab.listServices"}'
```

返回示例：

```json
{
  "status": "ok",
  "result": [
    {
      "instanceId": "CartService#1",
      "containerName": "ProductPage_2",
      "identifierLabel": "CartService"
    }
  ]
}
```

- `instanceId` 格式为 `类名#序号`（如 `CartService#1`），`identifierLabel` 为 Service 类名。
- 仅枚举 **Singleton 作用域**且已实例化的 Service（Transient 不缓存实例，不会出现在列表中）。

### 3. 读取 Service 状态

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"rab.getServiceState","payload":{"identifierLabel":"CartService"}}'
```

- `identifierLabel` 或 `instanceId` 二选一即可定位 Service。
- 默认返回全部公开状态（下划线开头的字段视为私有，不返回）。
- `paths` 可只取部分字段，返回以路径为 key 的对象：`{"payload":{"identifierLabel":"CartService","paths":["total","items.length"]}}` → `{"total":0,"items.length":0}`。
- 路径语法与断言一致（shared `resolvePath`）：`items.length`、`items.0.id` 均正确解析；中间路径为 primitive 时该路径返回 `undefined`。

### 4. 调用 Service 方法（含异步）

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"rab.callServiceMethod","payload":{
    "instanceId":"CartService#1","method":"addItem",
    "args":[{"id":"test-1","name":"Test","price":9.9}]}}'
```

- 必须用 `instanceId` 定位（不支持 `identifierLabel`）；`args` 缺省为 `[]`。
- 方法返回值会作为 `result` 返回；异步方法会等待其 resolve。

### 5. 断言验证（rab.expect）

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"rab.expect","payload":{
    "instanceId":"CartService#1",
    "description":"加购后状态验证",
    "assertions":[
      {"op":"eq","path":"items.length","expected":1},
      {"op":"gt","path":"total","expected":0},
      {"op":"exists","path":"items.0.id"}
    ]}}'
```

返回结构化断言结果：

```json
{
  "status": "ok",
  "result": {
    "instanceId": "CartService#1",
    "description": "加购后状态验证",
    "passed": true,
    "summary": { "passed": 3, "total": 3 },
    "results": [
      {
        "path": "items.length",
        "op": "eq",
        "passed": true,
        "expected": 1,
        "actual": 1,
        "message": ""
      }
    ]
  }
}
```

op 速查：`eq` `neq` `gt` `gte` `lt` `lte` `between` `exists` `notExists` `includes` `notIncludes` `matches` `type` `length` `lengthGt` `lengthGte` `lengthLt` `lengthLte` `hasKeys` `matchObject` `deepEq` `some` `every`（语义与 @rabjs/devtools RSExpectBuilder 一致）。

### 6. 拉取设备 console 日志

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"console.getLogs","payload":{"level":"error","limit":20}}'
```

- `level` 可选（`log` `info` `warn` `error` `debug`），`limit` 取最近 N 条。
- 返回 `[{ "level", "args", "time" }]`，环形缓冲默认容量 500 条。

---

## 典型验证流程

1. `GET /api/devices` 确认设备在线（必要时 `ping`）
2. `rab.listServices` 枚举，找到目标 Service 的 `instanceId`
3. `rab.getServiceState` 记录操作前状态快照
4. `rab.callServiceMethod` 触发操作（或让用户在设备上操作）
5. `rab.expect` 断言状态变更
6. `console.getLogs` 检查有无异常日志

---

## 常见问题

### 设备列表为空？

- 手机与电脑不在同一网段，或 `host` 填错（用 server 启动时打印的 IP）
- App 为 release 构建（SDK 仅 `__DEV__` 生效）
- 模拟器注意：Android 模拟器访问宿主机用 `10.0.2.2` 而非 localhost

### rab.listServices 里看不到某个 Service？

- 仅 Singleton 作用域的 Service 会被缓存并枚举；Transient 作用域每次 resolve 都是新实例，不出现在列表中
- Service 尚未被 resolve 实例化——先触发一次使用路径再枚举

### 指令返回 timeout？

- 设备端 handler 执行过久——加大 `timeout`（上限 120s）；或设备已掉线，先查 `/api/devices`

### 返回 409？

- 多台设备在线，从 body 的 `devices` 数组选一个，改用 `/api/devices/<deviceId>/commands`

### 结果字段缺失？

- handler 返回值必须 JSON 可序列化；循环引用/函数/过深结构（>6 层）会被 SDK 清洗或截断，Map/Set/类实例会退化为字符串标记
