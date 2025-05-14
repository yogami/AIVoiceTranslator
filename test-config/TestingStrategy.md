# AIVoiceTranslator Testing Strategy

## Core Testing Principles

1. **DO NOT modify source code** - All tests are designed to work with the existing implementation
2. **DO NOT mock the System Under Test (SUT)** - Only mock external dependencies
3. **Isolate test configuration** - Keep test setup separate from application code
4. **Test real behavior** - Verify actual functionality, not implementation details

## ESM Compatibility Solution

We encountered issues running tests in an ESM environment. To resolve this without modifying source code:

1. Switched from Jest to Vitest (test runner with better ESM support)
2. Created dedicated test configuration in `test-config/vitest/vitest.config.mjs`
3. Used `vi.mock()` instead of `jest.mock()` for mocking dependencies
4. Maintained proper path aliases to preserve import statements

## Dependency Mocking Strategy

We carefully mocked only external dependencies:

- `openai`: Mock API responses without changing service implementation
- `fs/promises`: Mock file operations for consistent test runs
- `ws`: Mock WebSocket server and clients
- `http`: Mock HTTP server for WebSocket connection

## Key Improvements

1. **Proper dependency mocking**: External services properly mocked without affecting SUT
2. **Robust error handling tests**: Testing edge cases (API errors, empty responses)
3. **Reliable test pattern**: Self-contained tests that don't influence each other
4. **Language diversity**: Testing multiple language combinations
5. **Retry logic verification**: Confirming services work even with intermittent failures

## Test Execution

We implemented convenient test runner scripts:

- `test-scripts/run-translation-tests.mjs`: Run TranslationService tests only
- `test-scripts/run-websocket-tests.mjs`: Run WebSocketServer tests only
- `test-scripts/run-all-tests.mjs`: Run all tests in the project

## Coverage

Our test coverage verifies:

- **Happy paths**: Basic functionality works as expected
- **Error handling**: Services gracefully handle failure conditions 
- **Edge cases**: Behavior with empty/invalid inputs
- **Integration points**: Interface correctness between components

## Next Steps

To maintain high testing quality:

1. Keep test files in sync with any source code changes
2. Extend the same testing principles to new components
3. Run all tests before deploying to production
4. Never modify the System Under Test for testing purposes