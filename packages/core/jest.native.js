const { defaults: tsjPreset } = require('ts-jest/presets');
module.exports = {
  ...tsjPreset,
  preset: 'react-native',
  testRegex: '\\.test\\.native\\.jsx?$',
  transform: {
    '^.+\\.(js|jsx)$': 'react-native/jest/preprocessor.js',
  },
  collectCoverage: true,
  coverageReporters: ['text'],
  collectCoverageFrom: ['src/**/*.{js,jsx}', 'examples/native-clock/App.js'],
  coverageDirectory: 'coverage',
};
