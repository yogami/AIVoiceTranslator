# AIVoiceTranslator Testing Guide

## 🚀 Quick Start - Test Commands

### Simple Commands (What You Need to Know)

```bash
# Run all unit tests (fast - ~20 seconds)
STORAGE_TYPE=memory npm run test:unit

# Run all integration tests (slower - ~40 seconds)
STORAGE_TYPE=memory npm run test:integration

# Run E2E tests (requires server NOT running)
npm run test:e2e

# Run specific test file
npx vitest tests/unit/storage.test.ts

# Run tests in watch mode
npx vitest --watch
```

### Why STORAGE_TYPE=memory?
The app supports both memory and database storage. Tests should use memory storage to avoid database dependencies. Always prefix test commands with `STORAGE_TYPE=memory`.

## 📊 Current Test Status

| Test Type | Passing | Failed | Skipped | Time | Notes |
|-----------|---------|--------|---------|------|-------|
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