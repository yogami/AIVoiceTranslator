# Selenium End-to-End Tests

This directory contains Selenium end-to-end tests for the AIVoiceTranslator application.

## Important Note

**These tests are designed to run ONLY in the GitHub Actions CI/CD environment, NOT in the Replit environment.**

Per the Working Agreement (section 3.1):

> - Verify UI and user interface issues by writing comprehensive Selenium end-to-end tests
> - NEVER run Selenium tests in the Replit environment due to its limitations
> - Only execute Selenium tests in the CI/CD environment (GitHub Actions)

## Test Structure

Tests follow the London School TDD approach, focusing on behavior and interactions:

1. Each test file focuses on a specific component or feature
2. Tests are written with clear assertions about expected behavior
3. All edge cases are covered with specific test scenarios

## Running Tests

Tests will automatically run in the GitHub Actions CI/CD pipeline. To manually trigger a test run:

```bash
# Push to GitHub to trigger CI/CD
git push origin main
```

## Adding New Tests

When adding new UI tests:

1. Create a new test file in this directory
2. Follow the pattern of existing tests
3. Use detailed assertions to verify UI behavior
4. Include test cases for all edge cases
5. Document any special setup requirements

## Screenshot Storage

Test failure screenshots will be saved to the `screenshots/` directory in the CI/CD environment and attached as artifacts to the workflow run.