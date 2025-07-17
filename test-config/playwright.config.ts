import { defineConfig, devices } from '@playwright/test';

// TODO: [Technical Debt - E2E Test Infrastructure]
// Resolve webServer startup issues to enable automated E2E tests for CI/CD.
// This involves:
// 1. Ensuring `command: 'npm run dev'` (with correct `cwd`) reliably starts the server.
// 2. Ensuring Playwright's `url` polling correctly detects server readiness.
// 3. Debugging any errors (e.g., timeouts, "Cannot navigate to invalid URL" when webServer is active).
// 4. Once webServer works, re-evaluate using `baseURL` with relative paths in `page.goto()` vs. full URLs.
// Current workaround: Manual server start and full URLs in page.goto(). The webServer block below is configured but commented out.

/**
 * Playwright Configuration - Currently set up for manual server startup.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: '../tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: false, // Disable parallel execution to avoid DB conflicts during seeding
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1, // Force single worker to ensure database isolation
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || '5001'}`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Global setup to ensure test environment */
  globalSetup: './global-setup.ts',

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // Temporarily disable webkit due to compatibility issues
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Configure the test server */
  webServer: {
    command: 'npm run dev:test',
    url: process.env.PLAYWRIGHT_BASE_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || '5001'}`,
    reuseExistingServer: !process.env.CI, // Reuse in local dev, fresh in CI
    cwd: process.cwd(), // Use current working directory
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120 * 1000, // 2 minutes
    env: {
      ...process.env,
      NODE_ENV: 'test',
      E2E_TEST_MODE: 'true',
      // DATABASE_URL will be loaded from .env.test file
      LOG_LEVEL: 'info',
      PORT: process.env.PORT || '5001',
      HOST: process.env.HOST || '127.0.0.1',
      ANALYTICS_PASSWORD: '' // Clear analytics password for test mode
    },
  },
});

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL) {
  // Provide a fallback for local/dev, but throw in CI
  if (process.env.CI) {
    throw new Error('PLAYWRIGHT_BASE_URL environment variable must be set for Playwright tests.');
  } else {
    process.env.PLAYWRIGHT_BASE_URL = `http://${process.env.HOST || 'localhost'}:${process.env.PORT || '5001'}`;
  }
}