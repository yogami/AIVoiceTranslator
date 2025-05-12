/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      isolatedModules: true 
    }]
  },
  setupFiles: ['<rootDir>/jest.setup.ts'], // Reference the setup file
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: false,
  automock: false,
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1' // Handle .js imports without extension
  },
  testTimeout: 10000,
  verbose: true,
  testPathIgnorePatterns: []
};