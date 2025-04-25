# AIVoiceTranslator Development Workflow

This document outlines the standard development workflow that should be followed for all code changes to the AIVoiceTranslator project. Following this process ensures high code quality, comprehensive testing, and consistent performance.

## Test-Driven Development (TDD) Workflow

### 1. Write Tests First

- **Unit Tests**: Write unit tests for individual components and functions
- **Integration Tests**: Write tests for component interactions
- **End-to-End Tests**: Create Selenium tests for user interface interactions
- **Tests should:**
  - Be comprehensive
  - Test the happy path and error conditions
  - Have clear Arrange-Act-Assert structure
  - Be deterministic and repeatable

### 2. Write Implementation Code

- Implement the minimum code needed to pass the tests
- Ensure the code is clean, maintainable, and follows SOLID principles
- Keep cyclomatic complexity ≤ 3
- Maintain consistent error handling

### 3. Refactor

- Refactor code to improve quality without changing functionality
- Eliminate code smells and duplication
- Optimize performance where necessary
- Ensure code follows project style guidelines

### 4. Update Testing Pyramid

- Ensure proper distribution of tests (unit > integration > E2E)
- Maintain high test coverage (target: >90% overall)
- Update test metrics dashboard

### 5. Update CI/CD Configuration

- Add new tests to GitHub Actions workflows
- Update CI/CD trigger scripts if needed
- Ensure new tests run in the CI pipeline

### 6. Update Documentation & Metrics

- Update documentation with new features
- Update code metrics dashboard
- Ensure complexity metrics stay within targets
- Document any API changes

### 7. Verify Manually

- Manually verify the feature works as expected
- Only consider the feature complete after both automated tests and manual verification pass

## Specific Procedures for Different Feature Types

### For UI Changes

1. Write Selenium E2E tests first
2. Implement UI changes
3. Run tests locally
4. Update dashboard metrics
5. Push to CI/CD pipeline

### For Backend/API Changes

1. Write unit and integration tests
2. Implement API changes
3. Update API documentation
4. Run tests locally
5. Update dashboard metrics
6. Push to CI/CD pipeline

### For New Features

1. Design the feature (APIs, data structures, etc.)
2. Write comprehensive tests at all appropriate levels
3. Implement the feature
4. Refactor for code quality
5. Update all documentation and metrics
6. Run full test suite locally
7. Push to CI/CD pipeline

## Code Quality Standards

Always maintain these standards:

- **Test Coverage**: >90% overall, >95% for critical paths
- **Cyclomatic Complexity**: ≤ 3 per function
- **Code Duplication**: <5%
- **Code Smells**: 0 critical, <5 minor
- **Function Length**: <50 lines
- **Nesting Depth**: ≤ 3 levels
- **Dependencies**: No circular dependencies

## Workflows and Scripts

Use these scripts to maintain quality:

- `./tests/run-audio-e2e-tests.sh`: Run audio translation tests
- `./tests/run-tts-selection-tests.sh`: Run TTS service selection tests
- `./tests/run-tts-service-suite.sh`: Run all TTS-related tests
- `./ci-cd-trigger.sh`: Trigger CI/CD pipeline
- `node test-metrics-api.js --test-type=<type> --test-name=<name> --update-results`: Update test metrics

## Dashboard Updates

After all changes, ensure the metrics dashboard is updated:

1. Run all test suites
2. Update metrics data
3. Verify dashboard changes reflect current project state

## Final Verification Checklist

Before considering any feature complete:

- [ ] All tests pass locally
- [ ] CI/CD pipeline passes
- [ ] Code meets all quality standards
- [ ] Documentation is updated
- [ ] Metrics dashboard reflects changes
- [ ] Manual verification confirms functionality

By following this workflow consistently, we ensure that the AIVoiceTranslator maintains its high standards of quality, testing, and performance.