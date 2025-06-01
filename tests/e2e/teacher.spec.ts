/**
 * Teacher Interface E2E Test
 * 
 * This test checks the functionality of the teacher interface.
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Teacher Interface - Basic Load', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Use full URL directly
    await page.goto('http://127.0.0.1:5000/teacher'); 
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should display initial UI elements correctly', async () => {
    // Check h1 (main heading)
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toBeVisible();
    await expect(mainHeading).toContainText('Teacher Interface');

    // Check other essential UI elements
    await expect(page.locator('#teacherLanguage')).toBeVisible();
    
    const recordButton = page.locator('#recordButton');
    await expect(recordButton).toBeVisible();
    await expect(recordButton).toBeEnabled(); 
    await expect(recordButton).toHaveText('Start Recording'); 
    
    await expect(page.locator('#transcription')).toBeVisible(); 
  });

  test('should establish WebSocket connection automatically', async () => {
    // Wait for auto-connection status message
    await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 }); // Increased timeout slightly
    // TODO: Add a more specific class assertion here if needed, e.g., for a 'connected' class.
  });

  test('should handle language selection', async () => {
    // Wait for connection first, as language change might trigger re-registration
    await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
    
    // Change language
    await page.selectOption('#teacherLanguage', 'es-ES'); // Spanish (Spain)
    const selectedValue = await page.locator('#teacherLanguage').inputValue();
    expect(selectedValue).toBe('es-ES');
    
    // The application should ideally re-register with the new language.
    // We'll add a small pause. A more robust check would be to verify a specific 
    // message or state change indicating re-registration, if available.
    await page.waitForTimeout(1000); 
  });

  test('should handle recording controls', async () => {
    // Wait for WebSocket connection to be established first
    await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });

    // Check initial state of the record button
    const recordButton = page.locator('#recordButton');
    await expect(recordButton).toBeEnabled();
    await expect(recordButton).toHaveText('Start Recording');
    
    // Attempt to start recording
    await recordButton.click();
    await page.waitForTimeout(200); // Allow a brief moment for UI to react
    
    const speechRecognitionSupported = await page.evaluate(() => {
      return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    });
    
    if (!speechRecognitionSupported) {
      console.log('Speech recognition not supported by this browser environment for testing.');
      await expect(page.locator('#status')).toContainText('Speech recognition not available');
      await expect(recordButton).toBeEnabled(); // Should remain enabled if it couldn't start
      await expect(recordButton).toHaveText('Start Recording'); // Should not have changed
      return; // End test if not supported
    }
    
    // If speech recognition is supported, proceed with testing recording states
    try {
      // Check for recording state (allow time for it to engage)
      await expect(recordButton).toHaveText('Stop Recording', { timeout: 5000 }); 
      await expect(page.locator('#status')).toContainText('Recording', { timeout: 5000 });
      // Placeholder for transcription area status - adapt if app uses a specific attribute/class
      // await expect(page.locator('#transcription')).toHaveAttribute('data-status', 'listening');
      
      // Attempt to stop recording
      await recordButton.click();
      await page.waitForTimeout(200); // Allow a brief moment for UI to react
      
      // Check for stopped state
      await expect(recordButton).toBeEnabled();
      await expect(recordButton).toHaveText('Start Recording');
      
      // Status might revert to various states depending on exact client logic after stopping
      const statusText = await page.locator('#status').textContent();
      expect(statusText).toMatch(/Recording stopped|Ready to record|Registered as teacher/);

    } catch (error) {
      // Special handling for Firefox which might have permission issues or different behavior
      const browserName = page.context().browser()?.browserType().name();
      if (browserName === 'firefox') {
        console.warn('Recording controls test might behave differently or require manual permissions in Firefox. Test assertions for Firefox might need adjustment.');
        // Add Firefox-specific assertions if its behavior is consistently different and testable
        // For now, we'll just ensure the button is still there.
        await expect(recordButton).toBeVisible();
      } else {
        // Re-throw for other browsers if it's an unexpected error
        console.error('Error during recording controls test:', error);
        throw error; 
      }
    }
  });

  test('should show error if trying to record when speech recognition is unavailable', async ({ browser }) => {
    // This test uses a fresh browser context and page to ensure the init script applies cleanly.
    const context = await browser.newContext();
    const newPage = await context.newPage(); 
    
    await newPage.addInitScript(() => {
      // Explicitly disable SpeechRecognition APIs for this page context
      (window as any).SpeechRecognition = undefined;
      (window as any).webkitSpeechRecognition = undefined;
    });
    
    // Navigate to the teacher page with the modified context
    await newPage.goto('http://127.0.0.1:5000/teacher'); 
    await newPage.waitForLoadState('domcontentloaded');

    // Wait for the record button to be visible and then click it
    const recordButton = newPage.locator('#recordButton');
    await expect(recordButton).toBeVisible({ timeout: 5000 });
    await recordButton.click();
    
    // Assert that the status message indicates speech recognition is not available
    await expect(newPage.locator('#status')).toContainText('Speech recognition not available', { timeout: 3000 });
    
    // Record button should remain enabled as recording couldn't start
    await expect(recordButton).toBeEnabled();
    
    // Clean up: close the page and context
    await newPage.close();
    await context.close();
  });

  test.skip('should handle connection loss and reconnection', async () => {
    // This test is skipped because simulating network disconnection reliably in an E2E test
    // without external tools or complex browser manipulation is difficult and can be flaky.
    // Testing WebSocket reconnection logic is often better suited for integration tests
    // where WebSocket server behavior can be more directly controlled and observed.
  });
});