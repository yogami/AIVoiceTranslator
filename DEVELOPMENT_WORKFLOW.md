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

### For Speech & TTS Changes

1. Write TTS-specific tests (see [TTS_AUTOPLAY_VERIFICATION.md](TTS_AUTOPLAY_VERIFICATION.md))
2. Update speech handling code
3. Run TTS autoplay tests using `./run-tts-autoplay-test.sh`
4. Verify behavior across all TTS services (Browser, OpenAI, Silent)
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

Always review clean code principles in `attached_assets/Clean-Code-Cheat-Sheet-V1.3.md` and TDD best practices in `attached_assets/Clean-TDD-Cheat-Sheet-V1.2.md` before writing any code. After reviewing, maintain these standards:

- **Test Coverage**: >90% overall, >95% for critical paths
- **Cyclomatic Complexity**: ≤ 3 per function
- **Code Duplication**: <5%
- **Code Smells**: 0 critical, <5 minor
- **Function Length**: <20 lines for new code, <50 lines for existing code
- **Nesting Depth**: ≤ 2 levels for new code, ≤ 3 levels for existing code
- **Dependencies**: No circular dependencies
- **Naming**: Variable and function names should be descriptive and reveal intent
- **SOLID Principles**: Apply all 5 SOLID principles in your design
- **Test Quality**: Follow Arrange-Act-Assert pattern and test behaviors, not implementation
- **Clean Code Review**: After writing code, verify it against clean code principles

These standards are non-negotiable. Always prioritize code quality over quick delivery. Technical debt is never acceptable.

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

## Clean Code & Craftsmanship Review

Every time a change is made to the codebase, you must refresh your knowledge about clean code, Test-Driven Development (TDD), and software craftsmanship best practices:

1. Review all markdown files in the `attached_assets` folder, especially:
   - `Clean-Code-Cheat-Sheet-V1.3.md`
   - `Clean-TDD-Cheat-Sheet-V1.2.md`
   - `pragmatic-principles-cheat-sheet.v1.md`
   - `code-quality-metrics-cheatsheet.md`

2. Internalize the core principles before writing any code:
   - Single Responsibility Principle
   - Test-First Development
   - Refactoring for cleanliness
   - Meaningful naming
   - Function size and complexity limits

3. Apply these principles directly to your implementation:
   - Write tests before code
   - Keep functions small (≤ 20 lines)
   - Maintain low cyclomatic complexity (≤ 3)
   - Use meaningful names that reveal intent
   - Follow SOLID principles

4. Reference specific best practices from these documents in your commit messages

5. Review all requirements documentation relevant to your changes:
   - Identify specifications in project documents
   - Ensure your implementation aligns with documented requirements
   - Update your code if any inconsistencies are found

This software craftsmanship review step is mandatory for every code change, regardless of size or scope.

## Final Verification Checklist

Before considering any feature complete:

- [ ] All tests pass locally
- [ ] CI/CD pipeline passes
- [ ] Code meets all quality standards
- [ ] Documentation is updated
- [ ] **Clean code, TDD, and software craftsmanship best practices have been reviewed**
- [ ] **All markdown files in attached_assets folder have been thoroughly studied**
- [ ] Implementation follows principles from Clean-Code-Cheat-Sheet and Clean-TDD-Cheat-Sheet
- [ ] Metrics dashboard reflects changes
- [ ] Manual verification confirms functionality

By following this workflow consistently, we ensure that the AIVoiceTranslator maintains its high standards of quality, testing, and performance.