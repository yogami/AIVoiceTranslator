import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 90000,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5001',
    trace: 'retry-with-trace',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});


