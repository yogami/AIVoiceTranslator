/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@client/(.*)$': '<rootDir>/client/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'server/**/*.ts',
    'client/src/lib/**/*.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/tests/**',
  ],
  coverageDirectory: 'coverage',
};