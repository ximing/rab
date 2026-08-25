import { createCommandDispatcher } from '../command-dispatcher';
import type { DeviceRegistry } from '../types';
import { waitFor } from './wait-for';

function makeRegistry(
  ids: string[]
): DeviceRegistry & { sockets: Map<string, { sent: string[] }> } {
  const sockets = new Map<string, { sent: string[] }>();
  const devices = new Map();
  const reg = {
    add: (d: unknown) => devices.set((d as { deviceId: string }).deviceId, d),
    remove: (id: string) => devices.delete(id),
    get: (id: string) => devices.get(id),
    list: () => [],
    touch: () => {},
  } as unknown as DeviceRegistry;
  for (const id of ids) {
    sockets.set(id, { sent: [] });
    reg.add({
      deviceId: id,
      ws: { send: (data: string) => sockets.get(id)!.sent.push(data) },
      info: { appName: 'A', platform: 'ios', osVersion: '17', sdkVersion: '0.1.0' },
      connectedAt: 0,
      lastSeen: 0,
    });
  }
  return Object.assign(reg, { sockets });
}

describe('CommandDispatcher', () => {
  it('发送 command 后 pending，收到 result 才 resolve', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const promise = dispatcher.sendCommand('dev-1', { type: 'ping' });
    const sent = JSON.parse(reg.sockets.get('dev-1')!.sent[0]);
    expect(sent).toMatchObject({ kind: 'command', type: 'ping' });
    expect(typeof sent.id).toBe('string');

    dispatcher.handleResult({ kind: 'result', id: sent.id, status: 'ok', result: { pong: true } });
    await expect(promise).resolves.toMatchObject({ status: 'ok', result: { pong: true } });
  });

  it('handler 错误以 error 状态 resolve', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const promise = dispatcher.sendCommand('dev-1', { type: 'bad' });
    const sent = JSON.parse(reg.sockets.get('dev-1')!.sent[0]);
    dispatcher.handleResult({
      kind: 'result',
      id: sent.id,
      status: 'error',
      error: { message: 'boom' },
    });
    await expect(promise).resolves.toMatchObject({ status: 'error', error: { message: 'boom' } });
  });

  it('同一设备串行：前一条未完成不发下一条', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const p1 = dispatcher.sendCommand('dev-1', { type: 'a' });
    dispatcher.sendCommand('dev-1', { type: 'b' });
    expect(reg.sockets.get('dev-1')!.sent).toHaveLength(1);

    const first = JSON.parse(reg.sockets.get('dev-1')!.sent[0]);
    dispatcher.handleResult({ kind: 'result', id: first.id, status: 'ok', result: null });
    await p1;
    await waitFor(
      () => reg.sockets.get('dev-1')!.sent.length === 2,
      'second queued command flushed'
    );
    expect(reg.sockets.get('dev-1')!.sent).toHaveLength(2);
  });

  it('设备离线时 pending 指令立即以 error 结束', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const promise = dispatcher.sendCommand('dev-1', { type: 'a' });
    dispatcher.handleDisconnect('dev-1');
    await expect(promise).resolves.toMatchObject({
      status: 'error',
      error: { message: 'device disconnected' },
    });
  });

  it('历史记录可通过 getCommand 查询', async () => {
    const reg = makeRegistry(['dev-1']);
    const dispatcher = createCommandDispatcher({ registry: reg });
    const promise = dispatcher.sendCommand('dev-1', { type: 'ping' });
    const sent = JSON.parse(reg.sockets.get('dev-1')!.sent[0]);
    expect(dispatcher.getCommand(sent.id)?.status).toBe('pending');
    dispatcher.handleResult({ kind: 'result', id: sent.id, status: 'ok', result: 1 });
    await promise;
    expect(dispatcher.getCommand(sent.id)?.status).toBe('ok');
    expect(dispatcher.getHistory().length).toBe(1);
  });
});
