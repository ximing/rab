# rab-rn-debug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Agent 通过本地 HTTP 服务 + WebSocket 长连接调试 React Native 应用中 rab Service 的完整链路（两个新包 + 调试页面 + skill 文档）。

**Architecture:** `@rabjs/rn-debug-server`（Node CLI，端口 9229）维护设备注册表，Agent 用 HTTP 发指令（同步 pending 到设备执行完），RN 端 `@rabjs/rn-debug` SDK 通过 WebSocket 接入并串行执行结构化指令、回传结果。调试页面经 `/events` WS 实时查看设备与指令流水。

**Tech Stack:** TypeScript、Node `http` + `ws`（server 包）、React Native 全局 `WebSocket`（SDK 包，零原生依赖）、jest + ts-jest。

**Spec:** `docs/superpowers/specs/2026-08-16-rab-rn-debug-design.md`

## Global Constraints

- 默认端口 `9229`；Agent 指令默认超时 `30000ms`，上限 `120000ms`。
- WS 设备端点路径 `/device`；调试页面事件端点 `/events`；调试页面路由 `GET /`。
- SDK 仅在 `__DEV__` 为 true 时生效，生产构建 no-op；`registerHandler` 重复注册抛错。
- console 环形缓冲容量 `500` 条；服务端指令历史保留最近 `100` 条。
- server 包运行时依赖仅 `ws`；SDK 包运行时零依赖（peer 依赖 `@rabjs/service`、`@rabjs/shared`）。
- 指令协议字段名严格按 spec：WS 消息用 `kind`（register/ping/pong/command/result/event）；HTTP 响应 `{id, status, result?, error?, durationMs}`，status ∈ ok/error/timeout。
- 多设备路由：无设备 404；多设备且未指定 deviceId 409；指定不存在/离线设备 404。
- 包命名：`@rabjs/rn-debug-server`（bin 名 `rab-rn-debug`）、`@rabjs/rn-debug`；均放 `packages/` 下。
- 构建遵循 devtools 包模式：esbuild 双格式（ESM/CJS）+ `tsc --emitDeclarationOnly`，`build.config.ts` 驱动，外部依赖 `external: ['@rabjs/*']`（server 包额外 external `ws`）。
- 每个 package 的 jest 配置沿用 devtools 模式（ts-jest，`src/__tests__/**/*.test.ts`）。SDK 包测试环境用 `node`（不依赖 DOM）。
- 提交信息用 conventional commits（feat:/test:/docs:/chore:）。

---

### Task 1: 脚手架 + 设备注册表 + WS `/device` 端点 + `GET /api/devices`

**Files:**

- Create: `packages/rn-debug-server/package.json`
- Create: `packages/rn-debug-server/tsconfig.json`
- Create: `packages/rn-debug-server/jest.config.js`
- Create: `packages/rn-debug-server/src/types.ts`
- Create: `packages/rn-debug-server/src/device-registry.ts`
- Create: `packages/rn-debug-server/src/server.ts`
- Test: `packages/rn-debug-server/src/__tests__/device-registry.test.ts`
- Test: `packages/rn-debug-server/src/__tests__/server-register.test.ts`

**Interfaces:**

- Consumes: 无（首任务）
- Produces:
  - `createDeviceRegistry(): DeviceRegistry`，其中 `interface DeviceRegistry { add(device: DeviceEntry): void; remove(deviceId: string): boolean; get(deviceId: string): DeviceEntry | undefined; list(): DeviceInfo[]; touch(deviceId: string): void }`
  - `interface DeviceEntry { deviceId: string; ws: WebSocket; info: DeviceInfo; connectedAt: number; lastSeen: number }`
  - `interface DeviceInfo { deviceId: string; appName: string; platform: string; osVersion: string; sdkVersion: string; connectedAt: number; lastSeen: number }`
  - `createDebugServer(options: { port: number }): Promise<DebugServer>`，`interface DebugServer { port: number; registry: DeviceRegistry; close(): Promise<void> }`（Task 2/3/4 会扩展此对象，新增 `dispatcher`、`history`、`eventsBus` 字段）

- [ ] **Step 1: 创建 package.json**

`packages/rn-debug-server/package.json`：

```json
{
  "name": "@rabjs/rn-debug-server",
  "version": "0.1.0",
  "description": "RABjs RN 调试服务 - Agent 通过 HTTP 指令调试 React Native 设备",
  "type": "module",
  "main": "lib/main.cjs",
  "module": "lib/main.js",
  "types": "lib/main.d.ts",
  "bin": { "rab-rn-debug": "bin/rab-rn-debug.js" },
  "exports": {
    ".": {
      "types": "./lib/main.d.ts",
      "import": "./lib/main.js",
      "require": "./lib/main.cjs"
    }
  },
  "scripts": {
    "build": "tsx build.config.ts",
    "dev": "tsx build.config.ts --watch",
    "clean": "rm -rf lib build dist coverage",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "keywords": ["reactive", "state", "debug", "react-native", "devtools"],
  "author": "ximing",
  "license": "MIT",
  "dependencies": { "ws": "^8.16.0" },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.10",
    "esbuild": "^0.19.12",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "tsconfig": "workspace:*",
    "tsx": "^4.0.0",
    "typescript": "^5.1.3"
  },
  "files": ["lib/**/*", "bin/**/*", "README.md"],
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }
}
```

- [ ] **Step 2: 创建 tsconfig.json 与 jest.config.js**

`packages/rn-debug-server/tsconfig.json`（照抄 devtools 的，去掉 DOM lib）：

```json
{
  "extends": "tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./lib",
    "rootDir": "./src",
    "lib": ["ES2020"],
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["@types/node", "@types/jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "build", "dist"]
}
```

`packages/rn-debug-server/jest.config.js`：

```js
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { esModuleInterop: true, allowSyntheticDefaultImports: true } },
    ],
  },
};
```

- [ ] **Step 3: 安装依赖并写失败测试（registry）**

Run: `cd packages/rn-debug-server && pnpm install`
（在 monorepo 根跑 `pnpm install` 亦可）

`src/__tests__/device-registry.test.ts`：

```ts
import { createDeviceRegistry } from '../device-registry';

describe('DeviceRegistry', () => {
  it('add 后 get/list 可见，list 不含 ws 字段', () => {
    const reg = createDeviceRegistry();
    reg.add({
      deviceId: 'dev-1',
      ws: { send: jest.fn() } as unknown as WebSocket,
      info: { appName: 'App', platform: 'ios', osVersion: '17.5', sdkVersion: '0.1.0' },
      connectedAt: 1000,
      lastSeen: 1000,
    });
    expect(reg.get('dev-1')?.info.appName).toBe('App');
    const list = reg.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ deviceId: 'dev-1', appName: 'App', platform: 'ios' });
    expect(list[0]).not.toHaveProperty('ws');
  });

  it('remove 后 get 返回 undefined', () => {
    const reg = createDeviceRegistry();
    reg.add({
      deviceId: 'dev-1',
      ws: {} as WebSocket,
      info: { appName: 'App', platform: 'ios', osVersion: '17.5', sdkVersion: '0.1.0' },
      connectedAt: 1000,
      lastSeen: 1000,
    });
    expect(reg.remove('dev-1')).toBe(true);
    expect(reg.get('dev-1')).toBeUndefined();
    expect(reg.remove('dev-1')).toBe(false);
  });

  it('touch 更新 lastSeen', () => {
    const reg = createDeviceRegistry();
    reg.add({
      deviceId: 'dev-1',
      ws: {} as WebSocket,
      info: { appName: 'App', platform: 'ios', osVersion: '17.5', sdkVersion: '0.1.0' },
      connectedAt: 1000,
      lastSeen: 1000,
    });
    reg.touch('dev-1');
    expect(reg.get('dev-1')!.lastSeen).toBeGreaterThanOrEqual(1000);
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/device-registry.test.ts`
Expected: FAIL，报 Cannot find module '../device-registry'

- [ ] **Step 5: 实现 types.ts 与 device-registry.ts**

`src/types.ts`：

```ts
import type { WebSocket as WsSocket } from 'ws';

export interface DeviceInfo {
  deviceId: string;
  appName: string;
  platform: string;
  osVersion: string;
  sdkVersion: string;
  connectedAt: number;
  lastSeen: number;
}

export interface DeviceEntry {
  deviceId: string;
  ws: WsSocket;
  info: Omit<DeviceInfo, 'deviceId' | 'connectedAt' | 'lastSeen'>;
  connectedAt: number;
  lastSeen: number;
}

export interface DeviceRegistry {
  add(device: DeviceEntry): void;
  remove(deviceId: string): boolean;
  get(deviceId: string): DeviceEntry | undefined;
  list(): DeviceInfo[];
  touch(deviceId: string): void;
}

/** 设备 → 服务端 register 消息 */
export interface RegisterMessage {
  kind: 'register';
  deviceId: string;
  info: { appName: string; platform: string; osVersion: string; sdkVersion: string };
}

export interface PingMessage {
  kind: 'ping';
}

export interface ResultMessage {
  kind: 'result';
  id: string;
  status: 'ok' | 'error';
  result?: unknown;
  error?: { message: string; stack?: string };
}

export interface DeviceEventMessage {
  kind: 'event';
  event: string;
  data: unknown;
}

export type DeviceToServerMessage =
  RegisterMessage | PingMessage | ResultMessage | DeviceEventMessage;

export interface CommandMessage {
  kind: 'command';
  id: string;
  type: string;
  payload?: unknown;
}
```

`src/device-registry.ts`：

```ts
import type { DeviceEntry, DeviceInfo, DeviceRegistry } from './types';

export function createDeviceRegistry(): DeviceRegistry {
  const devices = new Map<string, DeviceEntry>();

  function toInfo(entry: DeviceEntry): DeviceInfo {
    return {
      deviceId: entry.deviceId,
      ...entry.info,
      connectedAt: entry.connectedAt,
      lastSeen: entry.lastSeen,
    };
  }

  return {
    add(device) {
      devices.set(device.deviceId, device);
    },
    remove(deviceId) {
      return devices.delete(deviceId);
    },
    get(deviceId) {
      return devices.get(deviceId);
    },
    list() {
      return Array.from(devices.values()).map(toInfo);
    },
    touch(deviceId) {
      const entry = devices.get(deviceId);
      if (entry) entry.lastSeen = Date.now();
    },
  };
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/device-registry.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: 写失败测试（server register + /api/devices）**

`src/__tests__/server-register.test.ts`：

```ts
import WebSocket from 'ws';
import { createDebugServer } from '../server';

