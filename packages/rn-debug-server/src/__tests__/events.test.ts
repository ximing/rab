import WebSocket from 'ws';
import { createDebugServer } from '../server';

function collect(ws: WebSocket) {
  const messages: unknown[] = [];
  ws.on('message', (raw) => messages.push(JSON.parse(String(raw))));
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
    await new Promise<void>((r) => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    await new Promise<void>((r) => dev.on('open', () => r()));
    dev.send(JSON.stringify({ kind: 'register', deviceId: 'dev-e', info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' } }));
    await new Promise((r) => setTimeout(r, 200));
    dev.close();
    await new Promise((r) => setTimeout(r, 200));

    const actions = events.filter((e) => (e as { kind: string }).kind === 'device').map((e) => (e as { action: string }).action);
    expect(actions).toContain('connected');
    expect(actions).toContain('disconnected');
  });

  it('设备 console event 转发为 {"kind":"console",deviceId,data}', async () => {
    server = await createDebugServer({ port });
    const dash = new WebSocket(`ws://127.0.0.1:${port}/events`);
    const events = collect(dash);
    await new Promise<void>((r) => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    await new Promise<void>((r) => dev.on('open', () => r()));
    dev.send(JSON.stringify({ kind: 'register', deviceId: 'dev-c', info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' } }));
    await new Promise((r) => setTimeout(r, 150));
    dev.send(JSON.stringify({ kind: 'event', event: 'console', data: { level: 'warn', args: ['hi'], time: 1 } }));
    await new Promise((r) => setTimeout(r, 200));

    const con = events.find((e) => (e as { kind: string }).kind === 'console') as { deviceId: string; data: { level: string } };
    expect(con).toBeDefined();
    expect(con.deviceId).toBe('dev-c');
    expect(con.data.level).toBe('warn');
    dev.close();
  });

  it('指令 sent/completed 事件广播', async () => {
    server = await createDebugServer({ port });
    const dash = new WebSocket(`ws://127.0.0.1:${port}/events`);
    const events = collect(dash);
    await new Promise<void>((r) => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    const devReceived: string[] = [];
    dev.on('message', (raw) => devReceived.push(String(raw)));
    await new Promise<void>((r) => dev.on('open', () => r()));
    dev.send(JSON.stringify({ kind: 'register', deviceId: 'dev-x', info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' } }));
    await new Promise((r) => setTimeout(r, 150));

    const promise = fetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    }).then((r) => r.json());
    await new Promise((r) => setTimeout(r, 150));
    const sent = devReceived.find((m) => JSON.parse(m).kind === 'command')!;
    dev.send(JSON.stringify({ kind: 'result', id: JSON.parse(sent).id, status: 'ok', result: 1 }));
    await promise;
    await new Promise((r) => setTimeout(r, 150));

    const cmdEvents = events.filter((e) => (e as { kind: string }).kind === 'command').map((e) => (e as { action: string }).action);
    expect(cmdEvents).toContain('sent');
    expect(cmdEvents).toContain('completed');
    dev.close();
  });
});
