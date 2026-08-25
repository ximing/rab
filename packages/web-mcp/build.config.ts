import { execSync } from 'child_process';

import * as esbuild from 'esbuild';

const shouldMinify = process.env.MINIFY === 'true';

async function buildLibrary() {
  try {
    console.log('Building ESM format...');
    await esbuild.build({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.js',
      bundle: true,
      minify: shouldMinify,
      sourcemap: true,
      target: ['es2020'],
      format: 'esm',
      platform: 'browser',
      external: ['@rabjs/*', 'zod', 'zod-to-json-schema'],
      define: { 'process.env.NODE_ENV': '"production"' },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
    });
    console.log('✓ ESM format built');

    console.log('Building CJS format...');
    await esbuild.build({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.cjs',
      bundle: true,
      minify: shouldMinify,
      sourcemap: true,
      target: ['es2020'],
      format: 'cjs',
      platform: 'browser',
      external: ['@rabjs/*', 'zod', 'zod-to-json-schema'],
      define: { 'process.env.NODE_ENV': '"production"' },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
    });
    console.log('✓ CJS format built');

    console.log('Generating type declarations...');
    execSync('tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck', {
      stdio: 'inherit',
    });
    console.log('✓ Type declarations generated');

    console.log('✓ Library built: lib/ (ESM + CJS)');
  } catch (error) {
    console.error('✗ Library build failed:', error);
    process.exit(1);
  }
}

async function dev() {
  console.log('👀 Watching files...\n');
  try {
    const libEsmCtx = await esbuild.context({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.js',
      bundle: true,
      minify: false,
      sourcemap: true,
      target: ['es2020'],
      format: 'esm',
      platform: 'browser',
      external: ['@rabjs/*', 'zod', 'zod-to-json-schema'],
      define: { 'process.env.NODE_ENV': '"development"' },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
    });
    const libCjsCtx = await esbuild.context({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.cjs',
      bundle: true,
      minify: false,
      sourcemap: true,
      target: ['es2020'],
      format: 'cjs',
      platform: 'browser',
      external: ['@rabjs/*', 'zod', 'zod-to-json-schema'],
      define: { 'process.env.NODE_ENV': '"development"' },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
    });
    await Promise.all([libEsmCtx.watch(), libCjsCtx.watch()]);
    console.log('✓ Watching...');
  } catch (error) {
    console.error('✗ Watch mode failed:', error);
    process.exit(1);
  }
}

const mode = process.argv[2];
if (mode === '--watch' || mode === '-w') {
  dev().catch(() => process.exit(1));
} else {
  buildLibrary()
    .then(() => console.log('\n✅ Build completed!'))
    .catch(() => process.exit(1));
}
