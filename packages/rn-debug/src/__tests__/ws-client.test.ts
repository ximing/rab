import { createCommandExecutor } from '../command-executor';
import { createWsClient } from '../ws-client';
import type { MinimalWebSocket, WebSocketConstructor } from '../ws-client';
import { waitFor } from './wait-for';

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

const clients: ReturnType<typeof createWsClient>[] = [];

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
    reconnectBaseMs: 10,
    ...overrides,
  });
  clients.push(client);
  return { client, executor };
}

describe('WsClient', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  afterEach(() => {
    // 清理心跳/重连定时器，避免 Jest 因 open handles 挂起
    for (const client of clients) client.disconnect();
    clients.length = 0;
  });

  it('连接后发送 register，收到 command 由 executor 执行并回传 result', async () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();

    const registerMsg = JSON.parse(ws.sent[0]);
    expect(registerMsg).toMatchObject({ kind: 'register', deviceId: 'dev-1' });

    ws.simulateServerMessage(JSON.stringify({ kind: 'command', id: 'c1', type: 'ping', payload: {} }));
    await waitFor(
      () => ws.sent.some((s) => JSON.parse(s).kind === 'result'),
      'executor result sent'
    );
    const resultMsg = JSON.parse(ws.sent.find((s) => JSON.parse(s).kind === 'result')!);
    expect(resultMsg).toMatchObject({ id: 'c1', status: 'ok', result: { pong: true } });
  });

  it('心跳周期性发送 ping', async () => {
    const { client } = makeClient({ heartbeatIntervalMs: 30 });
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();
    await waitFor(
      () => ws.sent.filter((s) => JSON.parse(s).kind === 'ping').length >= 2,
      'at least two heartbeat pings'
    );
  });

  it('断线后指数退避重连，重连成功重新 register', async () => {
    const { client } = makeClient();
    client.connect();
    const first = FakeWebSocket.instances[0];
    first.simulateOpen();
    first.onclose?.(); // 模拟服务端断开

    await waitFor(
      () => FakeWebSocket.instances.length >= 2,
      'reconnect created a second socket'
    );
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
    await new Promise((r) => setTimeout(r, 1200));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
