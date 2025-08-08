import { defineConfig, devices } from "@playwright/test";
import { testConfig } from "../tests/e2e/helpers/test-timeouts.js";

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
  testDir: "../tests/e2e",
  fullyParallel: false, // Disable parallel execution to avoid DB conflicts during seeding
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Force single worker to ensure database isolation
  reporter: process.env.CI ? "dot" : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || "5001"}`,
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Temporarily disable webkit due to compatibility issues
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  webServer: {
    command: "npm run dev:test",
    url: `http://127.0.0.1:5001/teacher`,
    // reuseExistingServer is not supported in latest Playwright config
    cwd: process.cwd(),
    timeout: 90000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      E2E_TEST_MODE: "true",
      LOG_LEVEL: "warn",
      PORT: "5001",
      HOST: "127.0.0.1",
      ANALYTICS_PASSWORD: ""
    },
  },
  /* Global setup to ensure test environment */
});

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL) {
  // Provide a fallback for local/dev, but throw in CI
  if (process.env.CI) {
    throw new Error("PLAYWRIGHT_BASE_URL environment variable must be set for Playwright tests.");
  } else {
    process.env.PLAYWRIGHT_BASE_URL = `http://${process.env.HOST || "localhost"}:${process.env.PORT || "5001"}`;
  }
}