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
    await new Promise((r) => setTimeout(r, 200));

    const res = await fetch('http://127.0.0.1:9229/api/devices');
    expect(res.status).toBe(200);
    const devices = (await res.json()) as Array<{ deviceId: string; appName: string }>;
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ deviceId: 'dev-1', appName: 'App' });

    ws.close();
    await new Promise((r) => setTimeout(r, 200));
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
    ws.send(JSON.stringify({ kind: 'register', deviceId: 'dev-2', info: { appName: 'A', platform: 'android', osVersion: '14', sdkVersion: '0.1.0' } }));
    await new Promise((r) => setTimeout(r, 150));
    const before = server.registry.get('dev-2')!.lastSeen;
    await new Promise((r) => setTimeout(r, 20));
    ws.send(JSON.stringify({ kind: 'ping' }));
    await new Promise((r) => setTimeout(r, 150));
    expect(server.registry.get('dev-2')!.lastSeen).toBeGreaterThan(before);
  });
});
