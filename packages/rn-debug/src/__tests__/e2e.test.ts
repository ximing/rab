/**
 * 端到端：真 server + ws 模拟设备传输 + SDK executor/handler 栈
 * （server 以同仓库源码相对路径接入，无需构建产物）
 */
// 直接 import 同仓库 server 包源码（相对路径，跨包源码引用）
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
    inner.on('message', (data) => this.onmessage?.({ data: String(data) }));
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

const PORT = 9236;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('waitFor timeout');
}

describe('e2e: SDK ⇄ server', () => {
  let originalWebSocket: unknown;
  let originalDev: unknown;
  let hadWebSocket = false;

  beforeEach(() => {
    const g = globalThis as { WebSocket?: unknown; __DEV__?: boolean };
    hadWebSocket = 'WebSocket' in g;
    originalWebSocket = g.WebSocket;
    originalDev = g.__DEV__;
    g.__DEV__ = true;
    g.WebSocket = class {
      constructor(url: string) {
        return new NodeWebSocketAdapter(new WS(url));
      }
    } as unknown as never;
  });

  afterEach(() => {
    resetRNDebugForTest();
    const g = globalThis as { WebSocket?: unknown; __DEV__?: boolean };
    if (hadWebSocket) g.WebSocket = originalWebSocket;
    else delete g.WebSocket;
    if (originalDev === undefined) delete g.__DEV__;
    else g.__DEV__ = originalDev;
  });

  it('register → rab.listServices → 结果回到 HTTP 响应', async () => {
    const server = await createDebugServer({ port: PORT });
    try {
      const session = setupRNDebug({ host: '127.0.0.1', port: PORT, appName: 'E2E' });
      expect(session).toBeDefined();

      // 等设备注册
      await waitFor(async () => {
        const devices = (await fetch(`${BASE}/api/devices`).then((r) => r.json())) as unknown[];
        return devices.length === 1;
      });
      expect(session!.isConnected()).toBe(true);

      const body = (await fetch(`${BASE}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'rab.listServices', payload: {} }),
      }).then((r) => r.json())) as { status: string; result: unknown[] };

      expect(body.status).toBe('ok');
      expect(Array.isArray(body.result)).toBe(true);
    } finally {
      await server.close();
    }
  });
});
