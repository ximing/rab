/**
 * ESLint 9 Flat Config
 * 根目录配置文件
 */
import customConfig from 'eslint-config-custom';

export default [
  // 继承自定义配置
  ...customConfig,

  // 项目级别的忽略配置（从 .eslintignore 迁移）
  {
    ignores: [
      'deprecated/**',
      'dist/**',
      'lib/**',
      'rsjs/**',
      '**/example/**',
      '**/jiemo/**',
      '**/.ob/**',
      '**/templates/**',
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'templates/**',
    ],
  },

  // 项目特定配置
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      // 可以在这里覆盖或添加项目特定规则
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 针对 o-builder 目录下的 TypeScript 文件
  {
    files: ['o-builder/**/*.ts', 'o-builder/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['o-builder/*/tsconfig.json'],
      },
    },
  },

  // 针对 .cjs 文件和 scripts 目录下的 Node.js 脚本
  {
    files: ['**/*.cjs', 'scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      // 禁用 TypeScript ESLint 中不适用于 CommonJS 的规则
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-commonjs': 'off',
      // 允许 require 和 module.exports
      'unicorn/prefer-module': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // 针对 .mjs 文件的 ES 模块配置
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
];
