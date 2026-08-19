export default {
  testTimeout: 20000,
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { esModuleInterop: true, allowSyntheticDefaultImports: true } },
    ],
  },
};
