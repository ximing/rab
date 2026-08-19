/**
 * esbuild 构建配置 - 用于构建
 * 支持 Chrome >= 60 & Safari >= 12
 */
import { execSync } from 'child_process';
import * as fs from 'fs';

import * as esbuild from 'esbuild';

/**
 * 是否压缩代码，通过环境变量 MINIFY 控制，默认不压缩
 */
const shouldMinify = process.env.MINIFY === 'true';

/**
 * 构建 npm 包 (使用 esbuild)
 */
async function buildLibrary() {
  try {
    // 构建 ESM 格式
    await esbuild.build({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.js',
      bundle: true,
      minify: shouldMinify,
      sourcemap: true,
      target: ['es2020'],
      format: 'esm',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      legalComments: 'none',
      charset: 'utf8',
    });

    // 构建 CJS 格式
    await esbuild.build({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.cjs',
      bundle: true,
      minify: shouldMinify,
      sourcemap: true,
      target: ['es2020'],
      format: 'cjs',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      legalComments: 'none',
      charset: 'utf8',
    });

    // 使用 tsc 生成类型声明文件
    execSync('tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck', {
      stdio: 'inherit',
    });

    console.log('✓ Library built: lib/ (ESM + CJS)');
  } catch (error) {
    console.error('✗ Library build failed:', error);
    process.exit(1);
  }
}

/**
 * 开发模式 - 监听文件变化并重新构建
 */
async function dev() {
  console.log('👀 Watching files...\n');

  try {
    // 监听 Library ESM
    const libEsmCtx = await esbuild.context({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.js',
      bundle: true,
      minify: false,
      sourcemap: true,
      target: ['es2020'],
      format: 'esm',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: {
        'process.env.NODE_ENV': '"development"',
      },
      legalComments: 'none',
      charset: 'utf8',
      plugins: [
        {
          name: 'tsc-types',
          setup(build) {
            build.onEnd(() => {
              // 每次构建后生成类型声明文件
              try {
                execSync(
                  'tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck',
                  {
                    stdio: 'pipe',
                  }
                );
                console.log('✓ Types generated');
              } catch (error) {
                console.error('✗ Types generation failed');
              }
            });
          },
        },
      ],
    });

    // 监听 Library CJS
    const libCjsCtx = await esbuild.context({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.cjs',
      bundle: true,
      minify: false,
      sourcemap: true,
      target: ['es2020'],
      format: 'cjs',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: {
        'process.env.NODE_ENV': '"development"',
      },
      legalComments: 'none',
      charset: 'utf8',
    });

    await Promise.all([libEsmCtx.watch(), libCjsCtx.watch()]);
    console.log('✓ Watching (build/tracer.js) and Library (lib/main.js + lib/main.cjs)...');
  } catch (error) {
    console.error('✗ Watch mode failed:', error);
    process.exit(1);
  }
}

/**
 * 主构建流程
 */
async function build() {
  console.log('🔨 Building...\n');

  await buildLibrary();

  console.log('\n✅ Build completed successfully!');
}

// 根据命令行参数决定执行 build 或 dev
const mode = process.argv[2];
if (mode === '--watch' || mode === '-w') {
  dev().catch(() => process.exit(1));
} else {
  build().catch(() => process.exit(1));
}
