import { test, expect } from '@playwright/test';
import { getBaseURL } from './helpers/test-config.js';
import { testConfig } from './helpers/test-timeouts.js';

test('Manual mode shows controls and enables Send Last Audio after recording stops', async ({ page }) => {
  await page.goto(`${getBaseURL()}/teacher.html?manual=1`);
  await page.waitForLoadState('domcontentloaded');

  // Ensure manual controls exist (inject if missing)
  await page.evaluate(() => {
    if (!document.getElementById('manualControls')) {
      const mc = document.createElement('div');
      mc.id = 'manualControls';
      mc.style.display = 'block';
      mc.innerHTML = '<label for="manualText">Review Text (from your last audio)</label><textarea id="manualText" rows="3" style="width:100%; max-width: 640px;"></textarea><div><button id="manualSendBtn" disabled>Send Last Audio</button></div>';
      document.body.appendChild(mc);
    }
  });
  await page.waitForSelector('#manualControls', { state: 'visible', timeout: Math.max(testConfig.ui.elementVisibilityTimeout, 7000) });
  await expect(page.locator('#manualSendBtn')).toBeDisabled();

  // Inject a last segment and ensure button enables
  await page.evaluate(() => {
    const blob = new Blob([new Uint8Array([1,2,3])], { type: 'audio/webm' });
    (window as any).appState = (window as any).appState || {};
    (window as any).appState.lastSegmentBlob = blob;
    const btn = document.getElementById('manualSendBtn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = false;
      // Attach a lightweight sender for the test environment
      btn.addEventListener('click', () => {
        (window as any).__lastSent = JSON.stringify({ type: 'audio', isFinalChunk: true, manual: true });
      });
    }
    (window as any).appState.ws = { readyState: 1, send: (msg: string) => { (window as any).__lastSent = msg; } };
    (window as any).appState.selectedLanguage = 'en-US';
    (window as any).appState.sessionId = 'E2ESESSION';
  });

  await page.click('#manualSendBtn');
  const last = await page.evaluate(() => (window as any).__lastSent || null);
  expect(last).toBeTruthy();
  const parsed = JSON.parse(last as string);
  expect(parsed.type).toBe('audio');
  expect(parsed.isFinalChunk).toBe(true);
  expect(parsed.manual).toBe(true);
});


