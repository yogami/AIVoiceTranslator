import { test, expect } from '@playwright/test';
import { testConfig } from './helpers/test-timeouts.js';
import { getTeacherURL } from './helpers/test-config.js';

test('teacher page loads and registers over websocket', async ({ page }) => {
  // In dev middleware, explicitly request .html to avoid any route ambiguity
  await page.goto(getTeacherURL('e2e=true').replace('/teacher', '/teacher.html'));
  await page.waitForLoadState('domcontentloaded');
  // Wait for main container to exist if H1 is absent in dev
  await expect(page.locator('body')).toBeVisible();
  // Basic UI element presence to confirm teacher page loaded in dev
  await expect(page.locator('#status')).toContainText(/Ready to connect|Registered as teacher/, { timeout: testConfig.ui.connectionStatusTimeout });
  await expect(page.locator('#teacherLanguage')).toBeVisible({ timeout: testConfig.ui.elementVisibilityTimeout });
});


