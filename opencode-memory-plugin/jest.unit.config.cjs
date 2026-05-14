// Unit tests — parallel execution, excludes integration/e2e to avoid backend contention
module.exports = {
  displayName: 'unit',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-unit.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['integration', 'e2e', '[/\\\\]cli[/\\\\]', 'performance'],
  testTimeout: 30000,
};
