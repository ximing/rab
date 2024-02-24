const rspack = require('@rspack/core');
const path = require('path');
const refreshPlugin = require('@rspack/plugin-react-refresh');
const isDev = process.env.NODE_ENV === 'development';
/**
 * @type {import('@rspack/cli').Configuration}
 */
module.exports = {
  mode: !isDev ? 'production' : 'development',
  context: __dirname,
  entry: {
    main: './src/main.tsx',
  },
  output: {
    clean: true,
    filename: '[name].[contenthash].js',
  },
  resolve: {
    extensions: ['...', '.ts', '.tsx', '.jsx'],
    tsConfigPath: path.resolve(__dirname, 'tsconfig.json'),
  },
  module: {
    rules: [
      {
        test: /\.svg$/,
        type: 'asset',
      },
      {
        test: /\.(jsx?|tsx?)$/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              sourceMap: true,
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                  decorators: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: isDev,
                    refresh: isDev,
                  },
                  legacyDecorator: true,
                  decoratorMetadata: true,
                },
              },
              env: {
                targets: ['chrome >= 87', 'edge >= 88', 'firefox >= 78', 'safari >= 14'],
              },
              rspackExperiments: {
                emotion: {},
                react: {
                  importSource: '@emotion/react',
                },
              },
            },
          },
        ],
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: 'less-loader',
          },
        ],
        type: 'css',
      },
    ],
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
    new rspack.ProgressPlugin({}),
    new rspack.HtmlRspackPlugin({
      template: './index.html',
      title: 'rabjs example',
    }),
    isDev ? new refreshPlugin() : null,
  ].filter(Boolean),
  devServer: {
    port: 9876,
    historyApiFallback: true,
  },
  optimization: {
    minimize: false,
  },
};