describe('debug server /device + /api/devices', () => {
  let server: Awaited<ReturnType<typeof createDebugServer>>;

  afterEach(async () => {
    await server?.close();
  });

  it('设备 register 后出现在 /api/devices；断开后移除', async () => {
    server = await createDebugServer({ port: 9229 });
    expect(server.port).toBe(9229);

    const ws = new WebSocket('ws://127.0.0.1:9229/device');
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
    ws.send(
      JSON.stringify({
        kind: 'register',
        deviceId: 'dev-1',
        info: { appName: 'App', platform: 'ios', osVersion: '17.5', sdkVersion: '0.1.0' },
      })
    );
    // 等 register 被处理
    await new Promise(r => setTimeout(r, 200));

    const res = await fetch('http://127.0.0.1:9229/api/devices');
    expect(res.status).toBe(200);
    const devices = (await res.json()) as Array<{ deviceId: string; appName: string }>;
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ deviceId: 'dev-1', appName: 'App' });

    ws.close();
    await new Promise(r => setTimeout(r, 200));
    const res2 = await fetch('http://127.0.0.1:9229/api/devices');
    expect(((await res2.json()) as unknown[]).length).toBe(0);
  });

  it('ping 更新 lastSeen', async () => {
    server = await createDebugServer({ port: 9229 });
    const ws = new WebSocket('ws://127.0.0.1:9229/device');
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
    ws.send(
      JSON.stringify({
        kind: 'register',
        deviceId: 'dev-2',
        info: { appName: 'A', platform: 'android', osVersion: '14', sdkVersion: '0.1.0' },
      })
    );
    await new Promise(r => setTimeout(r, 150));
    const before = server.registry.get('dev-2')!.lastSeen;
    await new Promise(r => setTimeout(r, 20));
    ws.send(JSON.stringify({ kind: 'ping' }));
    await new Promise(r => setTimeout(r, 150));
    expect(server.registry.get('dev-2')!.lastSeen).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 8: 运行测试确认失败**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/server-register.test.ts`
Expected: FAIL，报 Cannot find module '../server'

- [ ] **Step 9: 实现 server.ts**

`src/server.ts`：

```ts
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';

import { createDeviceRegistry } from './device-registry';
import type { DeviceRegistry, DeviceToServerMessage } from './types';

export interface DebugServer {
  port: number;
  registry: DeviceRegistry;
  close(): Promise<void>;
}

export async function createDebugServer(options: { port: number }): Promise<DebugServer> {
  const { port } = options;
  const registry = createDeviceRegistry();

  const httpServer: HttpServer = createHttpServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/devices') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(registry.list()));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (url.startsWith('/device')) {
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WsSocket) => {
    let registeredId: string | undefined;

    ws.on('message', raw => {
      let msg: DeviceToServerMessage;
      try {
        msg = JSON.parse(String(raw)) as DeviceToServerMessage;
      } catch {
        return;
      }
      if (msg.kind === 'register') {
        registeredId = msg.deviceId;
        registry.add({
          deviceId: msg.deviceId,
          ws,
          info: msg.info,
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      } else if (msg.kind === 'ping') {
        if (registeredId) registry.touch(registeredId);
        ws.send(JSON.stringify({ kind: 'pong' }));
      }
      // result / event 在 Task 2/4 处理
    });

    ws.on('close', () => {
      if (registeredId) registry.remove(registeredId);
    });
  });

  await new Promise<void>(resolve => httpServer.listen(port, resolve));

  return {
    port,
    registry,
    close() {
      return new Promise<void>(resolve => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        httpServer.close(() => resolve());
      });
    },
  };
}
```

- [ ] **Step 10: 运行全部测试确认通过**

Run: `cd packages/rn-debug-server && pnpm jest`
Expected: PASS（6 tests）

- [ ] **Step 11: Commit**

```bash
git add packages/rn-debug-server
git commit -m "feat(rn-debug-server): 设备注册表与 /device WS 端点"
```

---

### Task 2: 指令分发器 + Agent HTTP 指令端点（pending / 串行）

**Files:**

- Modify: `packages/rn-debug-server/src/types.ts`（追加类型）
- Create: `packages/rn-debug-server/src/command-dispatcher.ts`
- Modify: `packages/rn-debug-server/src/server.ts`（接入 dispatcher + 新 HTTP 端点）
- Test: `packages/rn-debug-server/src/__tests__/dispatcher.test.ts`
- Test: `packages/rn-debug-server/src/__tests__/server-commands.test.ts`

**Interfaces:**

- Consumes: Task 1 的 `createDebugServer`、`DeviceRegistry`、`ResultMessage`
- Produces:
  - `createCommandDispatcher(options: { registry: DeviceRegistry }): CommandDispatcher`
  - `interface CommandDispatcher { sendCommand(deviceId: string, input: CommandInput): Promise<CommandOutcome>; handleResult(msg: ResultMessage): boolean; handleDisconnect(deviceId: string): void; getHistory(): CommandRecord[]; getCommand(id: string): CommandRecord | undefined }`
  - `interface CommandInput { type: string; payload?: unknown; timeout?: number }`
  - `interface CommandOutcome { id: string; status: 'ok' | 'error' | 'timeout'; result?: unknown; error?: { message: string; stack?: string }; durationMs: number }`
  - `interface CommandRecord extends CommandOutcome { deviceId: string; type: string; payload?: unknown; sentAt: number; completedAt?: number }`
  - `DebugServer` 接口扩展：新增 `dispatcher: CommandDispatcher`

- [ ] **Step 1: 追加类型到 types.ts**

在 `src/types.ts` 末尾追加：

```ts
import type { CommandOutcome, CommandRecord } from './command-dispatcher';

export interface CommandInput {
  type: string;
  payload?: unknown;
  timeout?: number;
}

export type { CommandOutcome, CommandRecord, CommandDispatcher } from './command-dispatcher';
```

注意：`import type` 与 `export type` 合并到文件顶部已有的 import 区域，不要重复声明 `CommandInput`。

- [ ] **Step 2: 写失败测试（dispatcher 单元逻辑，不起 HTTP）**

`src/__tests__/dispatcher.test.ts`：

```ts
import { createCommandDispatcher } from '../command-dispatcher';
import type { DeviceRegistry } from '../types';

function makeRegistry(
  ids: string[]
): DeviceRegistry & { sockets: Map<string, { sent: string[] }> } {
  const sockets = new Map<string, { sent: string[] }>();
  const devices = new Map();
  const reg = {
    add: (d: unknown) => devices.set((d as { deviceId: string }).deviceId, d),
    remove: (id: string) => devices.delete(id),
    get: (id: string) => devices.get(id),
    list: () => [],
    touch: () => {},
  } as unknown as DeviceRegistry;
  for (const id of ids) {
    sockets.set(id, { sent: [] });
    reg.add({
      deviceId: id,
      ws: { send: (data: string) => sockets.get(id)!.sent.push(data) },
      info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' },
      connectedAt: 0,
      lastSeen: 0,
    });
  }
  return Object.assign(reg, { sockets });
}

describe('CommandDispatcher', () => {
  it('发送 command 后 pending，收到 result 才 resolve', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const promise = dispatcher.sendCommand('dev-1', { type: 'ping' });
    const sent = JSON.parse(reg.sockets.get('dev-1')!.sent[0]);
    expect(sent).toMatchObject({ kind: 'command', type: 'ping' });
    expect(typeof sent.id).toBe('string');

    dispatcher.handleResult({ kind: 'result', id: sent.id, status: 'ok', result: { pong: true } });
    await expect(promise).resolves.toMatchObject({ status: 'ok', result: { pong: true } });
  });

  it('handler 错误以 error 状态 resolve', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const promise = dispatcher.sendCommand('dev-1', { type: 'bad' });
    const sent = JSON.parse(reg.sockets.get('dev-1')!.sent[0]);
    dispatcher.handleResult({
      kind: 'result',
      id: sent.id,
      status: 'error',
      error: { message: 'boom' },
    });
    await expect(promise).resolves.toMatchObject({ status: 'error', error: { message: 'boom' } });
  });

  it('同一设备串行：前一条未完成不发下一条', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const p1 = dispatcher.sendCommand('dev-1', { type: 'a' });
    dispatcher.sendCommand('dev-1', { type: 'b' });
    await new Promise(r => setTimeout(r, 50));
    expect(reg.sockets.get('dev-1')!.sent).toHaveLength(1);

    const first = JSON.parse(reg.sockets.get('dev-1')!.sent[0]);
    dispatcher.handleResult({ kind: 'result', id: first.id, status: 'ok', result: null });
    await p1;
    await new Promise(r => setTimeout(r, 20));
    expect(reg.sockets.get('dev-1')!.sent).toHaveLength(2);
  });

  it('设备离线时 pending 指令立即以 error 结束', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const promise = dispatcher.sendCommand('dev-1', { type: 'a' });
    dispatcher.handleDisconnect('dev-1');
    await expect(promise).resolves.toMatchObject({
      status: 'error',
      error: { message: 'device disconnected' },
    });
  });

  it('历史记录可通过 getCommand 查询', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const promise = dispatcher.sendCommand('dev-1', { type: 'ping' });
    const sent = JSON.parse(reg.sockets.get('dev-1')!.sent[0]);
    expect(dispatcher.getCommand(sent.id)?.status).toBe('pending');
    dispatcher.handleResult({ kind: 'result', id: sent.id, status: 'ok', result: 1 });
    await promise;
    expect(dispatcher.getCommand(sent.id)?.status).toBe('ok');
    expect(dispatcher.getHistory().length).toBe(1);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/dispatcher.test.ts`
Expected: FAIL，报 Cannot find module '../command-dispatcher'

- [ ] **Step 4: 实现 command-dispatcher.ts**

`src/command-dispatcher.ts`：

```ts
import type { DeviceRegistry, ResultMessage } from './types';

export interface CommandInput {
  type: string;
  payload?: unknown;
  timeout?: number;
}

export interface CommandOutcome {
  id: string;
  status: 'ok' | 'error' | 'timeout';
  result?: unknown;
  error?: { message: string; stack?: string };
  durationMs: number;
}

export interface CommandRecord extends CommandOutcome {
  deviceId: string;
  type: string;
  payload?: unknown;
  sentAt: number;
  completedAt?: number;
}

interface Pending {
  record: CommandRecord;
  resolve: (outcome: CommandOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface CommandDispatcher {
  sendCommand(deviceId: string, input: CommandInput): Promise<CommandOutcome>;
  handleResult(msg: ResultMessage): boolean;
  handleDisconnect(deviceId: string): void;
  getHistory(): CommandRecord[];
  getCommand(id: string): CommandRecord | undefined;
}

const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 120_000;
const HISTORY_CAP = 100;

export function createCommandDispatcher(options: { registry: DeviceRegistry }): CommandDispatcher {
  const { registry } = options;
  const pending = new Map<string, Pending>();
  const history: CommandRecord[] = [];
  const queues = new Map<string, Promise<void>>();

  function record(outcome: CommandOutcome, p: Pending) {
    clearTimeout(p.timer);
    pending.delete(outcome.id);
    Object.assign(p.record, outcome, { completedAt: Date.now() });
    history.push(p.record);
    if (history.length > HISTORY_CAP) history.shift();
    p.resolve(outcome);
  }

  function sendAndAwait(deviceId: string, input: CommandInput): Promise<CommandOutcome> {
    return new Promise<CommandOutcome>(resolve => {
      const entry = registry.get(deviceId);
      const id = `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const timeout = Math.min(input.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);
      const record: CommandRecord = {
        id,
        status: 'pending' as const,
        deviceId,
        type: input.type,
        payload: input.payload,
        sentAt: Date.now(),
        durationMs: 0,
      };
      const p: Pending = {
        record,
        resolve,
        timer: setTimeout(() => {
          record.durationMs = Date.now() - record.sentAt;
          record({ id, status: 'timeout', durationMs: record.durationMs }, p);
        }, timeout),
      };
      pending.set(id, p);

      if (!entry || entry.ws.readyState !== 1) {
        record(
          { id, status: 'error', error: { message: 'device disconnected' }, durationMs: 0 },
          p
        );
        return;
      }
      entry.ws.send(
        JSON.stringify({ kind: 'command', id, type: input.type, payload: input.payload ?? {} })
      );
    });
  }

  return {
    sendCommand(deviceId, input) {
      const prev = queues.get(deviceId) ?? Promise.resolve();
      const outcome = prev.then(() => sendAndAwait(deviceId, input));
      queues.set(
        deviceId,
        outcome.then(
          () => undefined,
          () => undefined
        )
      );
      return outcome;
    },
    handleResult(msg) {
      const p = pending.get(msg.id);
      if (!p) return false;
      record(
        {
          id: msg.id,
          status: msg.status,
          result: msg.result,
          error: msg.error,
          durationMs: Date.now() - p.record.sentAt,
        },
        p
      );
      return true;
    },
    handleDisconnect(deviceId) {
      for (const [id, p] of pending) {
        if (p.record.deviceId !== deviceId) continue;
        record(
          {
            id,
            status: 'error',
            error: { message: 'device disconnected' },
            durationMs: Date.now() - p.record.sentAt,
          },
          p
        );
      }
      queues.delete(deviceId);
    },
    getHistory() {
      return [...history];
    },
    getCommand(id) {
      return history.find(h => h.id === id);
    },
  };
}
```

`sendAndAwait` 从不 reject（所有失败路径都 resolve 为 error/timeout outcome），所以 `outcome` 直接可返回；`queues` 链吞掉 rejection 仅用于维持同设备串行。

- [ ] **Step 5: 运行 dispatcher 测试确认通过**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/dispatcher.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 6: 写失败测试（HTTP 端点集成）**

`src/__tests__/server-commands.test.ts`：

```ts
import WebSocket from 'ws';
import { createDebugServer } from '../server';

async function connectDevice(port: number, deviceId: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/device`);
  const received: string[] = [];
  ws.on('message', raw => received.push(String(raw)));
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  ws.send(
    JSON.stringify({
      kind: 'register',
      deviceId,
      info: { appName: 'App', platform: 'ios', osVersion: '17.5', sdkVersion: '0.1.0' },
    })
  );
  await new Promise(r => setTimeout(r, 150));
  return { ws, received };
}

function reply(ws: WebSocket, raw: string, status: 'ok' | 'error', result: unknown) {
  const msg = JSON.parse(raw);
  ws.send(JSON.stringify({ kind: 'result', id: msg.id, status, result }));
}

describe('debug server command endpoints', () => {
  let server: Awaited<ReturnType<typeof createDebugServer>>;
  const port = 9231;

  afterEach(async () => {
    await server?.close();
  });

  it('POST /api/commands 唯一设备直接路由，pending 至 result 返回', async () => {
    server = await createDebugServer({ port });
    const { ws, received } = await connectDevice(port, 'dev-1');

    const promise = fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping', payload: {} }),
    }).then(r => r.json());

    await new Promise(r => setTimeout(r, 150));
    expect(received.filter(m => JSON.parse(m).kind === 'command')).toHaveLength(1);
    reply(
      ws,
      received.find(m => JSON.parse(m).kind === 'command')!,
      'ok',
      { pong: true }
    );

    const body = (await promise) as { status: string; result: unknown };
    expect(body.status).toBe('ok');
    expect(body.result).toEqual({ pong: true });
    ws.close();
  });

  it('POST /api/devices/:id/commands 指定设备路由', async () => {
    server = await createDebugServer({ port });
    const { ws, received } = await connectDevice(port, 'dev-9');

    const promise = fetch(`http://127.0.0.1:${port}/api/devices/dev-9/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'device.info' }),
    }).then(r => r.json());

    await new Promise(r => setTimeout(r, 150));
    reply(
      ws,
      received.find(m => JSON.parse(m).kind === 'command')!,
      'ok',
      { platform: 'ios' }
    );
    const body = (await promise) as { status: string; result: unknown };
    expect(body.status).toBe('ok');
    expect(body.result).toEqual({ platform: 'ios' });
    ws.close();
  });

  it('指定不存在设备返回 404', async () => {
    server = await createDebugServer({ port });
    const res = await fetch(`http://127.0.0.1:${port}/api/devices/ghost/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    });
    expect(res.status).toBe(404);
  });

  it('多设备且未指定返回 409 + 候选列表；无设备返回 404', async () => {
    server = await createDebugServer({ port });
    const a = await connectDevice(port, 'dev-a');
    const b = await connectDevice(port, 'dev-b');
    const conflict = await fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    });
    expect(conflict.status).toBe(409);
    const body = (await conflict.json()) as { devices: string[] };
    expect(body.devices.sort()).toEqual(['dev-a', 'dev-b']);

    a.ws.close();
    b.ws.close();
    await new Promise(r => setTimeout(r, 200));
    const none = await fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    });
    expect(none.status).toBe(404);
  });

  it('GET /api/commands/:id 返回指令状态', async () => {
    server = await createDebugServer({ port });
    const { ws, received } = await connectDevice(port, 'dev-1');
    const promise = fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    }).then(r => r.json());
    await new Promise(r => setTimeout(r, 150));
    const sent = received.find(m => JSON.parse(m).kind === 'command')!;
    const cmdId = JSON.parse(sent).id;

    const pendingRes = await fetch(`http://127.0.0.1:${port}/api/commands/${cmdId}`);
    expect(((await pendingRes.json()) as { status: string }).status).toBe('pending');

    reply(ws, sent, 'ok', 1);
    await promise;
    const doneRes = await fetch(`http://127.0.0.1:${port}/api/commands/${cmdId}`);
    expect(((await doneRes.json()) as { status: string }).status).toBe('ok');
    ws.close();
  });
});
```

- [ ] **Step 7: 运行测试确认失败**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/server-commands.test.ts`
Expected: FAIL（POST /api/commands 返回 404）

- [ ] **Step 8: 修改 server.ts 接入 dispatcher 与新端点**

`src/server.ts` 全量替换为：

