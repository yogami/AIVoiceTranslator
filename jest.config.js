/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: false,
  automock: false,
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 20000,
  verbose: true,
  // Ignore pre-compilation errors
  transformIgnorePatterns: [],
};