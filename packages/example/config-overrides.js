const path = require('path');
const {
  override,
  disableEsLint,
  overrideDevServer,
  addDecoratorsLegacy,
  removeModuleScopePlugin,
  babelInclude,
  addWebpackAlias,
} = require('customize-cra');

module.exports = {
  webpack: override(
    disableEsLint(),
    addDecoratorsLegacy(),
    removeModuleScopePlugin(),
    babelInclude([path.resolve('src'), path.resolve(__dirname, '../src')]),
    addWebpackAlias({
      '@library': path.resolve(__dirname, '../src/'),
    })
  ),
  devServer: overrideDevServer((config) => {
    return config;
  }),
};
