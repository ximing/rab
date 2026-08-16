import { createCommandExecutor, type CommandExecutor } from './command-executor';
import { setupConsoleCapture, type ConsoleCapture } from './console-capture';
import { Platform } from './platform';
import { createRabHandlers } from './rab-handlers';
import type { DebugHandler } from './types';
import { createWsClient, type WsClient } from './ws-client';

// package.json version 由 build 时 define 注入；测试/源码运行时回退 '0.0.0'
declare const RAB_RN_DEBUG_VERSION: string | undefined;
const SDK_VERSION =
  typeof RAB_RN_DEBUG_VERSION !== 'undefined' ? RAB_RN_DEBUG_VERSION : '0.0.0';

export interface RNDebugOptions {
  host: string;
  port?: number;
  appName?: string;
  handlers?: Record<string, DebugHandler>;
}

export interface RNDebugSession {
  deviceId: string;
  isConnected(): boolean;
  sendEvent(event: string, data: unknown): void;
}

let session: RNDebugSession | undefined;
let executorRef: CommandExecutor | undefined;
let wsRef: WsClient | undefined;
let consoleRef: ConsoleCapture | undefined;

function makeDeviceId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `rn-${Platform.OS}-${rand}`;
}

export function setupRNDebug(options: RNDebugOptions): RNDebugSession | undefined {
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  if (dev === false) return undefined; // 生产 no-op；undefined（非 RN 环境）按 dev 处理便于测试
  if (session) return session;

  const { host, port = 9229, appName = 'RNApp', handlers = {} } = options;
  const deviceId = makeDeviceId();

  // 先声明 wsRef（consoleCapture 的 onLog 闭包在初始化窗口内可能触发，避免 TDZ）
  const consoleCapture = setupConsoleCapture({
    onLog: (entry) => wsRef?.sendEvent('console', entry),
  });
  consoleRef = consoleCapture;

  const executor = createCommandExecutor({
    handlers: {
      ping: () => ({ pong: true, time: Date.now() }),
      'device.info': () => ({
        deviceId,
        appName,
        platform: Platform.OS,
        osVersion: Platform.Version,
        sdkVersion: SDK_VERSION,
        connected: wsRef?.isConnected() ?? false,
      }),
      'console.getLogs': (payload) => {
        const p = (payload ?? {}) as { level?: string; limit?: number };
        return consoleCapture.getLogs({
          level: p.level as never,
          limit: p.limit,
        });
      },
      ...createRabHandlers(),
      ...handlers,
    },
  });
  executorRef = executor;

  const ws = createWsClient({
    url: `ws://${host}:${port}/device`,
    registerMessage: {
      kind: 'register',
      deviceId,
      info: {
        appName,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        sdkVersion: SDK_VERSION,
      },
    },
    executor,
  });
  wsRef = ws;
  ws.connect();

  session = {
    deviceId,
    isConnected: () => ws.isConnected(),
    sendEvent: (event, data) => ws.sendEvent(event, data),
  };
  return session;
}

export function registerHandler(type: string, handler: DebugHandler): void {
  if (!executorRef) {
    throw new Error('registerHandler called before setupRNDebug');
  }
  executorRef.register(type, handler);
}

/** 仅测试使用：重置单例并释放连接 / console patch */
export function resetRNDebugForTest(): void {
  wsRef?.disconnect();
  consoleRef?.restore();
  session = undefined;
  executorRef = undefined;
  wsRef = undefined;
  consoleRef = undefined;
}
