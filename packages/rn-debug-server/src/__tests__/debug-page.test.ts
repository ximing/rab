import { createDebugServer } from '../server';

describe('debug page', () => {
  it('GET / 返回 HTML 且包含关键面板', async () => {
    const server = await createDebugServer({ port: 9234 });
    try {
      const res = await fetch('http://127.0.0.1:9234/');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('id="devices"');
      expect(html).toContain('id="command-form"');
      expect(html).toContain('id="timeline"');
      expect(html).toContain('id="logs"');
    } finally {
      await server.close();
    }
  });
});