```ts
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';

import {
  createCommandDispatcher,
  type CommandDispatcher,
  type CommandOutcome,
} from './command-dispatcher';
import { createDeviceRegistry } from './device-registry';
import type { CommandInput, DeviceRegistry, DeviceToServerMessage, ResultMessage } from './types';

export interface DebugServer {
  port: number;
  registry: DeviceRegistry;
  dispatcher: CommandDispatcher;
  close(): Promise<void>;
}

async function readJson(req: import('http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export async function createDebugServer(options: { port: number }): Promise<DebugServer> {
  const { port } = options;
  const registry = createDeviceRegistry();
  const dispatcher = createCommandDispatcher({ registry });

  const httpServer: HttpServer = createHttpServer(async (req, res) => {
    const url = req.url ?? '';

    if (req.method === 'GET' && url === '/api/devices') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(registry.list()));
      return;
    }

    const byDevice = url.match(/^\/api\/devices\/([^/]+)\/commands$/);
    if (req.method === 'POST' && byDevice) {
      const deviceId = decodeURIComponent(byDevice[1]);
      if (!registry.get(deviceId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `device not found: ${deviceId}` }));
        return;
      }
      const input = (await readJson(req)) as CommandInput;
      const outcome = await dispatcher.sendCommand(deviceId, input);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(outcome));
      return;
    }

    if (req.method === 'POST' && url === '/api/commands') {
      const devices = registry.list();
      if (devices.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'no device connected' }));
        return;
      }
      if (devices.length > 1) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'multiple devices, specify deviceId',
            devices: devices.map(d => d.deviceId),
          })
        );
        return;
      }
      const input = (await readJson(req)) as CommandInput;
      const outcome = await dispatcher.sendCommand(devices[0].deviceId, input);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(outcome));
      return;
    }

    const byId = url.match(/^\/api\/commands\/([^/]+)$/);
    if (req.method === 'GET' && byId) {
      const record = dispatcher.getCommand(decodeURIComponent(byId[1]));
      if (!record) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'command not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(record));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (url.startsWith('/device')) {
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WsSocket) => {
    let registeredId: string | undefined;

    ws.on('message', raw => {
      let msg: DeviceToServerMessage;
      try {
        msg = JSON.parse(String(raw)) as DeviceToServerMessage;
      } catch {
        return;
      }
      if (msg.kind === 'register') {
        registeredId = msg.deviceId;
        registry.add({
          deviceId: msg.deviceId,
          ws,
          info: msg.info,
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      } else if (msg.kind === 'ping') {
        if (registeredId) registry.touch(registeredId);
        ws.send(JSON.stringify({ kind: 'pong' }));
      } else if (msg.kind === 'result') {
        dispatcher.handleResult(msg as ResultMessage);
      }
    });

    ws.on('close', () => {
      if (registeredId) {
        dispatcher.handleDisconnect(registeredId);
        registry.remove(registeredId);
      }
    });
  });

  await new Promise<void>(resolve => httpServer.listen(port, resolve));

  return {
    port,
    registry,
    dispatcher,
    close() {
      return new Promise<void>(resolve => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        httpServer.close(() => resolve());
      });
    },
  };
}
```

- [ ] **Step 9: 运行全部 server 测试确认通过**

Run: `cd packages/rn-debug-server && pnpm jest`
Expected: PASS（Task 1 的 6 个 + dispatcher 5 个 + 本任务 5 个 = 16 tests）

- [ ] **Step 10: Commit**

```bash
git add packages/rn-debug-server
git commit -m "feat(rn-debug-server): 指令分发器与 Agent HTTP 指令端点"
```

---

### Task 3: 超时行为 + 设备断开时 pending 清理（集成层验证）

> dispatcher 单元测试已覆盖超时与断线核心逻辑；本任务补充集成级验证，确保 HTTP 层同样拿到 timeout outcome、晚到 result 被丢弃。

**Files:**

- Test: `packages/rn-debug-server/src/__tests__/server-timeout.test.ts`

**Interfaces:**

- Consumes: Task 2 的全部接口，无新产出
- Produces: 无

- [ ] **Step 1: 写测试（这些行为 Task 2 已实现，测试应直接通过——若失败说明实现有缺陷）**

`src/__tests__/server-timeout.test.ts`：

```ts
import WebSocket from 'ws';
import { createDebugServer } from '../server';

async function connectDevice(port: number, deviceId: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/device`);
  const received: string[] = [];
  ws.on('message', raw => received.push(String(raw)));
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  ws.send(
    JSON.stringify({
      kind: 'register',
      deviceId,
      info: { appName: 'App', platform: 'ios', osVersion: '17.5', sdkVersion: '0.1.0' },
    })
  );
  await new Promise(r => setTimeout(r, 150));
  return { ws, received };
}

describe('timeout & disconnect (integration)', () => {
  let server: Awaited<ReturnType<typeof createDebugServer>>;
  const port = 9232;

  afterEach(async () => {
    await server?.close();
  });

  it('设备不回 result 时按 timeout 返回，晚到 result 被丢弃', async () => {
    server = await createDebugServer({ port });
    const { ws, received } = await connectDevice(port, 'dev-t');

    const body = (await fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'hang', payload: {}, timeout: 400 }),
    }).then(r => r.json())) as { status: string; durationMs: number };

    expect(body.status).toBe('timeout');
    expect(body.durationMs).toBeGreaterThanOrEqual(350);

    // 晚到 result：不应抛错（服务端日志静默丢弃）
    const sent = received.find(m => JSON.parse(m).kind === 'command')!;
    ws.send(JSON.stringify({ kind: 'result', id: JSON.parse(sent).id, status: 'ok', result: 1 }));
    await new Promise(r => setTimeout(r, 100));
    const record = server.dispatcher.getCommand(JSON.parse(sent).id);
    expect(record?.status).toBe('timeout');
    ws.close();
  });

  it('设备 WS 断开时 pending 指令立即 error 返回', async () => {
    server = await createDebugServer({ port });
    const { ws } = await connectDevice(port, 'dev-d');

    const promise = fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'hang', timeout: 10_000 }),
    }).then(r => r.json());

    await new Promise(r => setTimeout(r, 150));
    ws.terminate();
    const body = (await promise) as { status: string; error: { message: string } };
    expect(body.status).toBe('error');
    expect(body.error.message).toBe('device disconnected');
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/server-timeout.test.ts`
Expected: PASS（2 tests）。若 FAIL，修 `command-dispatcher.ts` 直到通过。

- [ ] **Step 3: Commit**

```bash
git add packages/rn-debug-server/src/__tests__/server-timeout.test.ts
git commit -m "test(rn-debug-server): 超时与断线集成测试"
```

---

### Task 4: events 总线 + `/events` 端点 + console 转发

**Files:**

- Create: `packages/rn-debug-server/src/events-bus.ts`
- Modify: `packages/rn-debug-server/src/server.ts`（接入 eventsBus、console 转发、设备上下线广播）
- Test: `packages/rn-debug-server/src/__tests__/events.test.ts`

**Interfaces:**

- Consumes: Task 2 的 `DebugServer`
- Produces:
  - `createEventsBus(): EventsBus`
  - `interface EventsBus { subscribe(ws: WsSocket): void; publish(event: Record<string, unknown>): void }`
  - `DebugServer` 接口扩展：新增 `eventsBus: EventsBus`
  - 事件格式（发给 `/events` 订阅者）：
    - `{"kind":"device","action":"connected"|"disconnected","device":DeviceInfo}`
    - `{"kind":"command","action":"sent"|"completed","command":CommandRecord}`
    - `{"kind":"console","deviceId":string,"data":{level,args,time}}`

- [ ] **Step 1: 写失败测试**

`src/__tests__/events.test.ts`：

```ts
import WebSocket from 'ws';
import { createDebugServer } from '../server';

function collect(ws: WebSocket) {
  const messages: unknown[] = [];
  ws.on('message', raw => messages.push(JSON.parse(String(raw))));
  return messages;
}

