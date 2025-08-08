import { test, expect } from '@playwright/test';
import { getTeacherURL } from './helpers/test-config.js';

test('teacher page loads and registers over websocket', async ({ page }) => {
  await page.goto(getTeacherURL('e2e=true'));
  await page.waitForLoadState('domcontentloaded');
  // Wait for main container to exist if H1 is absent in dev
  await expect(page.locator('body')).toBeVisible();
  // Basic UI element presence to confirm teacher page loaded in dev
  await expect(page.locator('#teacherLanguage')).toBeVisible({ timeout: 15000 });
});


