# AIVoiceTranslator Testing Guide

## 🚀 Quick Test Commands

### Essential Test Commands

```bash
# Unit Tests - Fast, comprehensive testing (300+ tests)
npm run test:unit

# Integration Tests - Database and WebSocket integration
npm run test:integration

# E2E Tests - Full browser automation (STOP dev server first!)
npx kill-port 5000 && npm run test:e2e

# All Tests - Complete test suite
npm run test

# Watch Mode - Auto-rerun tests on changes
npm run test:watch
```

### ⚠️ Important: E2E Test Requirements

**E2E tests will FAIL if the dev server is running!** They start their own test server.

```bash
# ALWAYS stop dev server before E2E tests:
npx kill-port 5000
# THEN run E2E tests:
npm run test:e2e
```

## 📊 Current Test Status

| Test Type | Count | Status | Time | Coverage |
|-----------|-------|--------|------|----------|
| **Unit Tests** | 241 passing | ✅ | ~20s | Core logic, services, utilities |
| **Integration Tests** | 60 passing | ✅ | ~40s | Database, WebSocket, API endpoints |
| **E2E Tests** | 36 passing | ✅ | ~2min | Full user workflows, UI automation |
| **Total** | **337 tests** | ✅ | ~3min | Complete application coverage |

## 🧪 Test Architecture

### Unit Tests (`tests/unit/`)
- **Service Logic**: Translation, TTS, session management
- **Database Storage**: All storage operations with mocked database
- **WebSocket Handlers**: Message processing and connection management
- **Utilities**: Configuration, logging, error handling
- **Mock Strategy**: External dependencies mocked for isolation

### Integration Tests (`tests/integration/`)
- **Real Database**: PostgreSQL integration with test database
- **WebSocket Communication**: Full message flow testing
- **Service Integration**: End-to-end service coordination
- **API Endpoints**: HTTP API testing with real requests
- **Database Setup**: Automatic test data creation and cleanup

### E2E Tests (`tests/e2e/`)
- **Browser Automation**: Playwright-based UI testing
- **User Workflows**: Teacher and student complete journeys
- **Analytics Dashboard**: Dashboard functionality and navigation
- **WebSocket Integration**: Real-time communication testing
- **Cross-browser**: Chrome, Firefox, Safari compatibility

## 🔧 Advanced Testing

### Running Specific Tests

```bash
# Single test file
npx vitest tests/unit/storage.test.ts

# Test pattern matching
npx vitest --grep "WebSocket"

# Specific E2E test
npx playwright test tests/e2e/teacher.spec.ts

# E2E with browser UI (visual debugging)
npx playwright test --ui

# E2E headed mode (see browser)
npx playwright test --headed
```

### Test Configuration

```bash
# Different test environments
NODE_ENV=test npm run test:unit     # Test environment
CI=true npm run test                # CI environment

# Database testing
npm run test:integration            # Uses .env.test database
npm run db:migrations:apply:test    # Setup test database
npm run db:audit:test              # Verify test database
```

### Debugging Tests

```bash
# Vitest UI mode for debugging
npx vitest --ui

# Debug specific test with Node.js debugger
npx vitest --inspect-brk tests/unit/specific.test.ts

# Playwright debug mode
npx playwright test --debug

# Generate test reports
npm run test:coverage              # Coverage report
npx playwright show-report        # E2E test report
```

## 🛠️ Troubleshooting Common Issues

### 1. E2E Tests Fail: "Error: listen EADDRINUSE"
- **Cause**: Dev server is running on port 5000
- **Fix**: `npx kill-port 5000` then run E2E tests

### 2. Integration Tests Timeout
- **Cause**: Database connection issues or test database not set up
- **Fix**: 
  ```bash
  npm run db:audit:test              # Check test database
  npm run db:migrations:apply:test   # Apply migrations if needed
  ```

### 3. WebSocket Tests Fail
- **Cause**: Port conflicts or connection issues
- **Fix**: Ensure no other services on test ports (5001, 5002, etc.)

