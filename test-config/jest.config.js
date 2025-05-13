/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  // Define root directory for tests as project root
  rootDir: '..',
  roots: ['<rootDir>/tests'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      isolatedModules: true 
    }]
  },
  setupFiles: ['<rootDir>/test-config/jest.setup.ts'],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: false,
  automock: false,
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1', // Handle .js imports without extension
    // Map the url module to a mock implementation for resolving import.meta.url issues
    'url': '<rootDir>/test-config/mocks/url.mock.ts'
  },
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  testTimeout: 10000,
  verbose: true,
  testPathIgnorePatterns: []
};