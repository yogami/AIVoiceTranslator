# E2E Test Instructions

## How to Run End-to-End (E2E) Tests

The E2E tests are configured to automatically start the test server and run comprehensive diagnostics dashboard tests.

### Prerequisites

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Install Playwright browsers** (if not already done):
   ```bash
   npx playwright install
   ```

3. **Set up test database** (if not already done):
   ```bash
   npm run db:push:test
   ```

### Running E2E Tests

The Playwright configuration is set up to automatically start the test server on port 5001 before running tests.

#### 1. Run All E2E Tests
```bash
npm run test:e2e
```

#### 2. Run Specific E2E Test File (e.g., diagnostics)
```bash
npm run test:e2e -- tests/e2e/diagnostics.spec.ts
```

#### 3. Run E2E Tests with UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

#### 4. Run E2E Tests in Debug Mode
```bash
npm run test:e2e:debug
```

#### 5. Run Only Diagnostics Tests
```bash
npm run test:e2e -- --grep "Diagnostics Dashboard"
```

### Test Server Configuration

The E2E tests use a dedicated test server configuration:
- **Port**: 5001 (different from dev port 3000)
- **Environment**: `NODE_ENV=test`
- **Database**: Uses `.env.test` configuration
- **Auto-start**: Playwright automatically starts/stops the server

### Diagnostics Dashboard E2E Tests

The comprehensive diagnostics test suite (`tests/e2e/diagnostics.spec.ts`) includes:

1. **SCENARIO 1**: No connections - All metrics should be zero
2. **SCENARIO 2**: Teacher loads but NO students join (Critical bug test)
3. **SCENARIO 3**: 1 Teacher + 1 Student
4. **SCENARIO 4**: 1 Teacher + 2 Students  
5. **SCENARIO 5**: 1 Teacher + 3 Students
6. **SCENARIO 6**: Multiple classroom sessions (2 teachers each with students)
7. **SCENARIO 7**: Complex multiple sessions (different student counts)
8. **SCENARIO 8**: Session disconnection behavior
9. **SCENARIO 9**: Rapid connection/disconnection cycles
10. **SCENARIO 10**: Multiple teachers, no students (Edge case)
11. **SCENARIO 11**: Real-time updates
12. **SCENARIO 12**: Data consistency checks
13. **SCENARIO 13**: Invalid classroom codes

### What Each Test Validates

Each test validates ALL diagnostic dashboard fields:
- ✅ **Active Users** count
- ✅ **Total Sessions** count  
- ✅ **Active Teachers** count
- ✅ **Active Students** count
- ✅ **Recent Session Activity** (no N/A values)
- ✅ **Mathematical consistency** (Active Users = Teachers + Students)
- ✅ **No phantom sessions** or undefined values

### Troubleshooting

If tests fail to start:

1. **Check if port 5001 is in use**:
   ```bash
   lsof -i :5001
   ```

2. **Manually start test server** (if needed):
   ```bash
   npm run dev:test
   ```
   Then in another terminal:
   ```bash
   npx playwright test --config=test-config/playwright.config.ts tests/e2e/diagnostics.spec.ts
   ```

3. **Reset test database**:
   ```bash
   npm run db:reset:test
   npm run db:push:test
   ```

4. **View test results**:
   ```bash
   npx playwright show-report
   ```

### Test Output

- **HTML Report**: Generated after test run, opens automatically
- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed tests
- **Traces**: Available for debugging failed tests

### Environment Variables

The tests use these environment variables:
- `NODE_ENV=test`
- `E2E_TEST_MODE=true`
- `LOG_LEVEL=info`
- `PORT=5001`

These are automatically set by the npm scripts.
