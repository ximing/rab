import WebSocket from 'ws';
import { createDebugServer } from '../server';

async function connectDevice(port: number, deviceId: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/device`);
  const received: string[] = [];
  ws.on('message', (raw) => received.push(String(raw)));
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
  await new Promise((r) => setTimeout(r, 150));
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
    }).then((r) => r.json());

    await new Promise((r) => setTimeout(r, 150));
    expect(received.filter((m) => JSON.parse(m).kind === 'command')).toHaveLength(1);
    reply(ws, received.find((m) => JSON.parse(m).kind === 'command')!, 'ok', { pong: true });

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
    }).then((r) => r.json());

    await new Promise((r) => setTimeout(r, 150));
    reply(ws, received.find((m) => JSON.parse(m).kind === 'command')!, 'ok', { platform: 'ios' });
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
    await new Promise((r) => setTimeout(r, 200));
    const none = await fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    });
    expect(none.status).toBe(404);
  });

  it('POST 非法 JSON body 返回 400，server 存活继续服务（不触发 unhandledRejection）', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (err: unknown) => unhandled.push(err);
    process.on('unhandledRejection', onUnhandled);
    server = await createDebugServer({ port });
    const { ws, received } = await connectDevice(port, 'dev-1');

    try {
      const bad = await fetch(`http://127.0.0.1:${port}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"type": "ping",',
      });
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as { error: string }).error).toMatch(/JSON/);

      // 畸形百分号编码的 deviceId（decodeURIComponent 抛 URIError）同样兜底
      const badUri = await fetch(`http://127.0.0.1:${port}/api/devices/%/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ping' }),
      });
      expect(badUri.status).toBe(400);

      // server 未崩溃：同一连接的设备仍可正常接收指令并回传
      const promise = fetch(`http://127.0.0.1:${port}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ping', payload: {} }),
      }).then((r) => r.json());
      await new Promise((r) => setTimeout(r, 150));
      const command = received.find((m) => JSON.parse(m).kind === 'command')!;
      reply(ws, command, 'ok', { alive: true });
      const body = (await promise) as { status: string; result: unknown };
      expect(body.status).toBe('ok');
      expect(body.result).toEqual({ alive: true });
    } finally {
      process.off('unhandledRejection', onUnhandled);
      ws.close();
    }
    expect(unhandled).toHaveLength(0);
  });

  it('GET /api/commands/:id 返回指令状态', async () => {
    server = await createDebugServer({ port });
    const { ws, received } = await connectDevice(port, 'dev-1');
    const promise = fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    }).then((r) => r.json());
    await new Promise((r) => setTimeout(r, 150));
    const sent = received.find((m) => JSON.parse(m).kind === 'command')!;
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
