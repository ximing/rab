const { defaults: tsjPreset } = require('ts-jest/presets');

module.exports = {
  ...tsjPreset,
  preset: 'react-native',
  testRegex: '\\.test\\.native\\.jsx?$',
  transform: {
    '^.+\\.(js|jsx)$': 'react-native/jest/preprocessor.js',
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', 'examples/native-clock/App.js'],
  coverageDirectory: 'coverage',
};
