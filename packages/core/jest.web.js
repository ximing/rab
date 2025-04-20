module.exports = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['./scripts/testSetup.js'],
  testRegex: '\\.test\\.tsx?$',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['lcov', 'text'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: 'coverage',
  // moduleNameMapper: {
  //   'react-platform': 'react-dom',
  // },
};
