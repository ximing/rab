import { safeSerialize } from './serialize';
import type { CommandMessage, DebugHandler, ResultMessage } from './types';

export interface CommandExecutor {
  register(type: string, handler: DebugHandler): void;
  execute(command: CommandMessage, send: (msg: ResultMessage) => void): Promise<void>;
}

export function createCommandExecutor(
  options?: { handlers?: Record<string, DebugHandler> }
): CommandExecutor {
  const handlers = new Map<string, DebugHandler>(Object.entries(options?.handlers ?? {}));
  let queue: Promise<void> = Promise.resolve();

  async function runOne(command: CommandMessage, send: (msg: ResultMessage) => void) {
    // send 本身可能抛错（如 RN WebSocket 非 OPEN 状态 throw），不能让它逃出去打断队列
    const safeSend = (msg: ResultMessage) => {
      try {
        send(msg);
      } catch {
        // 回传失败（连接已断等）：吞掉，队列继续处理后续指令
      }
    };
    const handler = handlers.get(command.type);
    if (!handler) {
      safeSend({
        kind: 'result',
        id: command.id,
        status: 'error',
        error: { message: `unknown command type: ${command.type}` },
      });
      return;
    }
    try {
      const raw = await handler(command.payload);
      const serialized = safeSerialize(raw);
      if (serialized.ok) {
        safeSend({ kind: 'result', id: command.id, status: 'ok', result: serialized.data });
      } else {
        safeSend({ kind: 'result', id: command.id, status: 'error', error: serialized.error });
      }
    } catch (err) {
      const error = err as { message?: string; stack?: string };
      safeSend({
        kind: 'result',
        id: command.id,
        status: 'error',
        error: { message: error.message ?? String(err), stack: error.stack },
      });
    }
  }

  return {
    register(type, handler) {
      if (handlers.has(type)) {
        throw new Error(`command handler already registered: ${type}`);
      }
      handlers.set(type, handler);
    },
    execute(command, send) {
      // 保险丝：任何未预见的异常都不能把 queue 打成永久 rejected（否则设备从此对一切指令静默）
      queue = queue
        .then(() => runOne(command, send))
        .catch(() => undefined);
      return queue;
    },
  };
}
