/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@assets/(.*)$': '<rootDir>/attached_assets/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  testMatch: [
    '**/__tests__/**/*.spec.[jt]s?(x)',
    '**/__tests__/**/*.test.[jt]s?(x)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.replit/'],
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'server/**/*.ts',
    'shared/**/*.ts',
    '!**/node_modules/**',
  ],
  // Set a timeout of 10 seconds max per test
  testTimeout: 10000,
  // Different test environments for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/__tests__/unit/**/*.test.[jt]s?(x)'],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'component',
      testMatch: ['**/__tests__/component/**/*.test.[jt]s?(x)'],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'integration',
      testMatch: ['**/__tests__/integration/**/*.test.[jt]s?(x)'],
      testEnvironment: 'node',
    },
    {
      displayName: 'functional',
      testMatch: ['**/__tests__/functional/**/*.test.[jt]s?(x)'],
      testEnvironment: 'node',
    },
  ],
};