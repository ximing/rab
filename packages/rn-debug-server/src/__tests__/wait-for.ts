import WebSocket from 'ws';

/** Native fetch keep-alive reuses sockets after httpServer.close(), causing ECONNRESET. */
export function httpFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, keepalive: false });
}

/** Poll until `condition` is truthy. Avoids fixed sleeps that flake under turbo parallelism. */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = 5000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await condition()) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  const extra = lastError instanceof Error ? ` (last error: ${lastError.message})` : '';
  throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms${extra}`);
}

export function messageKind(raw: string): string | undefined {
  try {
    return (JSON.parse(raw) as { kind?: string }).kind;
  } catch {
    return undefined;
  }
}

export async function waitForDevice(port: number, deviceId: string): Promise<void> {
  await waitFor(async () => {
    const res = await httpFetch(`http://127.0.0.1:${port}/api/devices`);
    if (!res.ok) return false;
    const devices = (await res.json()) as Array<{ deviceId: string }>;
    return devices.some((d) => d.deviceId === deviceId);
  }, `device ${deviceId} registered on :${port}`);
}

export async function closeWs(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) return;
  await new Promise<void>((resolve) => {
    ws.once('close', () => resolve());
    if (ws.readyState === WebSocket.CLOSING) return;
    ws.close();
  });
}

export async function waitUntilDeviceGone(port: number, deviceId: string): Promise<void> {
  await waitFor(async () => {
    const res = await httpFetch(`http://127.0.0.1:${port}/api/devices`);
    if (!res.ok) return false;
    const devices = (await res.json()) as Array<{ deviceId: string }>;
    return !devices.some((d) => d.deviceId === deviceId);
  }, `device ${deviceId} removed from :${port}`);
}
