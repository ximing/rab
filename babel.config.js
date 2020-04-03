module.exports = {
  presets: [['@babel/env', { targets: { node: 'current' } }], '@babel/typescript'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-syntax-optional-chaining',
    '@babel/plugin-proposal-do-expressions',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-class-properties'
  ]
};
