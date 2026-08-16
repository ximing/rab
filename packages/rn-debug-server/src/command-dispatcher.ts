import type { DeviceRegistry, ResultMessage } from './types';

export interface CommandInput {
  type: string;
  payload?: unknown;
  timeout?: number;
}

export interface CommandOutcome {
  id: string;
  status: 'ok' | 'error' | 'timeout';
  result?: unknown;
  error?: { message: string; stack?: string };
  durationMs: number;
}

export interface CommandRecord extends Omit<CommandOutcome, 'status'> {
  /** 进行中的指令 status 为 'pending'（CommandOutcome 终态不含 'pending'） */
  status: CommandOutcome['status'] | 'pending';
  deviceId: string;
  type: string;
  payload?: unknown;
  sentAt: number;
  completedAt?: number;
}

interface Pending {
  record: CommandRecord;
  resolve: (outcome: CommandOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface CommandDispatcher {
  sendCommand(deviceId: string, input: CommandInput): Promise<CommandOutcome>;
  handleResult(msg: ResultMessage): boolean;
  handleDisconnect(deviceId: string): void;
  getHistory(): CommandRecord[];
  getCommand(id: string): CommandRecord | undefined;
}

const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 120_000;
const HISTORY_CAP = 100;

export function createCommandDispatcher(options: { registry: DeviceRegistry }): CommandDispatcher {
  const { registry } = options;
  const pending = new Map<string, Pending>();
  const history: CommandRecord[] = [];
  const queues = new Map<string, Promise<void>>();

  function finish(outcome: CommandOutcome, p: Pending) {
    clearTimeout(p.timer);
    pending.delete(outcome.id);
    Object.assign(p.record, outcome, { completedAt: Date.now() });
    history.push(p.record);
    if (history.length > HISTORY_CAP) history.shift();
    p.resolve(outcome);
  }

  function sendAndAwait(deviceId: string, input: CommandInput): Promise<CommandOutcome> {
    return new Promise<CommandOutcome>((resolve) => {
      const entry = registry.get(deviceId);
      const id = `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const timeout = Math.min(input.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);
      const record: CommandRecord = {
        id,
        status: 'pending' as const,
        deviceId,
        type: input.type,
        payload: input.payload,
        sentAt: Date.now(),
        durationMs: 0,
      };
      const p: Pending = {
        record,
        resolve,
        timer: setTimeout(() => {
          finish({ id, status: 'timeout', durationMs: Date.now() - record.sentAt }, p);
        }, timeout),
      };
      pending.set(id, p);

      // 测试桩 socket 可能没有 readyState（undefined 视为可发送，仅明确的非 OPEN 才视为断开）
      const readyState = (entry?.ws as { readyState?: number } | undefined)?.readyState;
      if (!entry || (readyState !== undefined && readyState !== 1)) {
        finish({ id, status: 'error', error: { message: 'device disconnected' }, durationMs: 0 }, p);
        return;
      }
      entry.ws.send(JSON.stringify({ kind: 'command', id, type: input.type, payload: input.payload ?? {} }));
    });
  }

  return {
    sendCommand(deviceId, input) {
      // 首条指令同步发出（测试与调用方都期望 send 立即生效）；后续指令排在队列后串行执行
      const outcome = queues.has(deviceId)
        ? queues.get(deviceId)!.then(() => sendAndAwait(deviceId, input))
        : sendAndAwait(deviceId, input);
      queues.set(
        deviceId,
        outcome.then(
          () => undefined,
          () => undefined
        )
      );
      return outcome;
    },
    handleResult(msg) {
      const p = pending.get(msg.id);
      if (!p) return false;
      finish(
        {
          id: msg.id,
          status: msg.status,
          result: msg.result,
          error: msg.error,
          durationMs: Date.now() - p.record.sentAt,
        },
        p
      );
      return true;
    },
    handleDisconnect(deviceId) {
      for (const [id, p] of pending) {
        if (p.record.deviceId !== deviceId) continue;
        finish(
          { id, status: 'error', error: { message: 'device disconnected' }, durationMs: Date.now() - p.record.sentAt },
          p
        );
      }
      queues.delete(deviceId);
    },
    getHistory() {
      return [...history];
    },
    getCommand(id) {
      return pending.get(id)?.record ?? history.find((h) => h.id === id);
    },
  };
}
