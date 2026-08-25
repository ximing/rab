import WebSocket from 'ws';
import { createDebugServer } from '../server';
import { httpFetch, messageKind, waitFor, waitForDevice } from './wait-for';

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
  await waitForDevice(port, deviceId);
  return { ws, received };
}

describe('timeout & disconnect (integration)', () => {
  let server: Awaited<ReturnType<typeof createDebugServer>>;
  let port = 0;

  afterEach(async () => {
    await server?.close();
  });

  it('设备不回 result 时按 timeout 返回，晚到 result 被丢弃', async () => {
    server = await createDebugServer({ port: 0 });
    port = server.port;
    const { ws, received } = await connectDevice(port, 'dev-t');

    const body = (await httpFetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'hang', payload: {}, timeout: 400 }),
    }).then(r => r.json())) as { status: string; durationMs: number };

    expect(body.status).toBe('timeout');
    expect(body.durationMs).toBeGreaterThanOrEqual(350);

    // 晚到 result：不应抛错（服务端日志静默丢弃）
    await waitFor(
      () => received.some(m => messageKind(m) === 'command'),
      'timed-out command was sent'
    );
    const sent = received.find(m => messageKind(m) === 'command')!;
    ws.send(JSON.stringify({ kind: 'result', id: JSON.parse(sent).id, status: 'ok', result: 1 }));
    await waitFor(
      () => server.dispatcher.getCommand(JSON.parse(sent).id)?.status === 'timeout',
      'late result left timeout status'
    );
    const record = server.dispatcher.getCommand(JSON.parse(sent).id);
    expect(record?.status).toBe('timeout');
    ws.close();
  });

  it('设备 WS 断开时 pending 指令立即 error 返回', async () => {
    server = await createDebugServer({ port: 0 });
    port = server.port;
    const { ws, received } = await connectDevice(port, 'dev-d');

    const promise = httpFetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'hang', timeout: 10_000 }),
    }).then(r => r.json());

    await waitFor(
      () => received.some(m => messageKind(m) === 'command'),
      'command delivered before disconnect'
    );
    ws.terminate();
    const body = (await promise) as { status: string; error: { message: string } };
    expect(body.status).toBe('error');
    expect(body.error.message).toBe('device disconnected');
  });
});
