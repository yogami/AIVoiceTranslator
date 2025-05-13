# Test Coverage Guide for TranslationService

This guide explains how to run code coverage tests for the TranslationService without modifying any source code or application configuration.

## Using the Coverage Tools

The testing setup follows these principles:
1. All test code remains in the dedicated `tests`, `test-scripts`, and `test-config` directories
2. No modifications to application source code are made
3. Coverage reports are generated in an isolated environment that doesn't affect the application

## Running Coverage Tests

To run coverage tests for the TranslationService, use the following command:

```bash
node test-scripts/run-translation-coverage.mjs
```

This script will:
1. Use a dedicated Vitest configuration from `test-config/vitest/vitest.config.mjs`
2. Generate coverage reports for the TranslationService
3. Place the reports in the `test-config/coverage` directory

## Understanding the Coverage Reports

After running the coverage script, you'll find coverage reports in these formats:
- Text summary (displayed in terminal)
- HTML report (in `test-config/coverage/html`)
- JSON data (in `test-config/coverage/coverage-final.json`)

The HTML report provides an interactive way to explore code coverage. Open the `index.html` file in a browser to view:
- Overall coverage percentages
- File-by-file breakdown
- Line-by-line highlighting of covered/uncovered code

## Coverage Metrics Explained

The coverage report tracks these metrics:
- **Statements**: Percentage of code statements executed
- **Branches**: Percentage of code branches (if/else) taken
- **Functions**: Percentage of functions called
- **Lines**: Percentage of code lines executed

## Adding More Tests

To increase coverage:
1. Add more test cases to `tests/unit/services/TranslationService.spec.ts`
2. Focus on code paths and conditions that aren't being exercised
3. Consider edge cases and error conditions
4. Run the coverage report again to see improvements

## Test Isolation

Our testing approach ensures complete isolation from the application:
- Tests only import the code under test
- Dependencies are properly mocked
- We test the System Under Test (SUT) directly without modifications
- Test configuration exists only in test directories