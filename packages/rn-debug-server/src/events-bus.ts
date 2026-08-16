import type { WebSocket as WsSocket } from 'ws';

export interface EventsBus {
  subscribe(ws: WsSocket): void;
  publish(event: Record<string, unknown>): void;
}

export function createEventsBus(): EventsBus {
  const subscribers = new Set<WsSocket>();

  return {
    subscribe(ws) {
      subscribers.add(ws);
      ws.on('close', () => subscribers.delete(ws));
    },
    publish(event) {
      const data = JSON.stringify(event);
      for (const ws of subscribers) {
        if (ws.readyState === 1) ws.send(data);
      }
    },
  };
}