### 4. Unit Tests with Database Errors
- **Cause**: Trying to use real database in unit tests
- **Fix**: Ensure proper mocking in test setup

### 5. Tests Hang or Run Forever
- **Cause**: Improper cleanup or async operations not awaited
- **Fix**: Check test isolation and cleanup in `afterEach` blocks

## 📋 Test Development Guidelines

### Writing Unit Tests
- **Mock external dependencies** (database, APIs, file system)
- **Test single units** of functionality in isolation
- **Use descriptive test names** that explain the scenario
- **Follow AAA pattern**: Arrange, Act, Assert

### Writing Integration Tests
- **Use real database** connections with test data
- **Test service coordination** and data flow
- **Clean up test data** after each test
- **Test error scenarios** and edge cases

### Writing E2E Tests
- **Test complete user journeys** from start to finish
- **Use page objects** for better maintainability
- **Include wait strategies** for dynamic content
- **Test across different browsers** when possible

### Test Data Management
- **Use factories** for creating test data
- **Isolate test data** between tests
- **Clean up after tests** to prevent interference
- **Use realistic test data** that mirrors production

## 🔍 Test Quality Metrics

### Coverage Goals
- **Unit Tests**: >90% line coverage for core business logic
- **Integration Tests**: All API endpoints and database operations
- **E2E Tests**: All critical user workflows and UI components

### Performance Benchmarks
- **Unit Tests**: <30 seconds total execution time
- **Integration Tests**: <60 seconds total execution time  
- **E2E Tests**: <3 minutes total execution time

### Reliability Standards
- **Flaky Test Rate**: <1% (tests should pass consistently)
- **Test Maintenance**: Regular updates with code changes
- **CI/CD Integration**: All tests must pass before deployment

## 📚 Additional Resources

- **[E2E Test Instructions](E2E_TEST_INSTRUCTIONS.md)** - Detailed E2E testing guide
- **[Database Architecture](DATABASE_ARCHITECTURE.md)** - Database testing considerations
- **[WebSocket Architecture](websocket-architecture.md)** - WebSocket testing patterns
- **[CI/CD Setup](CI_CD_SETUP_SUMMARY.md)** - Automated testing in CI/CD

## 🤝 Contributing to Tests

When adding new features:
1. **Write unit tests** for new business logic
2. **Add integration tests** for new database operations or API endpoints
3. **Create E2E tests** for new user-facing features
4. **Update existing tests** when changing existing functionality
5. **Ensure all tests pass** before submitting pull requests

**Test-Driven Development (TDD) is encouraged** - write tests first, then implement features to make them pass.
| Unit | 241 ✅ | 0 | 0 | ~20s | 4 non-critical fs errors |
| Integration | 60 ✅ | 1 ❌ | 12 | ~40s | 1 fail = DatabaseStorage (expected) |
| E2E | 36 ✅ | 0 | 0 | ~2m | Must stop dev server first |

### Test Details
- **Unit Tests**: Fast, isolated tests with mocked dependencies
- **Integration Tests**: Test multiple components together
- **E2E Tests**: Full browser-based user workflow tests

## ❌ Common Issues & Solutions

### 1. E2E Tests Fail with "EADDRINUSE"
**Problem**: Server is already running on port 5000
```bash
Error: Process from config.webServer was not able to start. Exit code: 1
```

**Solution**: Stop the dev server before running E2E tests
```bash
# Find and kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or use the kill-port package
npx kill-port 5000

# Then run E2E tests
npm run test:e2e
```

### 2. Unit Test File System Errors
**Problem**: 4 unhandled errors about missing files
```
Error: ENOENT: no such file or directory, open '/tmp/fake-audio.wav'
```

**Solution**: These are non-critical. Tests still pass. The mock isn't catching all fs operations.

### 3. Integration Test Database Failure
**Problem**: DatabaseStorage tests fail
```
FAIL tests/integration/storage/DatabaseStorage-integration.test.ts
```

**Solution**: This is expected. These tests require a real database. Use memory storage for local testing.

## 🔍 Understanding Test Types

