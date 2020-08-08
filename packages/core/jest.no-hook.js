module.exports = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['./scripts/testSetup.js'],
  testRegex: '\\.no-hook\\.test\\.jsx?$',
  collectCoverage: true,
  coverageReporters: ['text'],
  collectCoverageFrom: ['src/**/*.{js,jsx}'],
  coverageDirectory: 'coverage',
};
