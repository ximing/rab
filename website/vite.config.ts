import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// 部署说明：
// - GitHub Pages 从 gh-pages 分支根目录部署，站点挂在 https://ximing.github.io/rab/
// - 因此 base 必须是 '/rab/'（与旧 docusaurus.config.ts 的 baseUrl 一致）
// - 路由使用 HashRouter（见 src/App.tsx），刷新深层页面不会 404
export default defineConfig({
  base: '/rab/',
  plugins: [react(), tailwindcss()],
  resolve: {
    // @rabjs/react 的 peer react 会被 pnpm 自动安装一份 react@18 到
    // packages/react/node_modules，与网站的 react@19 并存。
    // dedupe 强制全站（含 packages/react/src 内部）都解析到网站的 react 副本，
    // 否则 hooks / context 会因双 React 实例而失效。
    dedupe: ['react', 'react-dom'],
    // 直接 alias 到 monorepo 源码，站点不依赖 packages/*/lib 构建产物。
    // 注意：包内部互相 import @rabjs/* 时也会命中这些 alias，
    // 从而保证整个依赖图都用同一份源码（与 tsconfig.json 的 paths 保持一致）。
    alias: {
      '@rabjs/service': r('../packages/service/src/main.ts'),
      '@rabjs/observer': r('../packages/observer/src/main.ts'),
      '@rabjs/react': r('../packages/react/src/main.ts'),
      '@rabjs/devtools': r('../packages/devtools/src/main.ts'),
      '@rabjs/web-mcp': r('../packages/web-mcp/src/main.ts'),
      '@rabjs/shared': r('../packages/shared/src/main.ts'),
    },
  },
});
