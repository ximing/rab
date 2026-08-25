# @rabjs/rn-debug-server

RABjs React Native 调试服务。Agent（或调试页面）通过 HTTP 发送指令，经 WebSocket 中转给集成 `@rabjs/rn-debug` 的 RN 应用，同步等待执行结果。

## 使用

```bash
npx rab-rn-debug            # 默认端口 9229
npx rab-rn-debug --port 9300
```

启动后打开 `http://localhost:9229/` 查看调试页面。

## HTTP API

| 方法 | 路径                            | 说明                         |
| ---- | ------------------------------- | ---------------------------- |
| GET  | /api/devices                    | 设备列表                     |
| POST | /api/commands                   | 发指令（唯一设备时自动路由） |
| POST | /api/devices/:deviceId/commands | 向指定设备发指令             |
| GET  | /api/commands/:id               | 查询指令状态                 |

```bash
curl -X POST http://localhost:9229/api/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"rab.listServices","payload":{}}'
```

## 编程使用

```ts
import { createDebugServer } from '@rabjs/rn-debug-server';
const server = await createDebugServer({ port: 9229 });
```
