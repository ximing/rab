export interface CommandMessage {
  kind: 'command';
  id: string;
  type: string;
  payload?: unknown;
}

export interface ResultMessage {
  kind: 'result';
  id: string;
  status: 'ok' | 'error';
  result?: unknown;
  error?: { message: string; stack?: string };
}

export interface RegisterMessage {
  kind: 'register';
  deviceId: string;
  info: { appName: string; platform: string; osVersion: string; sdkVersion: string };
}

export type DebugHandler = (payload: unknown) => unknown | Promise<unknown>;
