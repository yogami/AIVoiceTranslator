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
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://127.0.0.1:5000', // BaseURL is set, but using full URLs in goto() for reliability

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

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

  // webServer block is commented out to support manual server startup for now.
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://127.0.0.1:5000',
  //   reuseExistingServer: !process.env.CI, 
  //   timeout: 120 * 1000, 
  //   cwd: '../', 
  //   stdout: 'pipe', 
  //   stderr: 'pipe',
  // },
});