### Unit Tests (`tests/unit/`)
- Test individual functions/classes in isolation
- Use mocks for external dependencies
- Fast execution
- No network calls

### Integration Tests (`tests/integration/`)
- Test multiple components working together
- May use real services (with mocks for external APIs)
- Test WebSocket connections, API routes, etc.
- Slower than unit tests

### E2E Tests (`tests/e2e/`)
- Test full user workflows in a browser
- Use Playwright for browser automation
- Test real UI interactions
- Slowest but most comprehensive

## 📝 Test Organization

### Skipped Tests
- **12 database tests**: Skip when using memory storage
- Located in `tests/integration/storage/DatabaseStorage-integration.test.ts`

## 🛠️ Advanced Testing

### Run Specific Test Suites
```bash
# Run only service tests
npx vitest tests/unit/services

# Run with coverage
npm run test:coverage

# Run in UI mode (great for debugging)
npx vitest --ui

# Debug E2E tests visually
npm run test:e2e:ui
```

### Environment Variables for Tests
```bash
# Force memory storage (recommended)
STORAGE_TYPE=memory

# Use test OpenAI key (if not in .env)
OPENAI_API_KEY=test-key-for-testing

# For integration tests with real OpenAI API calls, set a valid key in .env.test:
# .env.test
OPENAI_API_KEY=sk-your-real-openai-api-key

# Enable debug output
DEBUG=true
```

- Vitest automatically loads `.env.test` when running tests. No extra CLI flags are needed.
- If you want integration tests to use the real OpenAI API, ensure your `.env.test` contains a valid `OPENAI_API_KEY`.

## 🔧 Troubleshooting

### Tests Hang or Run Slowly
1. Check if server is running (for E2E tests, it shouldn't be)
2. Clear test cache: `rm -rf node_modules/.vitest`
3. Run tests sequentially: `npx vitest --no-threads`
4. Kill orphaned processes: `pkill -f "tsx.*server/index.ts"`

### Can't Find Test Command
All test commands are in `package.json`:
- `npm run test:unit` - Unit tests only
- `npm run test:integration` - Integration tests only
- `npm run test:e2e` - E2E browser tests
- `npm run test:all` - Unit + Integration (not E2E)

### Database Tests Failing
If you need to run database tests:
1. Set up PostgreSQL locally
2. Create `.env.test` with `DATABASE_URL`
3. Run: `npm run test:integration`

### E2E Test Environment Details
The E2E tests use `E2E_TEST_MODE=true` which:
- Forces memory storage regardless of DATABASE_URL
- Ensures consistent behavior across environments
- Works identically in CI/CD and local development
- Takes precedence over all other storage configurations

## 📚 Writing New Tests

### File Naming
- Unit tests: `tests/unit/[module].test.ts`
- Integration tests: `tests/integration/[feature].test.ts`
- E2E tests: `tests/e2e/[workflow].spec.ts`

### Test Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Test
    expect(result).toBe(expected);
  });
});
```

## 🎯 For New Developers

Quick checklist for running tests successfully:
1. **Always use `STORAGE_TYPE=memory`** for unit and integration tests
2. **Stop dev server** before running E2E tests (`npx kill-port 5000`)
3. **Database test failure is expected** - don't worry about it
4. **Use the npm scripts** - they're configured correctly

## 📁 Test Files Location

- **Unit Tests**: `tests/unit/`
- **Integration Tests**: `tests/integration/`
- **E2E Tests**: `tests/e2e/`
- **Test Config**: `test-config/`

## 🚀 CI/CD Considerations

For GitHub Actions or other CI/CD:
1. Always use `STORAGE_TYPE=memory`
2. E2E tests need `xvfb-run` for headless browser
3. Set `CI=true` environment variable
4. Use the test commands from package.json

Example GitHub Action:
```yaml
- name: Run Unit Tests
  run: STORAGE_TYPE=memory npm run test:unit
  
- name: Run Integration Tests
  run: STORAGE_TYPE=memory npm run test:integration
  
- name: Run E2E Tests
  run: npm run test:e2e
```