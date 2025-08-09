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
// Allow CI/CD (or local) to point tests at an already running environment and skip starting a web server
const disableWebServer = process.env.DISABLE_WEB_SERVER === "1";

// Provide default, SHORT session timing envs for the test runner process itself
// This keeps E2E specs' process.env reads consistent with the webServer settings below
process.env.SESSION_STALE_TIMEOUT_MS = process.env.SESSION_STALE_TIMEOUT_MS || String(10 * 1000);
process.env.SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS = process.env.SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS || String(5 * 1000);
process.env.SESSION_EMPTY_TEACHER_TIMEOUT_MS = process.env.SESSION_EMPTY_TEACHER_TIMEOUT_MS || String(5 * 1000);
process.env.SESSION_CLEANUP_INTERVAL_MS = process.env.SESSION_CLEANUP_INTERVAL_MS || String(2 * 1000);
process.env.TEACHER_RECONNECTION_GRACE_PERIOD_MS = process.env.TEACHER_RECONNECTION_GRACE_PERIOD_MS || String(5 * 1000);

export default defineConfig({
  testDir: "../tests/e2e",
  fullyParallel: false, // Disable parallel execution to avoid DB conflicts during seeding
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Force single worker to ensure database isolation
  reporter: process.env.CI ? "dot" : "html",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || "5001"}`,
    trace: "on-first-retry",
    headless: true,
    ...(process.env.ANALYTICS_PASSWORD
      ? {
          httpCredentials: {
            username: "admin",
            password: process.env.ANALYTICS_PASSWORD as string,
          },
        }
      : {}),
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
  webServer: disableWebServer
    ? undefined
    : {
        command: "npm run dev:test",
        url: `http://127.0.0.1:5001/api/health`,
        reuseExistingServer: true,
        cwd: process.cwd(),
        timeout: testConfig.playwright.serverStartupTimeout,
        env: {
          ...process.env,
          NODE_ENV: "development",
          E2E_TEST_MODE: "true",
          LOG_LEVEL: "warn",
          PORT: "5001",
          HOST: "127.0.0.1",
          ANALYTICS_PASSWORD: "",
          // Short session lifecycle timings for fast, deterministic E2E expiry
          SESSION_STALE_TIMEOUT_MS: process.env.SESSION_STALE_TIMEOUT_MS || String(10 * 1000),
          SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS: process.env.SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS || String(5 * 1000),
          SESSION_EMPTY_TEACHER_TIMEOUT_MS: process.env.SESSION_EMPTY_TEACHER_TIMEOUT_MS || String(5 * 1000),
          SESSION_CLEANUP_INTERVAL_MS: process.env.SESSION_CLEANUP_INTERVAL_MS || String(2 * 1000),
          TEACHER_RECONNECTION_GRACE_PERIOD_MS: process.env.TEACHER_RECONNECTION_GRACE_PERIOD_MS || String(5 * 1000),
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