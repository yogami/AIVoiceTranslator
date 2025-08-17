import { test, expect } from '@playwright/test';
import { testConfig } from './helpers/test-timeouts';
import { getTeacherURL, getBaseURL } from './helpers/test-config.js';

test('teacher page loads and registers over websocket', async ({ page }) => {
  // In dev middleware, explicitly request .html to avoid any route ambiguity
  await page.goto(getTeacherURL('e2e=true').replace('/teacher', '/teacher.html'));
  await page.waitForLoadState('domcontentloaded');
  // Wait for main container to exist if H1 is absent in dev
  await expect(page.locator('body')).toBeVisible();
  // Basic UI element presence to confirm teacher page loaded in dev
  await expect(page.locator('#status')).toContainText(/Ready to connect|Registered as teacher/, { timeout: testConfig.ui.connectionStatusTimeout });
  await expect(page.locator('#teacherLanguage')).toBeVisible({ timeout: testConfig.ui.elementVisibilityTimeout });
  // Allow extra time for classroom code to appear on slower first-loads
  await expect(page.locator('#classroom-code-display')).toBeVisible({ timeout: testConfig.ui.classroomCodeTimeout });
});


test('Teacher can use Manual mode: record, review text, and Send Last Audio', async ({ page }) => {
  await page.goto(`${getBaseURL()}/teacher.html?manual=1`);
  await page.waitForLoadState('domcontentloaded');

  // Manual controls should be visible and button initially disabled (allow extra time)
  await page.waitForSelector('#manualControls', { state: 'visible', timeout: 7000 });
  await expect(page.locator('#manualSendBtn')).toBeDisabled();
  // Review Text area exists
  const reviewText = page.locator('#manualText');
  await expect(reviewText).toBeVisible();

  // Simulate a recorded segment arriving (populate lastSegmentBlob)
  await page.evaluate(() => {
    const sample = new Blob([new Uint8Array([1,2,3,4,5])], { type: 'audio/webm' });
    (window as any).appState = (window as any).appState || {};
    (window as any).appState.lastSegmentBlob = sample;
    (window as any).appState.selectedLanguage = 'en-US';
    (window as any).appState.sessionId = 'TESTSESSION';
    // Also populate review text for clarity
    const ta = document.getElementById('manualText') as HTMLTextAreaElement | null;
    if (ta) ta.value = 'Test sentence from last audio.';
    // Mock open WebSocket
    (window as any).appState.ws = { readyState: 1, send: (msg: string) => { (window as any).__sentMsg = msg; } };
  });

  // Click Send Last Audio and assert a message was sent with manual flag
  await page.click('#manualSendBtn');
  const sent = await page.evaluate(() => (window as any).__sentMsg || null);
  expect(sent).toBeTruthy();
  const parsed = JSON.parse(sent as string);
  expect(parsed.type).toBe('audio');
  expect(parsed.isFinalChunk).toBe(true);
  expect(parsed.manual).toBe(true);
});


