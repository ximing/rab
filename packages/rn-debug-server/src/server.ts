import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';

import { createCommandDispatcher, type CommandDispatcher } from './command-dispatcher';
import { createDeviceRegistry } from './device-registry';
import { createEventsBus } from './events-bus';
import type { EventsBus } from './events-bus';
import type { CommandInput, DeviceRegistry, DeviceToServerMessage, ResultMessage } from './types';

export interface DebugServer {
  port: number;
  registry: DeviceRegistry;
  dispatcher: CommandDispatcher;
  eventsBus: EventsBus;
  close(): Promise<void>;
}

async function readJson(req: import('http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export async function createDebugServer(options: { port: number }): Promise<DebugServer> {
  const { port } = options;
  const registry = createDeviceRegistry();
  const eventsBus = createEventsBus();
  const dispatcher = createCommandDispatcher({
    registry,
    onEvent: (event) => eventsBus.publish(event),
  });

  const httpServer: HttpServer = createHttpServer(async (req, res) => {
    const url = req.url ?? '';

    if (req.method === 'GET' && (url === '/' || url.startsWith('/index'))) {
      const html = readFileSync(join(__dirname, 'debug-page.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'GET' && url === '/api/devices') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(registry.list()));
      return;
    }

    const byDevice = url.match(/^\/api\/devices\/([^/]+)\/commands$/);
    if (req.method === 'POST' && byDevice) {
      const deviceId = decodeURIComponent(byDevice[1]);
      if (!registry.get(deviceId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `device not found: ${deviceId}` }));
        return;
      }
      const input = (await readJson(req)) as CommandInput;
      const outcome = await dispatcher.sendCommand(deviceId, input);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(outcome));
      return;
    }

    if (req.method === 'POST' && url === '/api/commands') {
      const devices = registry.list();
      if (devices.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'no device connected' }));
        return;
      }
      if (devices.length > 1) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'multiple devices, specify deviceId', devices: devices.map((d) => d.deviceId) }));
        return;
      }
      const input = (await readJson(req)) as CommandInput;
      const outcome = await dispatcher.sendCommand(devices[0].deviceId, input);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(outcome));
      return;
    }

    const byId = url.match(/^\/api\/commands\/([^/]+)$/);
    if (req.method === 'GET' && byId) {
      const record = dispatcher.getCommand(decodeURIComponent(byId[1]));
      if (!record) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'command not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(record));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (url.startsWith('/device')) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else if (url.startsWith('/events')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        eventsBus.subscribe(ws);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WsSocket) => {
    let registeredId: string | undefined;

    ws.on('message', (raw) => {
      let msg: DeviceToServerMessage;
      try {
        msg = JSON.parse(String(raw)) as DeviceToServerMessage;
      } catch {
        return;
      }
      if (msg.kind === 'register') {
        registeredId = msg.deviceId;
        const connectedAt = Date.now();
        registry.add({ deviceId: msg.deviceId, ws, info: msg.info, connectedAt, lastSeen: connectedAt });
        eventsBus.publish({ kind: 'device', action: 'connected', device: { deviceId: msg.deviceId, ...msg.info, connectedAt, lastSeen: connectedAt } });
      } else if (msg.kind === 'ping') {
        if (registeredId) registry.touch(registeredId);
        ws.send(JSON.stringify({ kind: 'pong' }));
      } else if (msg.kind === 'result') {
        dispatcher.handleResult(msg as ResultMessage);
      } else if (msg.kind === 'event') {
        if (registeredId) {
          eventsBus.publish({ kind: msg.event, deviceId: registeredId, data: msg.data });
        }
      }
    });

    ws.on('close', () => {
      if (registeredId) {
        const info = registry.get(registeredId);
        dispatcher.handleDisconnect(registeredId);
        registry.remove(registeredId);
        if (info) {
          eventsBus.publish({
            kind: 'device',
            action: 'disconnected',
            device: { deviceId: registeredId, ...info.info, connectedAt: info.connectedAt, lastSeen: info.lastSeen },
          });
        }
      }
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(port, resolve));

  return {
    port,
    registry,
    dispatcher,
    eventsBus,
    close() {
      return new Promise<void>((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        httpServer.close(() => resolve());
      });
    },
  };
}
