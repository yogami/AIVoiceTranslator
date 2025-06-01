import { defineConfig, devices } from '@playwright/test';

/**
 * Simplified Playwright Configuration for manual server startup.
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
    baseURL: 'http://127.0.0.1:5000', // Ensure this matches your manually started server

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

  // Re-enable webServer block for automated server startup
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5000', // URL for Playwright to poll until server is ready
    reuseExistingServer: !process.env.CI, // Reuse server locally, fresh start in CI
    timeout: 120 * 1000, // 2 minutes for server to start
    cwd: '../', // Project root relative to this config file
    stdout: 'pipe', // Capture server stdout
    stderr: 'pipe', // Capture server stderr
    // consider adding `ignoreHTTPSErrors: true` if using HTTPS with self-signed cert locally, though not applicable here.
  },
});