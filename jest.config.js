export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server', '<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json', // Use a specific tsconfig for tests
    }],
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  // Important: Do not auto-mock anything
  automock: false,
  // Clear all mocks between tests
  clearMocks: true,
  // Important: Enable sourcemaps for proper stack traces
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1' // Path alias for cleaner imports
  }
};