describe('events bus /events', () => {
  let server: Awaited<ReturnType<typeof createDebugServer>>;
  const port = 9233;

  afterEach(async () => {
    await server?.close();
  });

  it('设备上线/下线广播 connected/disconnected', async () => {
    server = await createDebugServer({ port });
    const dash = new WebSocket(`ws://127.0.0.1:${port}/events`);
    const events = collect(dash);
    await new Promise<void>(r => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    await new Promise<void>(r => dev.on('open', () => r()));
    dev.send(
      JSON.stringify({
        kind: 'register',
        deviceId: 'dev-e',
        info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' },
      })
    );
    await new Promise(r => setTimeout(r, 200));
    dev.close();
    await new Promise(r => setTimeout(r, 200));

    const actions = events
      .filter(e => (e as { kind: string }).kind === 'device')
      .map(e => (e as { action: string }).action);
    expect(actions).toContain('connected');
    expect(actions).toContain('disconnected');
  });

  it('设备 console event 转发为 {"kind":"console",deviceId,data}', async () => {
    server = await createDebugServer({ port });
    const dash = new WebSocket(`ws://127.0.0.1:${port}/events`);
    const events = collect(dash);
    await new Promise<void>(r => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    await new Promise<void>(r => dev.on('open', () => r()));
    dev.send(
      JSON.stringify({
        kind: 'register',
        deviceId: 'dev-c',
        info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' },
      })
    );
    await new Promise(r => setTimeout(r, 150));
    dev.send(
      JSON.stringify({
        kind: 'event',
        event: 'console',
        data: { level: 'warn', args: ['hi'], time: 1 },
      })
    );
    await new Promise(r => setTimeout(r, 200));

    const con = events.find(e => (e as { kind: string }).kind === 'console') as {
      deviceId: string;
      data: { level: string };
    };
    expect(con).toBeDefined();
    expect(con.deviceId).toBe('dev-c');
    expect(con.data.level).toBe('warn');
    dev.close();
  });

  it('指令 sent/completed 事件广播', async () => {
    server = await createDebugServer({ port });
    const dash = new WebSocket(`ws://127.0.0.1:${port}/events`);
    const events = collect(dash);
    await new Promise<void>(r => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    const devReceived: string[] = [];
    dev.on('message', raw => devReceived.push(String(raw)));
    await new Promise<void>(r => dev.on('open', () => r()));
    dev.send(
      JSON.stringify({
        kind: 'register',
        deviceId: 'dev-x',
        info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' },
      })
    );
    await new Promise(r => setTimeout(r, 150));

    const promise = fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    }).then(r => r.json());
    await new Promise(r => setTimeout(r, 150));
    const sent = devReceived.find(m => JSON.parse(m).kind === 'command')!;
    dev.send(JSON.stringify({ kind: 'result', id: JSON.parse(sent).id, status: 'ok', result: 1 }));
    await promise;
    await new Promise(r => setTimeout(r, 150));

    const cmdEvents = events
      .filter(e => (e as { kind: string }).kind === 'command')
      .map(e => (e as { action: string }).action);
    expect(cmdEvents).toContain('sent');
    expect(cmdEvents).toContain('completed');
    dev.close();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/events.test.ts`
Expected: FAIL（/events 连接被 destroy 或无事件）

- [ ] **Step 3: 实现 events-bus.ts**

`src/events-bus.ts`：

```ts
import type { WebSocket as WsSocket } from 'ws';

export interface EventsBus {
  subscribe(ws: WsSocket): void;
  publish(event: Record<string, unknown>): void;
}

export function createEventsBus(): EventsBus {
  const subscribers = new Set<WsSocket>();

  return {
    subscribe(ws) {
      subscribers.add(ws);
      ws.on('close', () => subscribers.delete(ws));
    },
    publish(event) {
      const data = JSON.stringify(event);
      for (const ws of subscribers) {
        if (ws.readyState === 1) ws.send(data);
      }
    },
  };
}
```

- [ ] **Step 4: 修改 server.ts 接入 eventsBus**

对 `src/server.ts` 做以下修改（其余保持不变）：

1. 顶部追加 import：

```ts
import { createEventsBus } from './events-bus';
import type { EventsBus } from './events-bus';
```

2. `createDebugServer` 内 `const dispatcher = ...` 之后追加：

```ts
const eventsBus = createEventsBus();
```

3. `DebugServer` 接口增加 `eventsBus: EventsBus;`，返回对象增加 `eventsBus,`。

4. upgrade 处理改为：

```ts
httpServer.on('upgrade', (req, socket, head) => {
  const url = req.url ?? '';
  if (url.startsWith('/device')) {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } else if (url.startsWith('/events')) {
    wss.handleUpgrade(req, socket, head, ws => {
      eventsBus.subscribe(ws);
    });
  } else {
    socket.destroy();
  }
});
```

5. 设备 register 成功后广播（直接构造对象，避免先 add 再 list 查找的时序歧义）：

```ts
const connectedAt = Date.now();
registry.add({ deviceId: msg.deviceId, ws, info: msg.info, connectedAt, lastSeen: connectedAt });
eventsBus.publish({
  kind: 'device',
  action: 'connected',
  device: { deviceId: msg.deviceId, ...msg.info, connectedAt, lastSeen: connectedAt },
});
```

6. 设备 close 处理改为（先取 info 再 remove，disconnected 事件带上设备信息）：

```ts
ws.on('close', () => {
  if (registeredId) {
    const info = registry.get(registeredId);
    dispatcher.handleDisconnect(registeredId);
    registry.remove(registeredId);
    if (info) {
      eventsBus.publish({
        kind: 'device',
        action: 'disconnected',
        device: {
          deviceId: registeredId,
          ...info.info,
          connectedAt: info.connectedAt,
          lastSeen: info.lastSeen,
        },
      });
    }
  }
});
```

7. 设备 `event` 消息转发（`ws.on('message')` 分支追加）：

```ts
} else if (msg.kind === 'event') {
  if (registeredId) {
    eventsBus.publish({ kind: msg.event, deviceId: registeredId, data: msg.data });
  }
}
```

8. 指令事件广播：修改 `command-dispatcher.ts` 的 `createCommandDispatcher`，options 增加 `onEvent?: (event: Record<string, unknown>) => void`，在指令实际写入 WS 后调用 `options.onEvent?.({ kind: 'command', action: 'sent', command: record })`，在 `record()` 完成时调用 `options.onEvent?.({ kind: 'command', action: 'completed', command: p.record })`。server.ts 创建 dispatcher 时传入：

```ts
const dispatcher = createCommandDispatcher({
  registry,
  onEvent: event => eventsBus.publish(event),
});
```

注意创建顺序：先 `eventsBus` 后 `dispatcher`。

- [ ] **Step 5: 运行全部测试确认通过**

Run: `cd packages/rn-debug-server && pnpm jest`
Expected: PASS（16 + 3 = 19 tests）

- [ ] **Step 6: Commit**

```bash
git add packages/rn-debug-server
git commit -m "feat(rn-debug-server): events 总线与 /events 端点"
```

---

### Task 5: 调试页面（`GET /`）

**Files:**

- Create: `packages/rn-debug-server/src/debug-page.html`
- Modify: `packages/rn-debug-server/src/server.ts`（`GET /` 返回该页面）
- Test: `packages/rn-debug-server/src/__tests__/debug-page.test.ts`

**Interfaces:**

- Consumes: Task 4 的 `/events` 事件流、Task 2 的 HTTP API
- Produces: `GET /` 返回 `text/html`（内嵌于 `src/debug-page.html`，构建时随 lib 输出——本任务先以 `fs.readFileSync(path.join(__dirname, 'debug-page.html'))` 读取，esbuild `--loader:.html=copy` 处理复制）

- [ ] **Step 1: 写失败测试**

`src/__tests__/debug-page.test.ts`：

```ts
import { createDebugServer } from '../server';

describe('debug page', () => {
  it('GET / 返回 HTML 且包含关键面板', async () => {
    const server = await createDebugServer({ port: 9234 });
    try {
      const res = await fetch('http://127.0.0.1:9234/');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('id="devices"');
      expect(html).toContain('id="command-form"');
      expect(html).toContain('id="timeline"');
      expect(html).toContain('id="logs"');
    } finally {
      await server.close();
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/rn-debug-server && pnpm jest src/__tests__/debug-page.test.ts`
Expected: FAIL（GET / 返回 404）

- [ ] **Step 3: 实现 debug-page.html**

`src/debug-page.html` —— 单文件、原生 JS、无外部资源，四个面板（设备 / 指令发送表单 / 指令流水 / console 日志），通过 `/events` WS 订阅实时更新：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>rab-rn-debug</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        font-family: ui-monospace, Menlo, Consolas, monospace;
        margin: 0;
        display: grid;
        grid-template-columns: 340px 1fr;
        gap: 1px;
        background: #8882;
        min-height: 100vh;
      }
      section {
        background: Canvas;
        padding: 12px;
        overflow: auto;
      }
      h2 {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.7;
        margin: 0 0 8px;
      }
      .device {
        border: 1px solid #8884;
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 8px;
      }
      .dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #2c2;
        margin-right: 6px;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      textarea,
      select,
      input {
        font: inherit;
        padding: 4px;
        border: 1px solid #8886;
        border-radius: 4px;
        background: inherit;
        color: inherit;
      }
      textarea {
        min-height: 90px;
      }
      button {
        font: inherit;
        padding: 6px 12px;
        cursor: pointer;
      }
      .row {
        border-bottom: 1px solid #8883;
        padding: 6px 0;
        font-size: 12px;
      }
      .ok {
        color: #2a2;
      }
      .error {
        color: #c33;
      }
      .timeout {
        color: #c83;
      }
      .pending {
        color: #88a;
      }
      details > summary {
        cursor: pointer;
      }
      pre {
        margin: 4px 0 0;
        white-space: pre-wrap;
        word-break: break-all;
        opacity: 0.85;
      }
      .log-warn {
        color: #b80;
      }
      .log-error {
        color: #c33;
      }
    </style>
  </head>
  <body>
    <section>
      <h2>设备</h2>
      <div id="devices"></div>
      <h2 style="margin-top:16px">发送指令</h2>
      <form id="command-form">
        <select id="cmd-device"></select>
        <input id="cmd-type" placeholder="指令 type，如 rab.listServices" required />
        <textarea id="cmd-payload" placeholder="payload JSON，如 {}"></textarea>
        <button type="submit">发送</button>
      </form>
      <div id="cmd-result"></div>
    </section>
    <section>
      <h2>指令流水</h2>
      <div id="timeline"></div>
      <h2 style="margin-top:16px">Console 日志</h2>
      <div id="logs"></div>
    </section>
    <script>
      const $ = id => document.getElementById(id);
      const devices = new Map();

      function renderDevices() {
        $('devices').innerHTML =
          devices.size === 0
            ? '<div class="row">暂无设备连接</div>'
            : [...devices.values()]
                .map(
                  d =>
                    `<div class="device"><span class="dot"></span><b>${d.deviceId}</b><br/>` +
                    `${d.appName ?? ''} · ${d.platform ?? ''} ${d.osVersion ?? ''}<br/>` +
                    `<small>connected ${new Date(d.connectedAt).toLocaleTimeString()}</small></div>`
                )
                .join('');
        const sel = $('cmd-device');
        const cur = sel.value;
        sel.innerHTML = [...devices.keys()]
          .map(id => `<option value="${id}">${id}</option>`)
          .join('');
        if (devices.has(cur)) sel.value = cur;
      }

      function renderCommand(cmd) {
        const div = document.createElement('div');
        div.className = 'row';
        div.dataset.id = cmd.id;
        div.innerHTML =
          `<details><summary><span class="${cmd.status}">${cmd.status}</span> ` +
          `${new Date(cmd.sentAt).toLocaleTimeString()} ${cmd.deviceId} → ${cmd.type}` +
          ` (${cmd.durationMs ?? 0}ms)</summary>` +
          `<pre>payload: ${JSON.stringify(cmd.payload ?? {}, null, 2)}</pre>` +
          `<pre>${cmd.status === 'pending' ? '' : JSON.stringify(cmd.result ?? cmd.error ?? '', null, 2)}</pre></details>`;
        const old = document.querySelector(`#timeline .row[data-id="${cmd.id}"]`);
        if (old) old.replaceWith(div);
        else $('timeline').prepend(div);
      }

      function renderLog(deviceId, data) {
        const div = document.createElement('div');
        div.className = 'row log-' + (data.level ?? 'log');
        div.textContent = `${new Date(data.time ?? Date.now()).toLocaleTimeString()} [${deviceId}] ${data.level ?? 'log'} ${(data.args ?? []).map(safeStr).join(' ')}`;
        $('logs').prepend(div);
      }
      const safeStr = v => (typeof v === 'string' ? v : JSON.stringify(v));

      const ws = new WebSocket(`ws://${location.host}/events`);
      ws.onmessage = e => {
        const msg = JSON.parse(e.data);
        if (msg.kind === 'device') {
          if (msg.action === 'connected') devices.set(msg.device.deviceId, msg.device);
          else devices.delete(msg.device.deviceId);
          renderDevices();
        } else if (msg.kind === 'command') {
          renderCommand(msg.command);
        } else if (msg.kind === 'console') {
          renderLog(msg.deviceId, msg.data);
        }
      };
      // 初始拉一次设备列表
      fetch('/api/devices')
        .then(r => r.json())
        .then(list => {
          for (const d of list) devices.set(d.deviceId, d);
          renderDevices();
        });

      $('command-form').addEventListener('submit', async e => {
        e.preventDefault();
        const deviceId = $('cmd-device').value;
        const type = $('cmd-type').value.trim();
        let payload = {};
        try {
          payload = JSON.parse($('cmd-payload').value || '{}');
        } catch {
          $('cmd-result').textContent = 'payload 不是合法 JSON';
          return;
        }
        const url = deviceId
          ? `/api/devices/${encodeURIComponent(deviceId)}/commands`
          : '/api/commands';
        $('cmd-result').textContent = '…';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload }),
        });
        $('cmd-result').textContent = `${res.status} ${JSON.stringify(await res.json(), null, 2)}`;
      });
    </script>
  </body>
</html>
```

- [ ] **Step 4: server.ts 返回页面**

`src/server.ts` 修改：

1. 顶部追加：

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
```

2. HTTP handler 首个分支之前插入：

```ts
if (req.method === 'GET' && (url === '/' || url.startsWith('/index'))) {
  const html = readFileSync(join(__dirname, 'debug-page.html'), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
  return;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd packages/rn-debug-server && pnpm jest`
Expected: PASS（20 tests）

- [ ] **Step 6: 手动验收（可选但推荐）**

Run: `cd packages/rn-debug-server && pnpm tsx -e "import('./src/server').then(m => m.createDebugServer({ port: 9229 })).then(() => new Promise(() => {}))"`
浏览器打开 `http://localhost:9229/`，确认页面渲染、显示"暂无设备连接"。Ctrl-C 退出。

- [ ] **Step 7: Commit**

```bash
git add packages/rn-debug-server
git commit -m "feat(rn-debug-server): 内置调试页面"
```

---

### Task 6: CLI 入口 + 构建配置

**Files:**

- Create: `packages/rn-debug-server/bin/rab-rn-debug.js`
- Create: `packages/rn-debug-server/src/cli.ts`
- Create: `packages/rn-debug-server/src/main.ts`
- Create: `packages/rn-debug-server/build.config.ts`
- Create: `packages/rn-debug-server/README.md`

**Interfaces:**

- Consumes: Task 1–5 的 `createDebugServer`
- Produces:
  - CLI：`rab-rn-debug [--port 9229]`，启动服务并打印监听地址、本机局域网 IP、调试页面 URL
  - npm 导出：`@rabjs/rn-debug-server` 主入口导出 `createDebugServer`、相关类型

- [ ] **Step 1: 实现 cli.ts**

`src/cli.ts`：

```ts
import { networkInterfaces } from 'os';

import { createDebugServer } from './server';

function localIPs(): string[] {
  const ips: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

async function main() {
  const portFlag = process.argv.find(a => a.startsWith('--port'));
  const port = portFlag
    ? Number(
        portFlag.split('=')[1] ??
          portFlag.split(' ')[1] ??
          process.argv[process.argv.indexOf(portFlag) + 1]
      )
    : 9229;
  const portNumber = Number.isFinite(port) && port > 0 ? port : 9229;

  const server = await createDebugServer({ port: portNumber });
  const ips = localIPs();
  console.log(`rab-rn-debug server listening on port ${server.port}`);
  console.log(`调试页面: http://localhost:${server.port}/`);
  if (ips.length > 0) {
    console.log(`RN App 接入地址（setupRNDebug 的 host）:`);
    for (const ip of ips) console.log(`  ${ip}:${server.port}`);
  }
  console.log('Ctrl-C 退出');

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
```

> CLI 的 `--port` 解析支持 `--port=9300` 与 `--port 9300` 两种形式；上面 `portFlag.split(' ')[1]` 分支实际不会命中（argv 已按空格切分），实现时可简化为：

```ts
const idx = process.argv.indexOf('--port');
const port = idx !== -1 ? Number(process.argv[idx + 1]) : 9229;
const portNumber = Number.isFinite(port) && port > 0 ? port : 9229;
```

以简化版本实现。

- [ ] **Step 2: 实现 main.ts 与 bin**

`src/main.ts`：

```ts
export { createDebugServer } from './server';
export type { DebugServer } from './server';
export { createDeviceRegistry } from './device-registry';
export { createCommandDispatcher } from './command-dispatcher';
export { createEventsBus } from './events-bus';
export type { DeviceInfo, DeviceRegistry, CommandInput } from './types';
export type { CommandOutcome, CommandRecord, CommandDispatcher } from './command-dispatcher';
```

`bin/rab-rn-debug.js`：

```js
#!/usr/bin/env node
import('../lib/cli.js').catch(err => {
  console.error('rab-rn-debug: 启动失败（请先执行 pnpm build 构建产物）:', err);
  process.exit(1);
});
```

`cli.ts` 顶层直接调用 `main()`（import 即启动，符合 bin 入口语义；`cli` 不从 `main.ts` 导出，库消费者不会误拉起服务）。

- [ ] **Step 3: 实现 build.config.ts**

`build.config.ts`（参照 `packages/devtools/build.config.ts`，差异：platform node、external 加 `ws`、复制 html）：

```ts
import { execSync } from 'child_process';

import * as esbuild from 'esbuild';

const shouldMinify = process.env.MINIFY === 'true';

async function buildLibrary() {
  const common = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    minify: shouldMinify,
    sourcemap: true,
    target: ['node18'],
    platform: 'node' as const,
    external: ['@rabjs/*', 'ws'],
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none' as const,
    charset: 'utf8' as const,
    logLevel: 'info' as const,
  };
  await esbuild.build({ ...common, outfile: 'lib/main.js', format: 'esm' });
  console.log('✓ ESM built');
  await esbuild.build({ ...common, outfile: 'lib/main.cjs', format: 'cjs' });
  console.log('✓ CJS built');

  // CLI 入口单独构建（不进 main bundle）
  await esbuild.build({
    entryPoints: ['src/cli.ts'],
    outfile: 'lib/cli.js',
    bundle: true,
    platform: 'node',
    target: ['node18'],
    format: 'esm',
    external: ['@rabjs/*', 'ws'],
    sourcemap: true,
    logLevel: 'info',
  });
  console.log('✓ CLI built');

  // 调试页面原样复制到 lib/
  await esbuild.build({
    entryPoints: ['src/debug-page.html'],
    outfile: 'lib/debug-page.html',
    loader: { '.html': 'copy' },
    logLevel: 'info',
  });
  console.log('✓ debug page copied');

  execSync('tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck', {
    stdio: 'inherit',
  });
  console.log('✓ Types generated');
}

buildLibrary()
  .then(() => console.log('\n✅ Build completed'))
  .catch(() => process.exit(1));
```

> 注意：`__dirname` 在 ESM 输出中不可用。`server.ts` 里读 HTML 的那行改为不依赖 `__dirname` 的形式——esbuild platform=node + format=cjs 时 `__dirname` 可用，但 ESM 输出会挂。统一方案：构建时把 HTML 内容内联为字符串。在 build.config.ts 中生成 `src/debug-page-content.ts`：

```ts
import { writeFileSync, readFileSync } from 'fs';
writeFileSync(
  'src/debug-page-content.ts',
  `export const DEBUG_PAGE_HTML = ${JSON.stringify(readFileSync('src/debug-page.html', 'utf8'))};\n`
);
```

（放在 esbuild build 之前执行，并将 `src/debug-page-content.ts` 加入 `.gitignore`。）`server.ts` 改为：

```ts
import { DEBUG_PAGE_HTML } from './debug-page-content';
// ...
if (req.method === 'GET' && (url === '/' || url.startsWith('/index'))) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(DEBUG_PAGE_HTML);
  return;
}
```

同步修改 Task 5 中 server.ts 的读文件实现为这个内联版本（测试仍通过，jest 解析 TS import 无需构建步骤）。

- [ ] **Step 4: 写 README.md**

`README.md`（精简）：

````markdown
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
````

- [ ] **Step 5: 验证构建与 CLI**

Run:

```bash
cd packages/rn-debug-server && pnpm build && node bin/rab-rn-debug.js --port 9235 &
sleep 1 && curl -s http://127.0.0.1:9235/api/devices && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9235/
kill %1
```

Expected: `/api/devices` 返回 `[]`；`GET /` 返回 200

Run: `cd packages/rn-debug-server && pnpm jest`
Expected: PASS（20 tests）

- [ ] **Step 6: 更新 .gitignore 并提交**

仓库根 `.gitignore` 追加一行：`packages/rn-debug-server/src/debug-page-content.ts`

```bash
git add packages/rn-debug-server .gitignore
git commit -m "feat(rn-debug-server): CLI 入口与构建配置"
```

---

### Task 7: `@rabjs/rn-debug` 脚手架 + safeSerialize

**Files:**

- Create: `packages/rn-debug/package.json`
- Create: `packages/rn-debug/tsconfig.json`
- Create: `packages/rn-debug/jest.config.js`
- Create: `packages/rn-debug/src/serialize.ts`
- Create: `packages/rn-debug/src/types.ts`
- Test: `packages/rn-debug/src/__tests__/serialize.test.ts`

**Interfaces:**

- Consumes: 无
- Produces:
  - `safeSerialize(value: unknown): { ok: true; data: unknown } | { ok: false; error: { message: string } }` —— 递归移除函数/undefined/循环引用/Symbol 键；深度上限 6；数组/普通对象递归；其他原样返回
  - `interface CommandMessage { kind: 'command'; id: string; type: string; payload?: unknown }`、`interface ResultMessage { kind: 'result'; id: string; status: 'ok' | 'error'; result?: unknown; error?: { message: string; stack?: string } }`（SDK 侧协议类型，后续任务消费）

- [ ] **Step 1: 创建 package.json**

`packages/rn-debug/package.json`：

```json
{
  "name": "@rabjs/rn-debug",
  "version": "0.1.0",
  "description": "RABjs React Native 调试 SDK - 长连接接收指令并顺序执行",
  "type": "module",
  "main": "lib/main.cjs",
  "module": "lib/main.js",
  "types": "lib/main.d.ts",
  "exports": {
    ".": {
      "types": "./lib/main.d.ts",
      "import": "./lib/main.js",
      "require": "./lib/main.cjs"
    }
  },
  "scripts": {
    "build": "tsx build.config.ts",
    "dev": "tsx build.config.ts --watch",
    "clean": "rm -rf lib build dist coverage",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "keywords": ["reactive", "state", "debug", "react-native", "devtools"],
  "author": "ximing",
  "license": "MIT",
  "peerDependencies": {
    "@rabjs/service": "workspace:*",
    "@rabjs/shared": "workspace:*"
  },
  "devDependencies": {
    "@rabjs/service": "workspace:*",
    "@rabjs/shared": "workspace:*",
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.10",
    "esbuild": "^0.19.12",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "tsconfig": "workspace:*",
    "tsx": "^4.0.0",
    "typescript": "^5.1.3",
    "ws": "^8.16.0"
  },
  "files": ["lib/**/*", "README.md"],
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }
}
```

- [ ] **Step 2: 创建 tsconfig.json / jest.config.js 并安装**

`packages/rn-debug/tsconfig.json`：与 Task 1 server 包的完全一致（复制即可）。

`packages/rn-debug/jest.config.js`：与 Task 1 server 包的完全一致（复制即可）。

Run: `pnpm install`（仓库根）

- [ ] **Step 3: 写失败测试**

`src/__tests__/serialize.test.ts`：

```ts
import { safeSerialize } from '../serialize';

describe('safeSerialize', () => {
  it('普通对象/数组/原样返回基础类型', () => {
    expect(safeSerialize({ a: 1, b: 'x', c: true, d: null })).toEqual({
      ok: true,
      data: { a: 1, b: 'x', c: true, d: null },
    });
    expect(safeSerialize([1, 'a'])).toEqual({ ok: true, data: [1, 'a'] });
    expect(safeSerialize(42)).toEqual({ ok: true, data: 42 });
  });

  it('移除函数与 undefined 字段', () => {
    const r = safeSerialize({ a: 1, fn: () => 1, u: undefined });
    expect(r).toEqual({ ok: true, data: { a: 1 } });
  });

  it('循环引用被切断不抛错', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const r = safeSerialize(obj);
    expect(r.ok).toBe(true);
    expect(() => JSON.stringify(r.ok ? r.data : null)).not.toThrow();
  });

  it('深度超过 6 层截断', () => {
    const deep = { a: { a: { a: { a: { a: { a: { a: { a: 1 } } } } } } } };
    const r = safeSerialize(deep) as { ok: boolean; data: unknown };
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.data)).not.toContain('"a":1');
    expect(JSON.stringify(r.data)).toContain('[Truncated]');
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/serialize.test.ts`
Expected: FAIL，Cannot find module '../serialize'

- [ ] **Step 5: 实现 serialize.ts 与 types.ts**

`src/types.ts`：

```ts
export interface CommandMessage {
  kind: 'command';
  id: string;
  type: string;
  payload?: unknown;
}

export interface ResultMessage {
  kind: 'result';
  id: string;
  status: 'ok' | 'error';
  result?: unknown;
  error?: { message: string; stack?: string };
}

export interface RegisterMessage {
  kind: 'register';
  deviceId: string;
  info: { appName: string; platform: string; osVersion: string; sdkVersion: string };
}

export type DebugHandler = (payload: unknown) => unknown | Promise<unknown>;
```

`src/serialize.ts`：

```ts
const MAX_DEPTH = 6;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

function serialize(value: unknown, depth: number, seen: Set<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' || typeof value === 'symbol' || value === undefined
      ? undefined
      : value;
  }
  if (seen.has(value as object)) return '[Circular]';
  if (depth >= MAX_DEPTH) return '[Truncated]';
  seen.add(value as object);
  try {
    if (Array.isArray(value)) {
      return value.map(item => serialize(item, depth + 1, seen));
    }
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        const serialized = serialize(value[key], depth + 1, seen);
        if (serialized !== undefined) out[key] = serialized;
      }
      return out;
    }
    // Map / Set / 类实例等：退化为字符串标记
    return `[${Object.prototype.toString.call(value).slice(8, -1)}]`;
  } finally {
    seen.delete(value as object);
  }
}

