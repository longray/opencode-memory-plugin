// Integration/E2E tests — serial execution (maxWorkers: 1) to prevent backend contention
module.exports = {
  displayName: 'integration',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-integration.js'],
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/e2e/**/*.test.js',
    '<rootDir>/tests/*integration.test.js',
    '<rootDir>/tests/*e2e.test.js',
  ],
  maxWorkers: 1,
  testTimeout: 60000,
};
