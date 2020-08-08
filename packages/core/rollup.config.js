const path = require('path');
const replacePlugin = require('rollup-plugin-replace');
const resolvePlugin = require('@rollup/plugin-node-resolve');
const typescript = require('rollup-plugin-typescript2');
const externalsPlugin = require('rollup-plugin-auto-external');

// this is also used in watch mode by the startExample script
const defaultBuild = [
  {
    input: path.resolve('src/react/platforms/dom.ts'),
    external: ['react-dom'],
    output: [
      {
        format: 'es',
        dir: 'dist/react',
        entryFileNames: 'react-platform.js',
      },
      {
        format: 'cjs',
        dir: 'dist/react',
        entryFileNames: 'react-platform.cjs.js',
      },
    ],
  },
  {
    input: path.resolve('src/index.ts'),
    external: ['./react-platform'],
    plugins: [
      replacePlugin({ 'react-platform': './react-platform' }),
      resolvePlugin(),
      typescript({
        tsconfig: 'tsconfig.build.json',
        clean: true,
      }),
      externalsPlugin({ dependencies: true, peerDependecies: true }),
    ],
    output: {
      format: 'es',
      dir: 'dist',
      entryFileNames: 'es.es6.js',
      sourcemap: true,
    },
  },
];

const allBuilds = [
  ...defaultBuild,
  {
    input: path.resolve('src/react/platforms/native.ts'),
    external: ['react-native'],
    output: [
      {
        format: 'es',
        dir: 'dist/react',
        entryFileNames: 'react-platform.native.js',
      },
      {
        format: 'cjs',
        dir: 'dist/react',
        entryFileNames: 'react-platform.cjs.native.js',
      },
    ],
  },
  {
    input: path.resolve('src/index.ts'),
    external: ['./react-platform'],
    plugins: [
      replacePlugin({ 'react-platform': './react-platform' }),
      resolvePlugin(),
      typescript({
        tsconfig: 'tsconfig.build.json',
        clean: true,
      }),
      externalsPlugin({ dependencies: true, peerDependecies: true }),
    ],
    output: {
      format: 'es',
      dir: 'dist',
      entryFileNames: 'es.es5.js',
      sourcemap: true,
    },
  },
  {
    input: path.resolve('src/index.ts'),
    external: ['./react-platform.cjs'],
    plugins: [
      replacePlugin({ 'react-platform': './react-platform.cjs' }),
      resolvePlugin(),
      typescript({
        tsconfig: 'tsconfig.build.json',
        clean: true,
      }),
      externalsPlugin({ dependencies: true, peerDependecies: true }),
    ],
    output: {
      format: 'cjs',
      dir: 'dist',
      entryFileNames: 'cjs.es6.js',
      sourcemap: true,
    },
  },
  {
    input: path.resolve('src/index.ts'),
    external: ['./react-platform.cjs'],
    plugins: [
      replacePlugin({ 'react-platform': './react-platform.cjs' }),
      resolvePlugin(),
      typescript({
        tsconfig: 'tsconfig.build.json',
        clean: true,
      }),
      externalsPlugin({ dependencies: true, peerDependecies: true }),
    ],
    output: {
      format: 'cjs',
      dir: 'dist',
      entryFileNames: 'cjs.es5.js',
      sourcemap: true,
    },
  },
];

export default allBuilds;
