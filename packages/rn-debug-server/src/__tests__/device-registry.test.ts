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
