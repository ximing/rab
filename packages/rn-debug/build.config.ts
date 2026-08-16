import { execSync } from 'child_process';

import * as esbuild from 'esbuild';

const shouldMinify = process.env.MINIFY === 'true';
const version = JSON.parse(execSync('cat package.json', { encoding: 'utf8' })).version;

async function buildLibrary() {
  const common = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    minify: shouldMinify,
    sourcemap: true,
    target: ['es2020'],
    platform: 'neutral' as const, // RN 不依赖 node API
    external: ['@rabjs/*', 'react-native'],
    define: {
      'process.env.NODE_ENV': '"production"',
      RAB_RN_DEBUG_VERSION: JSON.stringify(version),
    },
    legalComments: 'none' as const,
    charset: 'utf8' as const,
    logLevel: 'info' as const,
  };
  await esbuild.build({ ...common, outfile: 'lib/main.js', format: 'esm' });
  console.log('✓ ESM built');
  await esbuild.build({ ...common, outfile: 'lib/main.cjs', format: 'cjs' });
  console.log('✓ CJS built');
  execSync('tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck', {
    stdio: 'inherit',
  });
  console.log('✓ Types generated');
}

buildLibrary()
  .then(() => console.log('\n✅ Build completed'))
  .catch(() => process.exit(1));
