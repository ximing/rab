import type { WebSocket as WsSocket } from 'ws';

export interface DeviceInfo {
  deviceId: string;
  appName: string;
  platform: string;
  osVersion: string;
  sdkVersion: string;
  connectedAt: number;
  lastSeen: number;
}

export interface DeviceEntry {
  deviceId: string;
  ws: WsSocket;
  info: Omit<DeviceInfo, 'deviceId' | 'connectedAt' | 'lastSeen'>;
  connectedAt: number;
  lastSeen: number;
}

export interface DeviceRegistry {
  add(device: DeviceEntry): void;
  remove(deviceId: string): boolean;
  get(deviceId: string): DeviceEntry | undefined;
  list(): DeviceInfo[];
  touch(deviceId: string): void;
}

/** 设备 → 服务端 register 消息 */
export interface RegisterMessage {
  kind: 'register';
  deviceId: string;
  info: { appName: string; platform: string; osVersion: string; sdkVersion: string };
}

export interface PingMessage {
  kind: 'ping';
}

export interface ResultMessage {
  kind: 'result';
  id: string;
  status: 'ok' | 'error';
  result?: unknown;
  error?: { message: string; stack?: string };
}

export interface DeviceEventMessage {
  kind: 'event';
  event: string;
  data: unknown;
}

export type DeviceToServerMessage = RegisterMessage | PingMessage | ResultMessage | DeviceEventMessage;

export interface CommandMessage {
  kind: 'command';
  id: string;
  type: string;
  payload?: unknown;
}
