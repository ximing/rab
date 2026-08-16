import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

import * as esbuild from 'esbuild';

const shouldMinify = process.env.MINIFY === 'true';

// 构建前生成 src/debug-page-content.ts（内联调试页面 HTML，避免 ESM 产物中 __dirname 不可用）
writeFileSync(
  'src/debug-page-content.ts',
  `export const DEBUG_PAGE_HTML = ${JSON.stringify(readFileSync('src/debug-page.html', 'utf8'))};\n`
);

async function buildLibrary() {
  const common = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    minify: shouldMinify,
    sourcemap: true,
    target: ['node18'],
    platform: 'node' as const,
    external: ['@rabjs/*', 'ws'],
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none' as const,
    charset: 'utf8' as const,
    logLevel: 'info' as const,
  };
  await esbuild.build({ ...common, outfile: 'lib/main.js', format: 'esm' });
  console.log('✓ ESM built');
  await esbuild.build({ ...common, outfile: 'lib/main.cjs', format: 'cjs' });
  console.log('✓ CJS built');

  // CLI 入口单独构建（不进 main bundle）
  await esbuild.build({
    entryPoints: ['src/cli.ts'],
    outfile: 'lib/cli.js',
    bundle: true,
    platform: 'node',
    target: ['node18'],
    format: 'esm',
    external: ['@rabjs/*', 'ws'],
    sourcemap: true,
    logLevel: 'info',
  });
  console.log('✓ CLI built');

  // 调试页面原样复制到 lib/
  await esbuild.build({
    entryPoints: ['src/debug-page.html'],
    outfile: 'lib/debug-page.html',
    loader: { '.html': 'copy' },
    logLevel: 'info',
  });
  console.log('✓ debug page copied');

  execSync('tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck', {
    stdio: 'inherit',
  });
  console.log('✓ Types generated');
}

buildLibrary()
  .then(() => console.log('\n✅ Build completed'))
  .catch(() => process.exit(1));
