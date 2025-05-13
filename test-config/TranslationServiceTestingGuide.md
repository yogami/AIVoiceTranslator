# TranslationService Testing Guide

This guide provides instructions for running and maintaining tests for the TranslationService component of the AIVoiceTranslator project.

## Testing Philosophy

Our testing approach follows these key principles:

1. **Test isolation**: Tests are completely isolated from application code
2. **No source modifications**: Tests never require changes to application source code
3. **SUT integrity**: The System Under Test is never mocked, only its dependencies
4. **Comprehensive coverage**: Tests cover happy paths, error paths, and edge cases

## Test Directory Structure

```
project/
├── tests/                  # Contains all test files
│   └── unit/
│       └── services/
│           └── TranslationService.spec.ts  # Main test file
├── test-scripts/           # Scripts for running tests
│   ├── run-translation-tests.mjs
│   └── run-translation-coverage.mjs
└── test-config/            # Test configuration and documentation
    ├── vitest/
    │   └── vitest.config.mjs
    ├── coverage/           # Coverage reports directory
    ├── test-coverage-analysis.md
    └── TranslationServiceTestingGuide.md
```

## Running the Tests

### Basic Test Execution

To run the TranslationService tests without coverage reporting:

```bash
node test-scripts/run-translation-tests.mjs
```

This script:
- Uses an isolated Vitest configuration
- Runs only the TranslationService tests
- Reports results in the terminal

### Coverage Analysis

For a coverage analysis:

```bash
node test-scripts/run-translation-coverage.mjs
```

Due to dependency constraints, we use manual coverage analysis instead of automated tools. The coverage analysis is documented in `test-config/test-coverage-analysis.md`.

## Test Cases

The test suite includes the following types of tests:

### Happy Path Tests
- Basic speech translation
- Translation with pre-transcribed text
- Audio transcription
- Text translation

### Error Path Tests
- Transcription service failures
- Translation service failures
- OpenAI API errors
- File system errors

### Edge Cases
- Empty audio buffer
- Very small audio files
- Very long text
- Same source/target language
- TTS service errors

## Adding New Tests

When adding new tests:

1. Add test cases to `tests/unit/services/TranslationService.spec.ts`
2. Follow the existing patterns for mocking dependencies
3. Cover both happy paths and error paths
4. Include edge cases where appropriate
5. Update `test-coverage-analysis.md` with new coverage information

## Mocking Strategy

- The Vitest `vi` object is used for mocking
- Dependencies are mocked using `vi.fn()`
- The System Under Test (SUT) is never mocked
- Reset mocks before each test with `vi.resetAllMocks()`

## Test Design Pattern

Each test follows this pattern:

```typescript
it('should [expected behavior]', async () => {
  // Arrange - set up test conditions
  const input = ...;
  mockDependency.method.mockReturnValueOnce(...);
  
  // Act - call the method being tested
  const result = await serviceInstance.method(input);
  
  // Assert - verify the result
  expect(result).toEqual(...);
  expect(mockDependency.method).toHaveBeenCalledWith(...);
});
```

## Troubleshooting

If tests are failing:

1. **ESM compatibility issues**: Make sure `NODE_OPTIONS='--experimental-vm-modules'` is set
2. **Mock failures**: Check that dependencies are properly mocked
3. **Path issues**: Verify the correct paths are being used in test files
4. **Assertion errors**: Ensure expectations match the actual implementation

## Maintaining Tests

As the application evolves:

1. Update tests when implementation changes
2. Add tests for new functionality
3. Periodically verify test coverage
4. Keep all test code in the designated test directories