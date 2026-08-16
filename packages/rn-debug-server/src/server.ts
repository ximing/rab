import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';

import { createDeviceRegistry } from './device-registry';
import type { DeviceRegistry, DeviceToServerMessage } from './types';

export interface DebugServer {
  port: number;
  registry: DeviceRegistry;
  close(): Promise<void>;
}

export async function createDebugServer(options: { port: number }): Promise<DebugServer> {
  const { port } = options;
  const registry = createDeviceRegistry();

  const httpServer: HttpServer = createHttpServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/devices') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(registry.list()));
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
        registry.add({
          deviceId: msg.deviceId,
          ws,
          info: msg.info,
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      } else if (msg.kind === 'ping') {
        if (registeredId) registry.touch(registeredId);
        ws.send(JSON.stringify({ kind: 'pong' }));
      }
      // result / event 在 Task 2/4 处理
    });

    ws.on('close', () => {
      if (registeredId) registry.remove(registeredId);
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(port, resolve));

  return {
    port,
    registry,
    close() {
      return new Promise<void>((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        httpServer.close(() => resolve());
      });
    },
  };
}
