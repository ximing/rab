import { networkInterfaces } from 'os';

import { createDebugServer } from './server';

function localIPs(): string[] {
  const ips: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

async function main() {
  const idx = process.argv.indexOf('--port');
  const port = idx !== -1 ? Number(process.argv[idx + 1]) : 9229;
  const portNumber = Number.isFinite(port) && port > 0 ? port : 9229;

  const server = await createDebugServer({ port: portNumber });
  const ips = localIPs();
  console.log(`rab-rn-debug server listening on port ${server.port}`);
  console.log(`调试页面: http://localhost:${server.port}/`);
  if (ips.length > 0) {
    console.log(`RN App 接入地址（setupRNDebug 的 host）:`);
    for (const ip of ips) console.log(`  ${ip}:${server.port}`);
  }
  console.log('Ctrl-C 退出');

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
