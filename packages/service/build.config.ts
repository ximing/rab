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
    console.log('Building ESM format...');
    const esmResult = await esbuild.build({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.js',
      bundle: true,
      minify: shouldMinify,
      sourcemap: true,
      target: ['chrome60', 'safari12'],
      format: 'esm',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
      metafile: true,
    });

    if (esmResult.errors.length > 0) {
      console.error('ESM build errors:');
      esmResult.errors.forEach(error => {
        console.error(`  ${error.text}`);
        if (error.location) {
          console.error(
            `    at ${error.location.file}:${error.location.line}:${error.location.column}`
          );
          if (error.location.lineText) {
            console.error(`    ${error.location.lineText}`);
          }
        }
        if (error.notes && error.notes.length > 0) {
          error.notes.forEach(note => {
            console.error(`    Note: ${note.text}`);
          });
        }
      });
    }

    if (esmResult.warnings.length > 0) {
      console.warn('ESM build warnings:');
      esmResult.warnings.forEach(warning => {
        console.warn(`  ${warning.text}`);
        if (warning.location) {
          console.warn(
            `    at ${warning.location.file}:${warning.location.line}:${warning.location.column}`
          );
        }
      });
    }

    console.log('✓ ESM format built');

    // 构建 CJS 格式
    console.log('Building CJS format...');
    const cjsResult = await esbuild.build({
      entryPoints: ['src/main.ts'],
      outfile: 'lib/main.cjs',
      bundle: true,
      minify: shouldMinify,
      sourcemap: true,
      target: ['chrome60', 'safari12'],
      format: 'cjs',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
      metafile: true,
    });

    if (cjsResult.errors.length > 0) {
      console.error('CJS build errors:');
      cjsResult.errors.forEach(error => {
        console.error(`  ${error.text}`);
        if (error.location) {
          console.error(
            `    at ${error.location.file}:${error.location.line}:${error.location.column}`
          );
          if (error.location.lineText) {
            console.error(`    ${error.location.lineText}`);
          }
        }
        if (error.notes && error.notes.length > 0) {
          error.notes.forEach(note => {
            console.error(`    Note: ${note.text}`);
          });
        }
      });
    }

    if (cjsResult.warnings.length > 0) {
      console.warn('CJS build warnings:');
      cjsResult.warnings.forEach(warning => {
        console.warn(`  ${warning.text}`);
        if (warning.location) {
          console.warn(
            `    at ${warning.location.file}:${warning.location.line}:${warning.location.column}`
          );
        }
      });
    }

    console.log('✓ CJS format built');

    // 使用 tsc 生成类型声明文件
    console.log('Generating type declarations...');
    try {
      execSync('tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck', {
        stdio: 'inherit',
      });
      console.log('✓ Type declarations generated');
    } catch (tscError) {
      console.error('✗ TypeScript declaration generation failed:');
      console.error(tscError);
      throw tscError;
    }

    console.log('✓ Library built: lib/ (ESM + CJS)');
  } catch (error) {
    console.error('✗ Library build failed:');
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack trace:\n${error.stack}`);
      }
    } else {
      console.error(error);
    }
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
      target: ['chrome60', 'safari12'],
      format: 'esm',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: {
        'process.env.NODE_ENV': '"development"',
      },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
      plugins: [
        {
          name: 'tsc-types',
          setup(build) {
            build.onEnd(result => {
              // 输出构建错误和警告
              if (result.errors.length > 0) {
                console.error('ESM build errors:');
                result.errors.forEach(error => {
                  console.error(`  ${error.text}`);
                  if (error.location) {
                    console.error(
                      `    at ${error.location.file}:${error.location.line}:${error.location.column}`
                    );
                    if (error.location.lineText) {
                      console.error(`    ${error.location.lineText}`);
                    }
                  }
                  if (error.notes && error.notes.length > 0) {
                    error.notes.forEach(note => {
                      console.error(`    Note: ${note.text}`);
                    });
                  }
                });
              }

              if (result.warnings.length > 0) {
                console.warn('ESM build warnings:');
                result.warnings.forEach(warning => {
                  console.warn(`  ${warning.text}`);
                  if (warning.location) {
                    console.warn(
                      `    at ${warning.location.file}:${warning.location.line}:${warning.location.column}`
                    );
                  }
                });
              }

              // 每次构建后生成类型声明文件
              if (result.errors.length === 0) {
                try {
                  execSync(
                    'tsc --project tsconfig.json --emitDeclarationOnly --outDir lib --skipLibCheck',
                    {
                      stdio: 'pipe',
                    }
                  );
                  console.log('✓ Types generated');
                } catch (error) {
                  console.error('✗ Types generation failed:');
                  if (error instanceof Error) {
                    console.error(`  ${error.message}`);
                    // @ts-ignore
                    if (error.stdout) {
                      // @ts-ignore
                      console.error(`  stdout: ${error.stdout.toString()}`);
                    }
                    // @ts-ignore
                    if (error.stderr) {
                      // @ts-ignore
                      console.error(`  stderr: ${error.stderr.toString()}`);
                    }
                  }
                }
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
      target: ['chrome60', 'safari12'],
      format: 'cjs',
      platform: 'browser',
      external: ['@rabjs/*'],
      define: {
        'process.env.NODE_ENV': '"development"',
      },
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'info',
      plugins: [
        {
          name: 'error-logger',
          setup(build) {
            build.onEnd(result => {
              if (result.errors.length > 0) {
                console.error('CJS build errors:');
                result.errors.forEach(error => {
                  console.error(`  ${error.text}`);
                  if (error.location) {
                    console.error(
                      `    at ${error.location.file}:${error.location.line}:${error.location.column}`
                    );
                    if (error.location.lineText) {
                      console.error(`    ${error.location.lineText}`);
                    }
                  }
                  if (error.notes && error.notes.length > 0) {
                    error.notes.forEach(note => {
                      console.error(`    Note: ${note.text}`);
                    });
                  }
                });
              }

              if (result.warnings.length > 0) {
                console.warn('CJS build warnings:');
                result.warnings.forEach(warning => {
                  console.warn(`  ${warning.text}`);
                  if (warning.location) {
                    console.warn(
                      `    at ${warning.location.file}:${warning.location.line}:${warning.location.column}`
                    );
                  }
                });
              }
            });
          },
        },
      ],
    });

    await Promise.all([libEsmCtx.watch(), libCjsCtx.watch()]);
    console.log('✓ Watching (build/tracer.js) and Library (lib/main.js + lib/main.cjs)...');
  } catch (error) {
    console.error('✗ Watch mode failed:');
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack trace:\n${error.stack}`);
      }
    } else {
      console.error(error);
    }
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
