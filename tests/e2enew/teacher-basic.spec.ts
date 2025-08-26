import { test, expect } from '@playwright/test';

test.describe('Teacher basic page loads', () => {
  test('loads and shows classroom code', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
    await page.goto(`${base}/teacher`);
    await page.waitForSelector('#classroom-code-display', { timeout: 20000 });
    const code = await page.locator('#classroom-code-display').textContent();
    expect(code && code.trim().length).toBeTruthy();
  });
});


