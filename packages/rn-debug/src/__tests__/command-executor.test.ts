import { createCommandExecutor } from '../command-executor';
import type { ResultMessage } from '../types';

function setup() {
  const sent: ResultMessage[] = [];
  const executor = createCommandExecutor({
    handlers: {
      echo: async (payload) => payload,
      fail: () => {
        throw new Error('boom');
      },
    },
  });
  const send = (msg: ResultMessage) => sent.push(msg);
  return { executor, sent, send };
}

const cmd = (id: string, type: string, payload?: unknown) =>
  ({ kind: 'command', id, type, payload }) as const;

describe('CommandExecutor', () => {
  it('执行 handler 并回传 ok + 序列化结果', async () => {
    const { executor, sent, send } = setup();
    await executor.execute(cmd('1', 'echo', { a: 1 }), send);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'result', id: '1', status: 'ok', result: { a: 1 } });
  });

  it('handler 抛错回传 error（message + stack）', async () => {
    const { executor, sent, send } = setup();
    await executor.execute(cmd('2', 'fail'), send);
    expect(sent[0]).toMatchObject({ id: '2', status: 'error' });
    expect(sent[0].error?.message).toBe('boom');
    expect(typeof sent[0].error?.stack).toBe('string');
  });

  it('未知 type 回传 error', async () => {
    const { executor, sent, send } = setup();
    await executor.execute(cmd('3', 'nope'), send);
    expect(sent[0]).toMatchObject({
      id: '3',
      status: 'error',
      error: { message: 'unknown command type: nope' },
    });
  });

  it('严格串行：慢指令完成前不执行下一条', async () => {
    const order: string[] = [];
    const executor = createCommandExecutor({
      handlers: {
        slow: async () => {
          await new Promise((r) => setTimeout(r, 80));
          order.push('slow-done');
        },
        fast: async () => {
          order.push('fast-done');
        },
      },
    });
    const send = () => {};
    const p1 = executor.execute(cmd('a', 'slow'), send);
    const p2 = executor.execute(cmd('b', 'fast'), send);
    await Promise.all([p1, p2]);
    expect(order).toEqual(['slow-done', 'fast-done']);
  });

  it('结果不可序列化时回传 error', async () => {
    const cyc: Record<string, unknown> = {};
    cyc.self = cyc;
    // safeSerialize 会切断循环引用并成功，因此这里用 Symbol 值制造 JSON.stringify 失败的补充场景：
    const executor = createCommandExecutor({
      handlers: { weird: () => cyc },
    });
    const sent: ResultMessage[] = [];
    await executor.execute(cmd('4', 'weird'), (m) => sent.push(m));
    expect(sent[0].status).toBe('ok'); // 循环引用被切断后可序列化
  });

  it('send 抛错不毒化队列：下一条指令仍执行并回传', async () => {
    const sent: ResultMessage[] = [];
    let throwOnce = true;
    const send = (msg: ResultMessage) => {
      if (throwOnce) {
        throwOnce = false;
        throw new Error('WebSocket is not open');
      }
      sent.push(msg);
    };
    const executor = createCommandExecutor({ handlers: { echo: async (p) => p } });

    const p1 = executor.execute(cmd('1', 'echo', { a: 1 }), send);
    const p2 = executor.execute(cmd('2', 'echo', { b: 2 }), send);
    await Promise.all([p1, p2]);

    // 第一条的 result 回传失败被吞掉；第二条正常送达
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ id: '2', status: 'ok', result: { b: 2 } });
  });

  it('未知 type 分支 send 抛错同样不毒化队列', async () => {
    const sent: ResultMessage[] = [];
    const executor = createCommandExecutor({ handlers: { echo: async (p) => p } });

    const p1 = executor.execute(cmd('1', 'nope'), () => {
      throw new Error('WebSocket is not open');
    });
    const p2 = executor.execute(cmd('2', 'echo', { ok: true }), (m) => sent.push(m));
    await Promise.all([p1, p2]);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ id: '2', status: 'ok', result: { ok: true } });
  });

  it('register 重复 type 抛错', () => {
    const executor = createCommandExecutor();
    executor.register('x', () => 1);
    expect(() => executor.register('x', () => 2)).toThrow(/already registered/);
  });
});
