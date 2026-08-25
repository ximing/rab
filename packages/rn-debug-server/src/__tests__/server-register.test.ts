import WebSocket from 'ws';
import { createDebugServer } from '../server';
import { httpFetch, waitFor, waitForDevice, waitUntilDeviceGone } from './wait-for';

describe('debug server /device + /api/devices', () => {
  let server: Awaited<ReturnType<typeof createDebugServer>>;

  afterEach(async () => {
    await server?.close();
  });

  it('设备 register 后出现在 /api/devices；断开后移除', async () => {
    server = await createDebugServer({ port: 0 });
    const port = server.port;
    expect(port).toBeGreaterThan(0);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/device`);
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
    await waitForDevice(port, 'dev-1');

    const res = await httpFetch(`http://127.0.0.1:${port}/api/devices`);
    expect(res.status).toBe(200);
    const devices = (await res.json()) as Array<{ deviceId: string; appName: string }>;
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ deviceId: 'dev-1', appName: 'App' });

    ws.close();
    await waitUntilDeviceGone(port, 'dev-1');
    const res2 = await httpFetch(`http://127.0.0.1:${port}/api/devices`);
    expect(((await res2.json()) as unknown[]).length).toBe(0);
  });

  it('同 deviceId 重连后旧 socket 迟到 close 不把新连接踢下线', async () => {
    server = await createDebugServer({ port: 0 });
    const port = server.port;
    const register = (ws: WebSocket, deviceId: string) =>
      ws.send(
        JSON.stringify({
          kind: 'register',
          deviceId,
          info: { appName: 'App', platform: 'ios', osVersion: '17.5', sdkVersion: '0.1.0' },
        })
      );
    const open = (ws: WebSocket) =>
      new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

    const oldWs = new WebSocket(`ws://127.0.0.1:${port}/device`);
    await open(oldWs);
    register(oldWs, 'dev-race');
    await waitForDevice(port, 'dev-race');
    const oldEntryWs = server.registry.get('dev-race')!.ws;

    // 同 deviceId 重连：新连接注册，覆盖 registry 条目
    const newWs = new WebSocket(`ws://127.0.0.1:${port}/device`);
    await open(newWs);
    register(newWs, 'dev-race');
    await waitFor(
      () => server.registry.get('dev-race')?.ws !== oldEntryWs,
      'registry replaced with the new server-side socket'
    );
    const entryAfterReconnect = server.registry.get('dev-race')!;
    expect(entryAfterReconnect.ws.readyState).toBe(WebSocket.OPEN);

    // 旧连接关闭：守卫应阻止移除新设备的条目
    oldWs.close();
    await waitFor(() => oldWs.readyState === WebSocket.CLOSED, 'old client socket closed');

    const entry = server.registry.get('dev-race');
    expect(entry).toBeDefined();
    expect(entry!.ws).toBe(entryAfterReconnect.ws);
    expect(entry!.ws.readyState).toBe(WebSocket.OPEN);
    const res = await httpFetch(`http://127.0.0.1:${port}/api/devices`);
    expect(((await res.json()) as unknown[]).length).toBe(1);

    newWs.close();
    await waitUntilDeviceGone(port, 'dev-race');
  });

  it('ping 更新 lastSeen', async () => {
    server = await createDebugServer({ port: 0 });
    const port = server.port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/device`);
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
    await waitForDevice(port, 'dev-2');
    const before = server.registry.get('dev-2')!.lastSeen;
    await new Promise(r => setTimeout(r, 5));
    ws.send(JSON.stringify({ kind: 'ping' }));
    await waitFor(
      () => (server.registry.get('dev-2')?.lastSeen ?? 0) > before,
      'lastSeen updated after ping'
    );
  });
});
