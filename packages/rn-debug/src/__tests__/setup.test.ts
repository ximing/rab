import { setupRNDebug, registerHandler, resetRNDebugForTest } from '../setup';
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
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
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
    ws.simulateMessage(JSON.stringify({ kind: 'command', id: 'c2', type: 'device.info', payload: {} }));
    ws.simulateMessage(JSON.stringify({ kind: 'command', id: 'c3', type: 'console.getLogs', payload: { limit: 10 } }));
    await new Promise((r) => setTimeout(r, 100));
    const results = ws.sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.kind === 'result');
    expect(results.find((r) => r.id === 'c1')).toMatchObject({ status: 'ok', result: { pong: true } });
    expect(results.find((r) => r.id === 'c2')?.result).toMatchObject({ appName: 'TestApp' });
    expect(results.find((r) => r.id === 'c3')).toMatchObject({ status: 'ok', result: [] });
  });

  it('handlers 选项注册自定义指令', async () => {
    setup({ handlers: { 'app.ping': () => 'pong-app' } });
    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({ kind: 'command', id: 'c1', type: 'app.ping', payload: {} }));
    await new Promise((r) => setTimeout(r, 50));
    expect(JSON.parse(ws.sent.find((s) => JSON.parse(s).kind === 'result')!)).toMatchObject({
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
    ws.simulateMessage(JSON.stringify({ kind: 'command', id: 'c9', type: 'app.late', payload: {} }));
    await new Promise((r) => setTimeout(r, 50));
    expect(JSON.parse(ws.sent.find((s) => JSON.parse(s).kind === 'result')!)).toMatchObject({
      id: 'c9',
      status: 'ok',
      result: 42,
    });
  });
});
