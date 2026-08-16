import type { CommandExecutor } from './command-executor';
import type { CommandMessage, RegisterMessage, ResultMessage } from './types';

export interface MinimalWebSocket {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export type WebSocketConstructor = new (url: string) => MinimalWebSocket;

export interface WsClient {
  connect(): void;
  disconnect(): void;
  sendEvent(event: string, data: unknown): void;
  isConnected(): boolean;
}

interface WsClientOptions {
  url: string;
  registerMessage: RegisterMessage;
  executor: CommandExecutor;
  WebSocketImpl?: WebSocketConstructor;
  heartbeatIntervalMs?: number;
  reconnectBaseMs?: number;
}

export function createWsClient(options: WsClientOptions): WsClient {
  const {
    url,
    registerMessage,
    executor,
    WebSocketImpl = (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket,
    heartbeatIntervalMs = 15_000,
    reconnectBaseMs = 1_000,
  } = options;

  let ws: MinimalWebSocket | undefined;
  let connected = false;
  let manualClose = false;
  let retries = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    heartbeatTimer = undefined;
    reconnectTimer = undefined;
  }

  function scheduleReconnect() {
    if (manualClose) return;
    const delay = Math.min(reconnectBaseMs * 2 ** retries, 30_000);
    retries += 1;
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    if (!WebSocketImpl) return;
    ws = new WebSocketImpl(url);
    ws.onopen = () => {
      connected = true;
      retries = 0;
      ws!.send(JSON.stringify(registerMessage));
      heartbeatTimer = setInterval(() => {
        if (connected) ws?.send(JSON.stringify({ kind: 'ping' }));
      }, heartbeatIntervalMs);
    };
    ws.onmessage = (event) => {
      let msg: { kind?: string } & Record<string, unknown>;
      try {
        const text = typeof event.data === 'string' ? event.data : String(event.data);
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg.kind === 'command') {
        void executor.execute(msg as unknown as CommandMessage, (result: ResultMessage) => {
          ws?.send(JSON.stringify(result));
        });
      }
      // kind === 'pong' 忽略
    };
    ws.onclose = () => {
      connected = false;
      clearTimers();
      scheduleReconnect();
    };
    ws.onerror = () => {
      // 依赖 onclose 后续触发重连
    };
  }

  return {
    connect,
    disconnect() {
      manualClose = true;
      clearTimers();
      connected = false;
      ws?.close();
    },
    sendEvent(event, data) {
      if (!connected) return;
      ws?.send(JSON.stringify({ kind: 'event', event, data }));
    },
    isConnected() {
      return connected;
    },
  };
}
