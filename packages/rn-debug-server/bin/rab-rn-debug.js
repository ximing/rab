#!/usr/bin/env node
import('../lib/cli.js').catch((err) => {
  console.error('rab-rn-debug: 启动失败（请先执行 pnpm build 构建产物）:', err);
  process.exit(1);
});
