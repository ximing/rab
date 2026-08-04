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
      target: ['chrome60', 'safari12'],
      format: 'esm',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: { 'process.env.NODE_ENV': '"production"' },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
      metafile: true,
    });
    console.log('✓ ESM format built');

    console.log('Building CJS format...');
    await esbuild.build({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.cjs',
      bundle: true,
      minify: shouldMinify,
      sourcemap: true,
      target: ['chrome60', 'safari12'],
      format: 'cjs',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: { 'process.env.NODE_ENV': '"production"' },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
      metafile: true,
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
      target: ['chrome60', 'safari12'],
      format: 'esm',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: { 'process.env.NODE_ENV': '"development"' },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
      plugins: [
        {
          name: 'tsc-types',
          setup(build) {
            build.onEnd(result => {
              if (result.errors.length === 0) {
                try {
                  execSync(
                    'tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck',
                    { stdio: 'pipe' }
                  );
                  console.log('✓ Types generated');
                } catch {
                  console.error('✗ Types generation failed');
                }
              }
            });
          },
        },
      ],
    });

    const libCjsCtx = await esbuild.context({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.cjs',
      bundle: true,
      minify: false,
      sourcemap: true,
      target: ['chrome60', 'safari12'],
      format: 'cjs',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: { 'process.env.NODE_ENV': '"development"' },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
    });

    await Promise.all([libEsmCtx.watch(), libCjsCtx.watch()]);
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
    .then(() => console.log('\n✅ Build completed successfully!'))
    .catch(() => process.exit(1));
}
