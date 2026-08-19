import WebSocket from 'ws';
import { createDebugServer } from '../server';
import { httpFetch, messageKind, waitFor, waitForDevice } from './wait-for';

function collect(ws: WebSocket) {
  const messages: unknown[] = [];
  ws.on('message', (raw) => messages.push(JSON.parse(String(raw))));
  return messages;
}

describe('events bus /events', () => {
  let server: Awaited<ReturnType<typeof createDebugServer>>;
  let port = 0;

  afterEach(async () => {
    await server?.close();
  });

  it('设备上线/下线广播 connected/disconnected', async () => {
    server = await createDebugServer({ port: 0 });
    port = server.port;
    const dash = new WebSocket(`ws://127.0.0.1:${port}/events`);
    const events = collect(dash);
    await new Promise<void>((r) => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    await new Promise<void>((r) => dev.on('open', () => r()));
    dev.send(JSON.stringify({ kind: 'register', deviceId: 'dev-e', info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' } }));
    await waitForDevice(server.port, 'dev-e');
    await waitFor(
      () => events.some((e) => (e as { kind: string }).kind === 'device' && (e as { action: string }).action === 'connected'),
      'device connected event'
    );
    dev.close();
    await waitFor(
      () => events.some((e) => (e as { kind: string }).kind === 'device' && (e as { action: string }).action === 'disconnected'),
      'device disconnected event'
    );

    const actions = events.filter((e) => (e as { kind: string }).kind === 'device').map((e) => (e as { action: string }).action);
    expect(actions).toContain('connected');
    expect(actions).toContain('disconnected');
  });

  it('设备 console event 转发为 {"kind":"console",deviceId,data}', async () => {
    server = await createDebugServer({ port: 0 });
    port = server.port;
    const dash = new WebSocket(`ws://127.0.0.1:${port}/events`);
    const events = collect(dash);
    await new Promise<void>((r) => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    await new Promise<void>((r) => dev.on('open', () => r()));
    dev.send(JSON.stringify({ kind: 'register', deviceId: 'dev-c', info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' } }));
    await waitForDevice(server.port, 'dev-c');
    dev.send(JSON.stringify({ kind: 'event', event: 'console', data: { level: 'warn', args: ['hi'], time: 1 } }));
    await waitFor(
      () => events.some((e) => (e as { kind: string }).kind === 'console'),
      'console event forwarded'
    );

    const con = events.find((e) => (e as { kind: string }).kind === 'console') as { deviceId: string; data: { level: string } };
    expect(con).toBeDefined();
    expect(con.deviceId).toBe('dev-c');
    expect(con.data.level).toBe('warn');
    dev.close();
  });

  it('指令 sent/completed 事件广播', async () => {
    server = await createDebugServer({ port: 0 });
    port = server.port;
    const dash = new WebSocket(`ws://127.0.0.1:${port}/events`);
    const events = collect(dash);
    await new Promise<void>((r) => dash.on('open', () => r()));

    const dev = new WebSocket(`ws://127.0.0.1:${port}/device`);
    const devReceived: string[] = [];
    dev.on('message', (raw) => devReceived.push(String(raw)));
    await new Promise<void>((r) => dev.on('open', () => r()));
    dev.send(JSON.stringify({ kind: 'register', deviceId: 'dev-x', info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' } }));
    await waitForDevice(server.port, 'dev-x');

    const promise = httpFetch(`http://127.0.0.1:${port}/api/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
    }).then((r) => r.json());
    await waitFor(() => devReceived.some((m) => messageKind(m) === 'command'), 'command delivered for events test');
    const sent = devReceived.find((m) => messageKind(m) === 'command')!;
    dev.send(JSON.stringify({ kind: 'result', id: JSON.parse(sent).id, status: 'ok', result: 1 }));
    await promise;
    await waitFor(
      () =>
        events.some((e) => (e as { kind: string }).kind === 'command' && (e as { action: string }).action === 'sent') &&
        events.some((e) => (e as { kind: string }).kind === 'command' && (e as { action: string }).action === 'completed'),
      'command sent and completed events'
    );

    const cmdEvents = events.filter((e) => (e as { kind: string }).kind === 'command').map((e) => (e as { action: string }).action);
    expect(cmdEvents).toContain('sent');
    expect(cmdEvents).toContain('completed');
    dev.close();
  });
});
