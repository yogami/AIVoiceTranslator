/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      // Handle "__filename has already been declared" errors
      isolatedModules: true 
    }]
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: false,
  automock: false,
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1'
  },
  testTimeout: 10000,
  verbose: true,
  // Allow tests to be found in the utils folder
  testPathIgnorePatterns: []
};