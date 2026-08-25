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
    await new Promise(r => setTimeout(r, 20));
  }
  const extra = lastError instanceof Error ? ` (last error: ${lastError.message})` : '';
  throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms${extra}`);
}