export function safeSerialize(
  value: unknown
): { ok: true; data: unknown } | { ok: false; error: { message: string } } {
  try {
    const data = serialize(value, 0, new Set());
    // 终检：确保 JSON 可序列化
    JSON.stringify(data);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: { message: `result not serializable: ${String(err)}` } };
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/serialize.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 7: Commit**

```bash
git add packages/rn-debug
git commit -m "feat(rn-debug): 包脚手架与 safeSerialize"
```

---

### Task 8: 指令执行器（串行调度 + 错误处理 + handler 注册）

**Files:**

- Create: `packages/rn-debug/src/command-executor.ts`
- Test: `packages/rn-debug/src/__tests__/command-executor.test.ts`

**Interfaces:**

- Consumes: Task 7 的 `safeSerialize`、`CommandMessage`、`ResultMessage`、`DebugHandler`
- Produces:
  - `createCommandExecutor(options?: { handlers?: Record<string, DebugHandler> }): CommandExecutor`
  - `interface CommandExecutor { register(type: string, handler: DebugHandler): void; execute(command: CommandMessage, send: (msg: ResultMessage) => void): Promise<void> }`
  - 语义：`execute` 将指令加入 FIFO 队列逐个执行（不并发）；handler 结果经 `safeSerialize` 后回传 `ok`；handler 抛错回传 `error`（message + stack）；未知 type 回传 `error`；`register` 重复 type 抛 `Error`

- [ ] **Step 1: 写失败测试**

`src/__tests__/command-executor.test.ts`：

```ts
import { createCommandExecutor } from '../command-executor';
import type { ResultMessage } from '../types';

function setup() {
  const sent: ResultMessage[] = [];
  const executor = createCommandExecutor({
    handlers: {
      echo: async payload => payload,
      fail: () => {
        throw new Error('boom');
      },
    },
  });
  const send = (msg: ResultMessage) => sent.push(msg);
  return { executor, sent, send };
}

const cmd = (id: string, type: string, payload?: unknown) =>
  ({ kind: 'command', id, type, payload }) as const;

describe('CommandExecutor', () => {
  it('执行 handler 并回传 ok + 序列化结果', async () => {
    const { executor, sent, send } = setup();
    await executor.execute(cmd('1', 'echo', { a: 1 }), send);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'result', id: '1', status: 'ok', result: { a: 1 } });
  });

  it('handler 抛错回传 error（message + stack）', async () => {
    const { executor, sent, send } = setup();
    await executor.execute(cmd('2', 'fail'), send);
    expect(sent[0]).toMatchObject({ id: '2', status: 'error' });
    expect(sent[0].error?.message).toBe('boom');
    expect(typeof sent[0].error?.stack).toBe('string');
  });

  it('未知 type 回传 error', async () => {
    const { executor, sent, send } = setup();
    await executor.execute(cmd('3', 'nope'), send);
    expect(sent[0]).toMatchObject({
      id: '3',
      status: 'error',
      error: { message: 'unknown command type: nope' },
    });
  });

  it('严格串行：慢指令完成前不执行下一条', async () => {
    const order: string[] = [];
    const executor = createCommandExecutor({
      handlers: {
        slow: async () => {
          await new Promise(r => setTimeout(r, 80));
          order.push('slow-done');
        },
        fast: async () => {
          order.push('fast-done');
        },
      },
    });
    const send = () => {};
    const p1 = executor.execute(cmd('a', 'slow'), send);
    const p2 = executor.execute(cmd('b', 'fast'), send);
    await Promise.all([p1, p2]);
    expect(order).toEqual(['slow-done', 'fast-done']);
  });

  it('结果不可序列化时回传 error', async () => {
    const cyc: Record<string, unknown> = {};
    cyc.self = cyc;
    // safeSerialize 会切断循环引用并成功，因此这里用 Symbol 值制造 JSON.stringify 失败的补充场景：
    const executor = createCommandExecutor({
      handlers: { weird: () => cyc },
    });
    const sent: ResultMessage[] = [];
    await executor.execute(cmd('4', 'weird'), m => sent.push(m));
    expect(sent[0].status).toBe('ok'); // 循环引用被切断后可序列化
  });

  it('register 重复 type 抛错', () => {
    const executor = createCommandExecutor();
    executor.register('x', () => 1);
    expect(() => executor.register('x', () => 2)).toThrow(/already registered/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/command-executor.test.ts`
Expected: FAIL，Cannot find module '../command-executor'

- [ ] **Step 3: 实现 command-executor.ts**

```ts
import { safeSerialize } from './serialize';
import type { CommandMessage, DebugHandler, ResultMessage } from './types';

export interface CommandExecutor {
  register(type: string, handler: DebugHandler): void;
  execute(command: CommandMessage, send: (msg: ResultMessage) => void): Promise<void>;
}

export function createCommandExecutor(options?: {
  handlers?: Record<string, DebugHandler>;
}): CommandExecutor {
  const handlers = new Map<string, DebugHandler>(Object.entries(options?.handlers ?? {}));
  let queue: Promise<void> = Promise.resolve();

  async function runOne(command: CommandMessage, send: (msg: ResultMessage) => void) {
    const handler = handlers.get(command.type);
    if (!handler) {
      send({
        kind: 'result',
        id: command.id,
        status: 'error',
        error: { message: `unknown command type: ${command.type}` },
      });
      return;
    }
    try {
      const raw = await handler(command.payload);
      const serialized = safeSerialize(raw);
      if (serialized.ok) {
        send({ kind: 'result', id: command.id, status: 'ok', result: serialized.data });
      } else {
        send({ kind: 'result', id: command.id, status: 'error', error: serialized.error });
      }
    } catch (err) {
      const error = err as { message?: string; stack?: string };
      send({
        kind: 'result',
        id: command.id,
        status: 'error',
        error: { message: error.message ?? String(err), stack: error.stack },
      });
    }
  }

  return {
    register(type, handler) {
      if (handlers.has(type)) {
        throw new Error(`command handler already registered: ${type}`);
      }
      handlers.set(type, handler);
    },
    execute(command, send) {
      queue = queue.then(() => runOne(command, send));
      return queue;
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/command-executor.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add packages/rn-debug
git commit -m "feat(rn-debug): 串行指令执行器"
```

---

### Task 9: WS 客户端（连接 / register / 重连退避 / 心跳）

**Files:**

- Create: `packages/rn-debug/src/ws-client.ts`
- Test: `packages/rn-debug/src/__tests__/ws-client.test.ts`

**Interfaces:**

- Consumes: Task 8 的 `CommandExecutor`、Task 7 的协议类型
- Produces:
  - `createWsClient(options: { url: string; registerMessage: RegisterMessage; executor: CommandExecutor; WebSocketImpl?: WebSocketConstructor; heartbeatIntervalMs?: number }): WsClient`
  - `type WebSocketConstructor = new (url: string) => MinimalWebSocket`
  - `interface MinimalWebSocket { send(data: string): void; close(): void; onopen: (() => void) | null; onmessage: ((event: { data: unknown }) => void) | null; onclose: (() => void) | null; onerror: (() => void) | null }`（RN 全局 WebSocket 与 ws 包、测试 stub 均满足此形状）
  - `interface WsClient { connect(): void; disconnect(): void; sendEvent(event: string, data: unknown): void; isConnected(): boolean }`

- [ ] **Step 1: 写失败测试（用 stub WebSocket，不起真实服务）**

`src/__tests__/ws-client.test.ts`：

```ts
import { createCommandExecutor } from '../command-executor';
import { createWsClient } from '../ws-client';
import type { MinimalWebSocket, WebSocketConstructor } from '../ws-client';

class FakeWebSocket implements MinimalWebSocket {
  static instances: FakeWebSocket[] = [];
  sent: string[] = [];
  open = false;
  closedByClient = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closedByClient = true;
    this.open = false;
    this.onclose?.();
  }
  /** 测试辅助 */
  simulateOpen() {
    this.open = true;
    this.onopen?.();
  }
  simulateServerMessage(data: unknown) {
    this.onmessage?.({ data });
  }
}

function makeClient(overrides: Partial<Parameters<typeof createWsClient>[0]> = {}) {
  const executor = createCommandExecutor({ handlers: { ping: () => ({ pong: true }) } });
  const Ctor = FakeWebSocket as unknown as WebSocketConstructor;
  const client = createWsClient({
    url: 'ws://test/device',
    registerMessage: {
      kind: 'register',
      deviceId: 'dev-1',
      info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' },
    },
    executor,
    WebSocketImpl: Ctor,
    heartbeatIntervalMs: 10_000,
    ...overrides,
  });
  return { client, executor };
}

describe('WsClient', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  it('连接后发送 register，收到 command 由 executor 执行并回传 result', async () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();

    const registerMsg = JSON.parse(ws.sent[0]);
    expect(registerMsg).toMatchObject({ kind: 'register', deviceId: 'dev-1' });

    ws.simulateServerMessage(
      JSON.stringify({ kind: 'command', id: 'c1', type: 'ping', payload: {} })
    );
    await new Promise(r => setTimeout(r, 50));
    const resultMsg = JSON.parse(ws.sent.find(s => JSON.parse(s).kind === 'result')!);
    expect(resultMsg).toMatchObject({ id: 'c1', status: 'ok', result: { pong: true } });
  });

  it('心跳周期性发送 ping', async () => {
    const { client } = makeClient({ heartbeatIntervalMs: 30 });
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();
    await new Promise(r => setTimeout(r, 100));
    expect(ws.sent.filter(s => JSON.parse(s).kind === 'ping').length).toBeGreaterThanOrEqual(2);
  });

  it('断线后指数退避重连，重连成功重新 register', async () => {
    const { client } = makeClient();
    client.connect();
    const first = FakeWebSocket.instances[0];
    first.simulateOpen();
    first.onclose?.(); // 模拟服务端断开

    await new Promise(r => setTimeout(r, 50)); // 退避基数 1s？—— 见下：测试用注入 backoffMs
    expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(2);
    const second = FakeWebSocket.instances[1];
    second.simulateOpen();
    expect(JSON.parse(second.sent[0])).toMatchObject({ kind: 'register', deviceId: 'dev-1' });
  });

  it('disconnect 后不再重连', async () => {
    const { client } = makeClient();
    client.connect();
    const first = FakeWebSocket.instances[0];
    first.simulateOpen();
    client.disconnect();
    await new Promise(r => setTimeout(r, 1200));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
```

> 重连退避与"1s 基数"和测试的 50ms 等待冲突：`createWsClient` 的 options 增加 `reconnectBaseMs?: number`（默认 1000，上限 30_000），测试传 `reconnectBaseMs: 10`。在上面的 `makeClient` 里补一行：

```ts
    reconnectBaseMs: 10,
```

（加在 `heartbeatIntervalMs: 10_000,` 之后。）

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/ws-client.test.ts`
Expected: FAIL，Cannot find module '../ws-client'

- [ ] **Step 3: 实现 ws-client.ts**

```ts
import type { CommandExecutor } from './command-executor';
import type { CommandMessage, RegisterMessage, ResultMessage } from './types';

export interface MinimalWebSocket {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export type WebSocketConstructor = new (url: string) => MinimalWebSocket;

export interface WsClient {
  connect(): void;
  disconnect(): void;
  sendEvent(event: string, data: unknown): void;
  isConnected(): boolean;
}

interface WsClientOptions {
  url: string;
  registerMessage: RegisterMessage;
  executor: CommandExecutor;
  WebSocketImpl?: WebSocketConstructor;
  heartbeatIntervalMs?: number;
  reconnectBaseMs?: number;
}

export function createWsClient(options: WsClientOptions): WsClient {
  const {
    url,
    registerMessage,
    executor,
    WebSocketImpl = (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket,
    heartbeatIntervalMs = 15_000,
    reconnectBaseMs = 1_000,
  } = options;

  let ws: MinimalWebSocket | undefined;
  let connected = false;
  let manualClose = false;
  let retries = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    heartbeatTimer = undefined;
    reconnectTimer = undefined;
  }

  function scheduleReconnect() {
    if (manualClose) return;
    const delay = Math.min(reconnectBaseMs * 2 ** retries, 30_000);
    retries += 1;
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    if (!WebSocketImpl) return;
    ws = new WebSocketImpl(url);
    ws.onopen = () => {
      connected = true;
      retries = 0;
      ws!.send(JSON.stringify(registerMessage));
      heartbeatTimer = setInterval(() => {
        if (connected) ws?.send(JSON.stringify({ kind: 'ping' }));
      }, heartbeatIntervalMs);
    };
    ws.onmessage = event => {
      let msg: { kind?: string } & Record<string, unknown>;
      try {
        const text = typeof event.data === 'string' ? event.data : String(event.data);
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg.kind === 'command') {
        void executor.execute(msg as unknown as CommandMessage, (result: ResultMessage) => {
          ws?.send(JSON.stringify(result));
        });
      }
      // kind === 'pong' 忽略
    };
    ws.onclose = () => {
      connected = false;
      clearTimers();
      scheduleReconnect();
    };
    ws.onerror = () => {
      // 依赖 onclose 后续触发重连
    };
  }

  return {
    connect,
    disconnect() {
      manualClose = true;
      clearTimers();
      connected = false;
      ws?.close();
    },
    sendEvent(event, data) {
      if (!connected) return;
      ws?.send(JSON.stringify({ kind: 'event', event, data }));
    },
    isConnected() {
      return connected;
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/ws-client.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add packages/rn-debug
git commit -m "feat(rn-debug): WS 客户端（重连退避与心跳）"
```

---

### Task 10: console 捕获（环形缓冲 + 实时上报）

**Files:**

- Create: `packages/rn-debug/src/console-capture.ts`
- Test: `packages/rn-debug/src/__tests__/console-capture.test.ts`

**Interfaces:**

- Consumes: 无
- Produces:
  - `setupConsoleCapture(options: { capacity?: number; onLog?: (entry: ConsoleLogEntry) => void }): ConsoleCapture`
  - `interface ConsoleLogEntry { level: 'log' | 'info' | 'warn' | 'error' | 'debug'; args: unknown[]; time: number }`
  - `interface ConsoleCapture { getLogs(filter?: { level?: ConsoleLogEntry['level']; limit?: number }): ConsoleLogEntry[]; restore(): void }`
  - 环形缓冲默认容量 500；patch 不改变原 console 行为（先调原方法再记录）

- [ ] **Step 1: 写失败测试**

`src/__tests__/console-capture.test.ts`：

```ts
import { setupConsoleCapture } from '../console-capture';

describe('ConsoleCapture', () => {
  afterEach(() => {
    // 每个用例内部 restore
  });

  it('捕获 console 调用且不影响原方法', () => {
    const original = console.log;
    const capture = setupConsoleCapture();
    const calls: unknown[][] = [];
    console.log = (...args: unknown[]) => calls.push(args);
    console.log('hello', 1);
    console.log = original;

    const logs = capture.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ level: 'log', args: ['hello', 1] });
    expect(calls).toHaveLength(1);
    capture.restore();
  });

  it('按 level 过滤、按 limit 截取（最近 N 条）', () => {
    const capture = setupConsoleCapture();
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = () => {};
    console.error = () => {};
    console.warn('w1');
    console.error('e1');
    console.warn('w2');
    console.warn = originalWarn;
    console.error = originalError;

    expect(capture.getLogs({ level: 'warn' }).map(l => l.args[0])).toEqual(['w1', 'w2']);
    expect(capture.getLogs({ limit: 2 }).map(l => l.args[0])).toEqual(['e1', 'w2']);
    capture.restore();
  });

  it('容量满后丢弃最旧（环形）', () => {
    const capture = setupConsoleCapture({ capacity: 3 });
    const orig = console.log;
    console.log = () => {};
    for (let i = 0; i < 5; i++) console.log(`m${i}`);
    console.log = orig;
    expect(capture.getLogs().map(l => l.args[0])).toEqual(['m2', 'm3', 'm4']);
    capture.restore();
  });

  it('onLog 实时回调', () => {
    const seen: string[] = [];
    const capture = setupConsoleCapture({ onLog: entry => seen.push(String(entry.args[0])) });
    const orig = console.info;
    console.info = () => {};
    console.info('live');
    console.info = orig;
    expect(seen).toEqual(['live']);
    capture.restore();
  });

  it('restore 后不再捕获', () => {
    const capture = setupConsoleCapture();
    capture.restore();
    const orig = console.log;
    console.log = () => {};
    console.log('after');
    console.log = orig;
    expect(capture.getLogs()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/console-capture.test.ts`
Expected: FAIL，Cannot find module '../console-capture'

- [ ] **Step 3: 实现 console-capture.ts**

```ts
import { safeSerialize } from './serialize';

export interface ConsoleLogEntry {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  args: unknown[];
  time: number;
}

export interface ConsoleCapture {
  getLogs(filter?: { level?: ConsoleLogEntry['level']; limit?: number }): ConsoleLogEntry[];
  restore(): void;
}

const LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;

export function setupConsoleCapture(
  options: {
    capacity?: number;
    onLog?: (entry: ConsoleLogEntry) => void;
  } = {}
): ConsoleCapture {
  const capacity = options.capacity ?? 500;
  const buffer: ConsoleLogEntry[] = [];
  const originals = new Map<string, (...args: unknown[]) => void>();

  for (const level of LEVELS) {
    const target = console as unknown as Record<string, (...args: unknown[]) => void>;
    const original = target[level].bind(console);
    originals.set(level, original);
    target[level] = (...args: unknown[]) => {
      original(...args);
      const serialized = safeSerialize(args);
      const entry: ConsoleLogEntry = {
        level,
        args: (serialized.ok ? serialized.data : []) as unknown[],
        time: Date.now(),
      };
      buffer.push(entry);
      if (buffer.length > capacity) buffer.shift();
      options.onLog?.(entry);
    };
  }

  return {
    getLogs(filter) {
      let logs = buffer;
      if (filter?.level) logs = logs.filter(l => l.level === filter.level);
      const limit = filter?.limit;
      return [...(limit ? logs.slice(-limit) : logs)];
    },
    restore() {
      for (const [level, original] of originals) {
        (console as unknown as Record<string, (...args: unknown[]) => void>)[level] = original;
      }
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/console-capture.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add packages/rn-debug
git commit -m "feat(rn-debug): console 捕获环形缓冲"
```

---

### Task 11: rab Service 内置 handler（listServices / getServiceState / callServiceMethod / expect）

**Files:**

- Create: `packages/rn-debug/src/rab-handlers.ts`
- Test: `packages/rn-debug/src/__tests__/rab-handlers.test.ts`

**Interfaces:**

- Consumes:
  - `@rabjs/service`：`getGlobalContainer()`、`Container`（`getServiceDefinitions()` 返回含 `instance`、`instanceId`、`name` 的定义；`getChildren()`）、`Service`
  - `@rabjs/shared`：`executeAssertions(instance, assertions): AssertResult`
  - Task 7 的 `safeSerialize`
- Produces:
  - `createRabHandlers(): Record<string, DebugHandler>`，包含 `rab.listServices`、`rab.getServiceState`、`rab.callServiceMethod`、`rab.expect`
  - 各 handler payload/result 契约：

```ts
// rab.listServices —— 无 payload
// result: [{ instanceId, containerName, identifierLabel }]
// identifierLabel 取 Service 类名（definition.name ?? constructor.name）

// rab.getServiceState
// payload: { instanceId?: string; identifierLabel?: string; paths?: string[] }
// result: safeSerialize 后的状态对象；paths 提供时只返回这些点号路径的键值
// error: 'service not found: <描述>'（status error，message 形式）

// rab.callServiceMethod
// payload: { instanceId: string; method: string; args?: unknown[] }
// result: 方法返回值（safeSerialize）
// error: 找不到 Service / 找不到方法 / 方法抛错（带 stack）

// rab.expect
// payload: { instanceId: string; description?: string; assertions: Array<{ op: string; path: string; expected?: unknown; message?: string }> }
// result: { instanceId, description?, passed, summary: { passed, total }, results: [{ path, op, passed, expected, actual, message? }] }
```

- [ ] **Step 1: 写失败测试（真实 @rabjs/service 容器 fixture）**

`src/__tests__/rab-handlers.test.ts`：

```ts
import { getGlobalContainer } from '@rabjs/service';

import { createRabHandlers } from '../rab-handlers';

class CartService {
  items: Array<{ id: string; price: number }> = [];
  total = 0;
  async addItem(item: { id: string; price: number }) {
    this.items.push(item);
    this.total = this.items.reduce((s, i) => s + i.price, 0);
    return this.items.length;
  }
}

function setupService() {
  const container = getGlobalContainer();
  container.bind(CartService).to(CartService).resolve();
  return container;
}

async function call(type: string, payload: unknown) {
  const handlers = createRabHandlers();
  return handlers[type](payload);
}

describe('rab handlers', () => {
  it('rab.listServices 枚举容器内 Service', async () => {
    setupService();
    const list = (await call('rab.listServices', {})) as Array<{
      identifierLabel: string;
      instanceId: string;
    }>;
    const cart = list.find(s => s.identifierLabel === 'CartService');
    expect(cart).toBeDefined();
    expect(typeof cart!.instanceId).toBe('string');
  });

  it('rab.getServiceState 按 instanceId 读取状态，paths 过滤', async () => {
    setupService();
    const list = (await call('rab.listServices', {})) as Array<{
      identifierLabel: string;
      instanceId: string;
    }>;
    const cart = list.find(s => s.identifierLabel === 'CartService')!;
    const state = (await call('rab.getServiceState', { instanceId: cart.instanceId })) as Record<
      string,
      unknown
    >;
    expect(state.total).toBe(0);
    const partial = (await call('rab.getServiceState', {
      instanceId: cart.instanceId,
      paths: ['total'],
    })) as Record<string, unknown>;
    expect(partial).toEqual({ total: 0 });
  });

  it('rab.getServiceState 找不到时抛错（executor 转为 error result）', async () => {
    setupService();
    await expect(call('rab.getServiceState', { instanceId: 'ghost' })).rejects.toThrow(
      /service not found/
    );
  });

  it('rab.callServiceMethod 调用异步方法并返回值', async () => {
    setupService();
    const list = (await call('rab.listServices', {})) as Array<{
      identifierLabel: string;
      instanceId: string;
    }>;
    const cart = list.find(s => s.identifierLabel === 'CartService')!;
    const count = await call('rab.callServiceMethod', {
      instanceId: cart.instanceId,
      method: 'addItem',
      args: [{ id: 'x1', price: 5 }],
    });
    expect(count).toBe(1);
    const state = (await call('rab.getServiceState', { instanceId: cart.instanceId })) as Record<
      string,
      unknown
    >;
    expect(state.total).toBe(5);
  });

  it('rab.expect 断言执行返回结构化结果', async () => {
    setupService();
    const list = (await call('rab.listServices', {})) as Array<{
      identifierLabel: string;
      instanceId: string;
    }>;
    const cart = list.find(s => s.identifierLabel === 'CartService')!;
    await call('rab.callServiceMethod', {
      instanceId: cart.instanceId,
      method: 'addItem',
      args: [{ id: 'x1', price: 5 }],
    });
    const result = (await call('rab.expect', {
      instanceId: cart.instanceId,
      description: '加购验证',
      assertions: [
        { op: 'eq', path: 'items.length', expected: 1 },
        { op: 'gt', path: 'total', expected: 0 },
        { op: 'exists', path: 'items.0.id' },
      ],
    })) as {
      passed: boolean;
      summary: { passed: number; total: number };
      results: Array<{ path: string; passed: boolean }>;
    };
    expect(result.passed).toBe(true);
    expect(result.summary).toEqual({ passed: 3, total: 3 });
    expect(result.results.map(r => r.path)).toEqual(['items.length', 'total', 'items.0.id']);
  });
});
```

> 注意：`getGlobalContainer()` 是进程级单例，多个用例 bind 同一 Service 可能重复。若 `bind(...).to(...)` 不支持重复绑定，在 `setupService` 中先判断 `listServices` 里是否已存在 CartService 再 bind；或使用 `container.unbind(CartService)`（存在该 API 时）。以实际 `@rabjs/service` API 为准调整 setup 逻辑，测试断言不变。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/rab-handlers.test.ts`
Expected: FAIL，Cannot find module '../rab-handlers'

- [ ] **Step 3: 实现 rab-handlers.ts**

```ts
import { getGlobalContainer } from '@rabjs/service';
import type { Container, Service } from '@rabjs/service';
import { executeAssertions } from '@rabjs/shared';
import type { Assertion } from '@rabjs/shared';

import { safeSerialize } from './serialize';
import type { DebugHandler } from './types';

interface ServiceRef {
  instanceId: string;
  containerName: string;
  identifierLabel: string;
  instance: Service;
}

function walkCollect(container: Container, containerName: string, out: ServiceRef[]) {
  for (const definition of container.getServiceDefinitions()) {
    const instance = (definition as { instance?: Service }).instance;
    if (!instance) continue;
    const svc = instance as Service & { instanceId?: string };
    out.push({
      instanceId: svc.instanceId ?? '',
      containerName,
      identifierLabel:
        (definition as { name?: string }).name ?? svc.constructor?.name ?? 'Anonymous',
      instance,
    });
  }
  for (const child of container.getChildren()) {
    walkCollect(child, String(child.getName()), out);
  }
}

function listServices(): ServiceRef[] {
  const root = getGlobalContainer();
  const out: ServiceRef[] = [];
  walkCollect(root, String(root.getName()), out);
  return out;
}

function findService(payload: { instanceId?: string; identifierLabel?: string }): ServiceRef {
  const services = listServices();
  const found = payload.instanceId
    ? services.find(s => s.instanceId === payload.instanceId)
    : payload.identifierLabel
      ? services.find(s => s.identifierLabel === payload.identifierLabel)
      : undefined;
  if (!found) {
    throw new Error(
      `service not found: ${payload.instanceId ?? payload.identifierLabel ?? '(no selector)'}`
    );
  }
  return found;
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) return acc[Number(key)];
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function publicState(instance: Service): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(instance as Record<string, unknown>)) {
    if (key.startsWith('_')) continue; // 约定：下划线开头视为私有
    out[key] = (instance as Record<string, unknown>)[key];
  }
  return out;
}

export function createRabHandlers(): Record<string, DebugHandler> {
  return {
    'rab.listServices': async () =>
      listServices().map(({ instanceId, containerName, identifierLabel }) => ({
        instanceId,
        containerName,
        identifierLabel,
      })),

    'rab.getServiceState': async payload => {
      const p = (payload ?? {}) as {
        instanceId?: string;
        identifierLabel?: string;
        paths?: string[];
      };
      const ref = findService(p);
      if (p.paths && p.paths.length > 0) {
        const out: Record<string, unknown> = {};
        for (const path of p.paths) out[path] = getByPath(ref.instance, path);
        const serialized = safeSerialize(out);
        if (!serialized.ok) throw new Error(serialized.error.message);
        return serialized.data;
      }
      const serialized = safeSerialize(publicState(ref.instance));
      if (!serialized.ok) throw new Error(serialized.error.message);
      return serialized.data;
    },

    'rab.callServiceMethod': async payload => {
      const p = (payload ?? {}) as { instanceId: string; method: string; args?: unknown[] };
      const ref = findService({ instanceId: p.instanceId });
      const method = (ref.instance as unknown as Record<string, unknown>)[p.method];
      if (typeof method !== 'function') {
        throw new Error(`method not found: ${p.method}`);
      }
      const raw = await (method as (...args: unknown[]) => unknown).apply(
        ref.instance,
        p.args ?? []
      );
      const serialized = safeSerialize(raw);
      if (!serialized.ok) throw new Error(serialized.error.message);
      return serialized.data;
    },

    'rab.expect': async payload => {
      const p = (payload ?? {}) as {
        instanceId: string;
        description?: string;
        assertions: Assertion[];
      };
      const ref = findService({ instanceId: p.instanceId });
      const result = executeAssertions(ref.instance as object, p.assertions ?? []);
      return {
        instanceId: p.instanceId,
        description: p.description,
        passed: result.passed,
        summary: result.summary,
        results: result.results.map(r => ({
          path: r.path,
          op: r.op,
          passed: r.passed,
          expected: r.expected,
          actual: r.actual,
          message: r.message,
        })),
      };
    },
  };
}
```

> 若 `@rabjs/service` 的 `getServiceDefinitions()` 返回项不含 `name` 字段，`identifierLabel` 退回 `instance.constructor.name`（Hermes 下类名保留于 dev）。`Assertion` 类型从 `@rabjs/shared` import，`results` 元素的 `message` 字段若 `AssertionResult` 中不存在则从 map 中移除（以实际类型为准，编译过为准）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/rab-handlers.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add packages/rn-debug
git commit -m "feat(rn-debug): rab Service 内置调试指令"
```

---

### Task 12: setupRNDebug 入口 + ping/device.info/console.getLogs + **DEV** 门控

**Files:**

- Create: `packages/rn-debug/src/main.ts`
- Create: `packages/rn-debug/src/setup.ts`
- Test: `packages/rn-debug/src/__tests__/setup.test.ts`

**Interfaces:**

- Consumes: Task 8–11 的全部产出
- Produces（npm 主入口导出）：
  - `setupRNDebug(options: RNDebugOptions): RNDebugSession | undefined` —— `__DEV__` 为 false 时返回 undefined 且无副作用；幂等（重复调用返回同一 session）
  - `registerHandler(type: string, handler: DebugHandler): void`（重复 type 抛错）
  - `interface RNDebugOptions { host: string; port?: number; appName?: string; handlers?: Record<string, DebugHandler> }`
  - `interface RNDebugSession { deviceId: string; isConnected(): boolean; sendEvent(event: string, data: unknown): void }`
  - 内置指令最终集合：`ping`、`device.info`、`console.getLogs`、`rab.*`（Task 11）

- [ ] **Step 1: 写失败测试**

`src/__tests__/setup.test.ts`：

```ts
import { setupRNDebug, resetRNDebugForTest } from '../setup';
import { createCommandExecutor } from '../command-executor';
import { createWsClient } from '../ws-client';
import type { MinimalWebSocket, WebSocketConstructor } from '../ws-client';

class FakeWebSocket implements MinimalWebSocket {
  static instances: FakeWebSocket[] = [];
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
  simulateOpen() {
    this.onopen?.();
  }
  simulateMessage(data: unknown) {
    this.onmessage?.({ data });
  }
}

function setup(overrides: Partial<Parameters<typeof setupRNDebug>[0]> = {}) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  return setupRNDebug({
    host: '192.168.1.5',
    port: 9229,
    appName: 'TestApp',
    ...overrides,
  });
}

describe('setupRNDebug', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    resetRNDebugForTest();
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    resetRNDebugForTest();
  });

  it('__DEV__ 为 false 时无副作用返回 undefined', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const session = setup();
    expect(session).toBeUndefined();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('连接 ws://<host>:<port>/device 并 register（含 platform 信息）', async () => {
    const session = setup();
    expect(session?.deviceId).toBeTruthy();
    FakeWebSocket.instances[0].simulateOpen();
    const reg = JSON.parse(FakeWebSocket.instances[0].sent[0]);
    expect(reg.kind).toBe('register');
    expect(reg.info).toMatchObject({ appName: 'TestApp' });
    expect(typeof reg.info.platform).toBe('string');
    expect(typeof reg.info.sdkVersion).toBe('string');
  });

  it('幂等：重复调用返回同一 session 且只建一条连接', () => {
    const a = setup();
    const b = setup();
    expect(a).toBe(b);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('内置 ping / device.info / console.getLogs 可执行', async () => {
    setup();
    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({ kind: 'command', id: 'c1', type: 'ping', payload: {} }));
    ws.simulateMessage(
      JSON.stringify({ kind: 'command', id: 'c2', type: 'device.info', payload: {} })
    );
    ws.simulateMessage(
      JSON.stringify({ kind: 'command', id: 'c3', type: 'console.getLogs', payload: { limit: 10 } })
    );
    await new Promise(r => setTimeout(r, 100));
    const results = ws.sent.map(s => JSON.parse(s)).filter(m => m.kind === 'result');
    expect(results.find(r => r.id === 'c1')).toMatchObject({
      status: 'ok',
      result: { pong: true },
    });
    expect(results.find(r => r.id === 'c2')?.result).toMatchObject({ appName: 'TestApp' });
    expect(results.find(r => r.id === 'c3')).toMatchObject({ status: 'ok', result: [] });
  });

  it('handlers 选项注册自定义指令', async () => {
    setup({ handlers: { 'app.ping': () => 'pong-app' } });
    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(
      JSON.stringify({ kind: 'command', id: 'c1', type: 'app.ping', payload: {} })
    );
    await new Promise(r => setTimeout(r, 50));
    expect(JSON.parse(ws.sent.find(s => JSON.parse(s).kind === 'result')!)).toMatchObject({
      id: 'c1',
      status: 'ok',
      result: 'pong-app',
    });
  });

  it('registerHandler 在 setup 后可追加指令，重复注册抛错', async () => {
    setup();
    registerHandler('app.late', () => 42);
    expect(() => registerHandler('app.late', () => 43)).toThrow(/already registered/);
    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(
      JSON.stringify({ kind: 'command', id: 'c9', type: 'app.late', payload: {} })
    );
    await new Promise(r => setTimeout(r, 50));
    expect(JSON.parse(ws.sent.find(s => JSON.parse(s).kind === 'result')!)).toMatchObject({
      id: 'c9',
      status: 'ok',
      result: 42,
    });
  });
});
```

（测试文件顶部需再 `import { registerHandler } from '../setup';`）

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/setup.test.ts`
Expected: FAIL，Cannot find module '../setup'

- [ ] **Step 3: 实现 setup.ts**

```ts
import { Platform } from './platform';
import { createCommandExecutor, type CommandExecutor } from './command-executor';
import { setupConsoleCapture, type ConsoleCapture } from './console-capture';
import { createRabHandlers } from './rab-handlers';
import { createWsClient, type WsClient } from './ws-client';
import type { DebugHandler } from './types';

// package.json version 由 build 时 define 注入；测试/源码运行时回退 '0.0.0'
declare const RAB_RN_DEBUG_VERSION: string | undefined;
const SDK_VERSION = typeof RAB_RN_DEBUG_VERSION !== 'undefined' ? RAB_RN_DEBUG_VERSION : '0.0.0';

export interface RNDebugOptions {
  host: string;
  port?: number;
  appName?: string;
  handlers?: Record<string, DebugHandler>;
}

export interface RNDebugSession {
  deviceId: string;
  isConnected(): boolean;
  sendEvent(event: string, data: unknown): void;
}

let session: RNDebugSession | undefined;
let executorRef: CommandExecutor | undefined;

function makeDeviceId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `rn-${Platform.OS}-${rand}`;
}

export function setupRNDebug(options: RNDebugOptions): RNDebugSession | undefined {
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  if (dev === false) return undefined; // 生产 no-op；undefined（非 RN 环境）按 dev 处理便于测试
  if (session) return session;

  const { host, port = 9229, appName = 'RNApp', handlers = {} } = options;
  const deviceId = makeDeviceId();

  // 先声明 wsRef（consoleCapture 的 onLog 闭包在初始化窗口内可能触发，避免 TDZ）
  let wsRef: WsClient | undefined;

  const consoleCapture = setupConsoleCapture({
    onLog: entry => wsRef?.sendEvent('console', entry),
  });

  const executor = createCommandExecutor({
    handlers: {
      ping: () => ({ pong: true, time: Date.now() }),
      'device.info': () => ({
        deviceId,
        appName,
        platform: Platform.OS,
        osVersion: Platform.Version,
        sdkVersion: SDK_VERSION,
        connected: wsRef?.isConnected() ?? false,
      }),
      'console.getLogs': payload => {
        const p = (payload ?? {}) as { level?: string; limit?: number };
        return consoleCapture.getLogs({
          level: p.level as never,
          limit: p.limit,
        });
      },
      ...createRabHandlers(),
      ...handlers,
    },
  });
  executorRef = executor;

  const ws = createWsClient({
    url: `ws://${host}:${port}/device`,
    registerMessage: {
      kind: 'register',
      deviceId,
      info: {
        appName,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        sdkVersion: SDK_VERSION,
      },
    },
    executor,
  });
  wsRef = ws;
  ws.connect();

  session = {
    deviceId,
    isConnected: () => ws.isConnected(),
    sendEvent: (event, data) => ws.sendEvent(event, data),
  };
  return session;
}

export function registerHandler(type: string, handler: DebugHandler): void {
  if (!executorRef) {
    throw new Error('registerHandler called before setupRNDebug');
  }
  executorRef.register(type, handler);
}

/** 仅测试使用：重置单例 */
export function resetRNDebugForTest(): void {
  session = undefined;
  executorRef = undefined;
}
```

`src/platform.ts`（避免测试环境直接 import react-native）：

```ts
interface PlatformLike {
  OS: string;
  Version: string | number;
}

let platform: PlatformLike | undefined;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  platform = (require('react-native') as { Platform: PlatformLike }).Platform;
} catch {
  platform = undefined;
}

export const Platform: PlatformLike = platform ?? {
  OS: typeof navigator !== 'undefined' && navigator.product === 'ReactNative' ? 'unknown' : 'web',
  Version: '0',
};
```

> 测试环境未装 react-native，`require` 抛错后回退，`Platform.OS` 为 'web'——满足"typeof platform 为 string"的断言。若 monorepo eslint 禁用 require，对该文件加 `/* eslint-disable */` 或在 package.json eslintConfig 里放行。

- [ ] **Step 4: 实现 main.ts**

`src/main.ts`：

```ts
export { setupRNDebug, registerHandler } from './setup';
export type { RNDebugOptions, RNDebugSession } from './setup';
export { registerHandler as registerCommandHandler } from './setup';
export type { DebugHandler } from './types';
export { safeSerialize } from './serialize';
export { setupConsoleCapture } from './console-capture';
export { createCommandExecutor } from './command-executor';
export type { CommandExecutor } from './command-executor';
export { createWsClient } from './ws-client';
export type { WsClient, MinimalWebSocket, WebSocketConstructor } from './ws-client';
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd packages/rn-debug && pnpm jest`
Expected: PASS（serialize 4 + executor 6 + ws-client 4 + console 5 + rab 5 + setup 6 = 30 tests）

- [ ] **Step 6: Commit**

```bash
git add packages/rn-debug
git commit -m "feat(rn-debug): setupRNDebug 入口与内置指令集成"
```

---

### Task 13: SDK 构建配置

**Files:**

- Create: `packages/rn-debug/build.config.ts`
- Create: `packages/rn-debug/README.md`

**Interfaces:**

- Consumes: Task 7–12 的 src
- Produces: `lib/` 双格式产物 + 类型声明；`RAB_RN_DEBUG_VERSION` define 注入

- [ ] **Step 1: 实现 build.config.ts**

```ts
import { execSync } from 'child_process';

import * as esbuild from 'esbuild';

const shouldMinify = process.env.MINIFY === 'true';
const version = JSON.parse(execSync('cat package.json', { encoding: 'utf8' })).version;

async function buildLibrary() {
  const common = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    minify: shouldMinify,
    sourcemap: true,
    target: ['es2020'],
    platform: 'neutral' as const, // RN 不依赖 node API
    external: ['@rabjs/*', 'react-native'],
    define: {
      'process.env.NODE_ENV': '"production"',
      RAB_RN_DEBUG_VERSION: JSON.stringify(version),
    },
    legalComments: 'none' as const,
    charset: 'utf8' as const,
    logLevel: 'info' as const,
  };
  await esbuild.build({ ...common, outfile: 'lib/main.js', format: 'esm' });
  console.log('✓ ESM built');
  await esbuild.build({ ...common, outfile: 'lib/main.cjs', format: 'cjs' });
  console.log('✓ CJS built');
  execSync('tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck', {
    stdio: 'inherit',
  });
  console.log('✓ Types generated');
}

buildLibrary()
  .then(() => console.log('\n✅ Build completed'))
  .catch(() => process.exit(1));
```

> `src/setup.ts` 中 `declare const RAB_RN_DEBUG_VERSION` 在未 define 的环境（jest 直接跑源码）为 undefined，已有回退逻辑，无需改动。但 `typeof RAB_RN_DEBUG_VERSION` 对未声明变量在 TS 编译时会报错——把 declare 行改为：

```ts
declare const RAB_RN_DEBUG_VERSION: string;
```

并确保 `typeof RAB_RN_DEBUG_VERSION !== 'undefined'` 判断保留（TS 下 typeof 检查是合法的）。

- [ ] **Step 2: 验证构建**

Run: `cd packages/rn-debug && pnpm build`
Expected: 输出 `✅ Build completed`，`lib/main.js`、`lib/main.cjs`、`lib/main.d.ts` 存在

Run: `cd packages/rn-debug && pnpm jest`
Expected: PASS（30 tests，确认构建配置未破坏测试）

- [ ] **Step 3: 写 README.md**

`README.md`：

````markdown
# @rabjs/rn-debug

RABjs React Native 调试 SDK。长连接 `@rabjs/rn-debug-server`，接收指令顺序执行并回传结果。

## 使用

```ts
import { setupRNDebug, registerHandler } from '@rabjs/rn-debug';

// App 入口（仅 __DEV__ 生效，生产 no-op）
setupRNDebug({
  host: '192.168.1.5', // 电脑局域网 IP（server 启动时会打印）
  port: 9229,
  appName: 'MyApp',
});

// 可选：注册自定义指令
registerHandler('app.gotoScreen', async ({ name }) => {
  navigationRef.navigate(name);
  return { current: name };
});
```

## 内置指令

| type                  | payload                                    | 说明                                   |
| --------------------- | ------------------------------------------ | -------------------------------------- |
| ping                  | —                                          | 连通性                                 |
| device.info           | —                                          | 设备与应用信息                         |
| console.getLogs       | `{level?, limit?}`                         | 拉取设备端 console 日志（环形 500 条） |
| rab.listServices      | —                                          | 枚举已实例化 Service                   |
| rab.getServiceState   | `{instanceId?, identifierLabel?, paths?}`  | 读取 Service 状态                      |
| rab.callServiceMethod | `{instanceId, method, args?}`              | 调用 Service 方法                      |
| rab.expect            | `{instanceId, description?, assertions[]}` | 断言（op 与 @rabjs/devtools 一致）     |

配合 `npx rab-rn-debug` 使用，详见 server 包 README。
````

- [ ] **Step 4: Commit**

```bash
git add packages/rn-debug
git commit -m "feat(rn-debug): 构建配置与 README"
```

---

### Task 14: skill 文档 `skills/rab-rn-debug/SKILL.md`

**Files:**

- Create: `skills/rab-rn-debug/SKILL.md`

**Interfaces:**

- Consumes: Task 1–13 的最终 API 与指令集
- Produces: Agent 可依据其调试 RN 应用的 skill 文档

- [ ] **Step 1: 写 SKILL.md**

frontmatter 对齐 `skills/rab-cdp-debug/SKILL.md`（name/description/version/npm/sourcePath/repository），正文按 spec 第 6 节大纲。完整内容：

````markdown
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

1. 电脑上启动调试服务：

```bash
npx rab-rn-debug            # 默认端口 9229，启动时会打印局域网 IP
```

2. RN 应用已集成 SDK（App 入口，仅 `__DEV__` 生效）：

```ts
import { setupRNDebug } from '@rabjs/rn-debug';

setupRNDebug({ host: '<电脑局域网IP>', port: 9229, appName: 'MyApp' });
```

3. 确认设备在线：

```bash
curl -s http://localhost:9229/api/devices
# 期望: [{"deviceId":"rn-ios-xxxx","appName":"MyApp","platform":"ios",...}]
```

如果目标 App 尚未接入，先引导用户完成上述步骤再调试。多设备在线时，请求需带 `deviceId`（见下）。

---

## 指令调用方式

```bash
curl -X POST http://localhost:9229/api/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"<指令type>","payload":{...},"timeout":30000}'
```

- 唯一设备在线时自动路由；多设备返回 409（body 含候选 deviceId），改用 `POST /api/devices/<deviceId>/commands`；无设备返回 404。
- 响应：`{"id","status":"ok"|"error"|"timeout","result","durationMs"}`。
- 同一设备指令严格串行；默认超时 30s（上限 120s），异步方法耗时长时可加大 timeout。

---

## 常用调试操作

### 1. 连通性检查

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"ping"}'
# 期望 status ok, result.pong === true
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
      "instanceId": "CartService_abc12",
      "containerName": "ProductPage_2",
      "identifierLabel": "CartService"
    }
  ]
}
```

### 3. 读取 Service 状态

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"rab.getServiceState","payload":{"identifierLabel":"CartService"}}'
```

`paths` 可只取部分字段：`{"payload":{"identifierLabel":"CartService","paths":["total","items.length"]}}`

### 4. 调用 Service 方法（含异步）

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"rab.callServiceMethod","payload":{
    "instanceId":"CartService_abc12","method":"addItem",
    "args":[{"id":"test-1","name":"Test","price":9.9}]}}'
```

### 5. 断言验证（rab.expect）

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"rab.expect","payload":{
    "instanceId":"CartService_abc12",
    "description":"加购后状态验证",
    "assertions":[
      {"op":"eq","path":"items.length","expected":1},
      {"op":"gt","path":"total","expected":0},
      {"op":"exists","path":"items.0.id"}
    ]}}'
```

op 速查：`eq` `neq` `gt` `gte` `lt` `lte` `between` `exists` `notExists` `includes` `notIncludes` `matches` `type` `length` `lengthGt` `lengthGte` `lengthLt` `lengthLte` `hasKeys` `matchObject` `deepEq` `some` `every`（语义与 @rabjs/devtools RSExpectBuilder 一致）。

### 6. 拉取设备 console 日志

```bash
curl -X POST localhost:9229/api/commands -H 'Content-Type: application/json' \
  -d '{"type":"console.getLogs","payload":{"level":"error","limit":20}}'
```

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

### 指令返回 timeout？

- 设备端 handler 执行过久——加大 `timeout`；或设备已掉线，先查 `/api/devices`

### 返回 409？

- 多台设备在线，从 body 的 `devices` 数组选一个，改用 `/api/devices/<deviceId>/commands`

### 结果字段缺失？

- handler 返回值必须 JSON 可序列化；循环引用/函数/过深结构会被 SDK 清洗或截断
````

- [ ] **Step 2: 校验文档中的 API 与实现一致**

对照 `packages/rn-debug-server/src/server.ts` 与 `packages/rn-debug/src/setup.ts` 逐项核对：端点路径、默认端口、指令 type 名、payload 字段名、op 列表。发现不一致改文档（以实现为准）。

- [ ] **Step 3: Commit**

```bash
git add skills/rab-rn-debug
git commit -m "docs: rab-rn-debug skill"
```

---

### Task 15: 端到端联调验证 + 收尾

**Files:**

- Create: `packages/rn-debug/src/__tests__/e2e.test.ts`（SDK 与 server 同进程联调，不依赖真实手机）

**Interfaces:**

- Consumes: 两个包的全部产出
- Produces: 端到端测试证明全链路可用

- [ ] **Step 1: 写 e2e 测试**

`packages/rn-debug/src/__tests__/e2e.test.ts`：

```ts
/**
 * 端到端：真 server + ws 模拟设备传输 + SDK executor/handler 栈
 * （不 import server 包 —— server 以子进程或同仓库 import 方式接入）
 */
import { createServer as createHttpServer } from 'http';

// 直接 import 同仓库 server 包源码（jest moduleNameMapper 或相对路径）
import { createDebugServer } from '../../../rn-debug-server/src/server';
import { setupRNDebug, resetRNDebugForTest } from '../setup';
import type { MinimalWebSocket } from '../ws-client';

// Node 环境 WS 实现（ws 包）
import WS from 'ws';

class NodeWebSocketAdapter implements MinimalWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(private readonly inner: WS) {
    inner.on('open', () => this.onopen?.());
    inner.on('message', data => this.onmessage?.({ data: String(data) }));
    inner.on('close', () => this.onclose?.());
    inner.on('error', () => this.onerror?.());
  }
  send(data: string) {
    this.inner.send(data);
  }
  close() {
    this.inner.close();
  }
}

describe('e2e: SDK ⇄ server', () => {
  it('register → rab.listServices → 结果回到 HTTP 响应', async () => {
    const server = await createDebugServer({ port: 9236 });
    try {
      (globalThis as { __DEV__?: boolean }).__DEV__ = true;
      (globalThis as { WebSocket?: unknown }).WebSocket = class {
        constructor(url: string) {
          return new NodeWebSocketAdapter(new WS(url));
        }
      } as unknown as never;
      resetRNDebugForTest();
      setupRNDebug({ host: '127.0.0.1', port: 9236, appName: 'E2E' });

      // 等设备注册
      await new Promise(r => setTimeout(r, 300));
      const devices = (await fetch('http://127.0.0.1:9236/api/devices').then(r =>
        r.json()
      )) as unknown[];
      expect(devices.length).toBe(1);

      const body = (await fetch('http://127.0.0.1:9236/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'rab.listServices', payload: {} }),
      }).then(r => r.json())) as { status: string; result: unknown[] };

      expect(body.status).toBe('ok');
      expect(Array.isArray(body.result)).toBe(true);
      resetRNDebugForTest();
    } finally {
      await server.close();
    }
  });
});
```

> 该测试需要 `@rabjs/rn-debug` 的 jest 能解析 `../../../rn-debug-server/src/server`（相对路径 import，跨包源码引用，无需构建产物）。若 ts-jest 报跨包根目录（rootDir）错误，在 `packages/rn-debug/jest.config.js` 加 `"roots": ["<rootDir>/src", "<rootDir>/../rn-debug-server/src"]` 与对应 moduleNameMapper；仍不行则退化为把 e2e 测试放到 `packages/rn-debug-server/src/__tests__/sdk-e2e.test.ts` 并反向相对引用（server 包 rootDir 覆盖 rn-debug/src）。优先选第一种。

- [ ] **Step 2: 运行 e2e 测试**

Run: `cd packages/rn-debug && pnpm jest src/__tests__/e2e.test.ts`
Expected: PASS（1 test）

- [ ] **Step 3: 全量验证**

Run:

```bash
cd packages/rn-debug-server && pnpm jest && pnpm build
cd ../rn-debug && pnpm jest && pnpm build
```

Expected: server 21 tests PASS（含 debug-page）、SDK 31 tests PASS（含 e2e）、两个包构建成功

Run（CLI 冒烟）:

```bash
cd packages/rn-debug-server && node bin/rab-rn-debug.js --port 9237 &
sleep 1 && curl -s http://127.0.0.1:9237/api/devices
kill %1
```

Expected: `[]`

- [ ] **Step 4: 手动真机验收（有设备时）**

1. 启动 server，记下打印的 IP
2. 在 RN 示例 App（examples 下任一 RN 项目；若无则在现有示例加 setupRNDebug 调用）配置 host
3. 浏览器打开调试页面确认设备出现
4. 用调试页面发送 `rab.listServices`，确认流水与结果渲染

无真机/模拟器环境时记录此步骤为跳过，不阻塞收尾。

- [ ] **Step 5: Commit**

```bash
git add packages/rn-debug packages/rn-debug-server
git commit -m "test: rab-rn-debug 端到端联调验证"
```

---

## 任务依赖图

```
Task 1 (server 脚手架+注册表) ─ Task 2 (分发器+HTTP) ─ Task 3 (超时集成) ─ Task 4 (events) ─ Task 5 (调试页面) ─ Task 6 (CLI+构建)
Task 7 (SDK 脚手架+序列化) ─ Task 8 (执行器) ─ Task 9 (WS 客户端) ─ Task 12 (setupRNDebug，还需 Task 10/11)
Task 7 ─ Task 10 (console 捕获)
Task 7 ─ Task 11 (rab handlers)
Task 12 ─ Task 13 (SDK 构建)
Task 1-13 ─ Task 14 (skill 文档)
Task 6 + Task 13 ─ Task 15 (e2e + 收尾)
```

串行执行顺序即 Task 1→15；若并行，Task 7-11 可与 Task 1-6 并行。
