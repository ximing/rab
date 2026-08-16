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

  it('页面所有 innerHTML 插值经 escapeHtml 转义（XSS 回归）', async () => {
    const server = await createDebugServer({ port: 9234 });
    try {
      const res = await fetch('http://127.0.0.1:9234/');
      const html = await res.text();

      // 存在转义函数，且覆盖 & < > " ' 五类字符
      expect(html).toContain('function escapeHtml');
      expect(html).toContain("'&': '&amp;'");
      expect(html).toContain("'<': '&lt;'");
      expect(html).toContain("'>': '&gt;'");
      expect(html).toContain(`'"': '&quot;'`);
      expect(html).toContain(`"'": '&#39;'`);
    } finally {
      await server.close();
    }
  });

  it('renderDevices/renderCommand 的设备控制字符串与 JSON.stringify 输出均经 escapeHtml', async () => {
    const server = await createDebugServer({ port: 9234 });
    try {
      const res = await fetch('http://127.0.0.1:9234/');
      const html = await res.text();
      const script = html.slice(html.indexOf('<script>'));

      // renderDevices：deviceId/appName/platform/osVersion/option 均经转义
      expect(script).toContain('${escapeHtml(d.deviceId)}');
      expect(script).toContain('${escapeHtml(d.appName ?? \'\')}');
      expect(script).toContain('${escapeHtml(d.platform ?? \'\')}');
      expect(script).toContain('${escapeHtml(d.osVersion ?? \'\')}');
      expect(script).toContain('<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>');

      // renderCommand：status/deviceId/type/时长与 payload/result/error 的 JSON.stringify 输出均经转义
      expect(script).toContain('${escapeHtml(cmd.status)}');
      expect(script).toContain('${escapeHtml(cmd.deviceId)}');
      expect(script).toContain('${escapeHtml(cmd.type)}');
      expect(script).toContain('payload: ${escapeHtml(JSON.stringify(cmd.payload ?? {}, null, 2))}');
      expect(script).toContain('${escapeHtml(cmd.status === \'pending\' ? \'\' : JSON.stringify(cmd.result ?? cmd.error ?? \'\', null, 2))}');

      // 不允许任何未转义的原始插值残留在 renderDevices/renderCommand 的 innerHTML 模板里
      const renderFns = script.slice(script.indexOf('function renderDevices'), script.indexOf('function renderLog'));
      for (const raw of ['${d.deviceId}', '${d.appName', '${cmd.status}', '${cmd.deviceId}', '${cmd.type}', '${JSON.stringify(']) {
        expect(renderFns).not.toContain(raw);
      }

      // 查找旧行改用 dataset 比较，不再把 cmd.id 拼进属性选择器
      expect(renderFns).not.toContain('querySelector(`#timeline');
    } finally {
      await server.close();
    }
  });
});
