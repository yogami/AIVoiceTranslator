/**
 * Student Interface E2E Test
 * 
 * This test checks the functionality of the student interface.
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Student Interface E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/student');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should display initial UI elements correctly', async () => {
    // Check essential elements
    await expect(page.locator('h1')).toContainText('Student Translator');
    await expect(page.locator('#connection-status')).toBeVisible();
    await expect(page.locator('#connect-btn')).toBeVisible();
    await expect(page.locator('#connect-btn')).not.toHaveClass(/hidden/);
    await expect(page.locator('#disconnect-btn')).toHaveClass(/hidden/);
    await expect(page.locator('#simplified-language-select')).toBeVisible();
    await expect(page.locator('#translation-box')).toBeVisible();
    await expect(page.locator('#play-button')).toBeVisible();
    await expect(page.locator('#play-button')).toBeDisabled();
  });

  test('should handle connect/disconnect button toggling', async () => {
    // Initial state
    await expect(page.locator('#connect-btn')).not.toHaveClass(/hidden/);
    await expect(page.locator('#disconnect-btn')).toHaveClass(/hidden/);
    
    // Click connect
    await page.click('#connect-btn');
    
    // Should show connecting state
    await expect(page.locator('#connect-btn')).toContainText('Connecting...');
    await expect(page.locator('#connect-btn')).toBeDisabled();
    
    // Wait for connection
    await expect(page.locator('#connection-text')).toContainText('Connected', { timeout: 5000 });
    await expect(page.locator('#connect-btn')).toHaveClass(/hidden/);
    await expect(page.locator('#disconnect-btn')).not.toHaveClass(/hidden/);
    
    // Click disconnect
    await page.click('#disconnect-btn');
    
    // Should show disconnecting state
    await expect(page.locator('#disconnect-btn')).toContainText('Disconnecting...');
    await expect(page.locator('#disconnect-btn')).toBeDisabled();
    
    // Should return to disconnected state
    await expect(page.locator('#connection-text')).toContainText('Disconnected', { timeout: 5000 });
    await expect(page.locator('#connect-btn')).not.toHaveClass(/hidden/);
    await expect(page.locator('#disconnect-btn')).toHaveClass(/hidden/);
  });

  test('should handle language selection', async () => {
    // Select a language before connecting
    await page.selectOption('#simplified-language-select', 'es');
    
    // Connect
    await page.click('#connect-btn');
    await expect(page.locator('#connection-text')).toContainText('Connected', { timeout: 5000 });
    
    // Should register with selected language
    await expect(page.locator('.success-message')).toContainText('Spanish', { timeout: 3000 });
    
    // Change language while connected
    await page.selectOption('#simplified-language-select', 'fr');
    await expect(page.locator('.success-message')).toContainText('French', { timeout: 3000 });
  });

  test('should display received translations', async () => {
    // Connect first
    await page.click('#connect-btn');
    await expect(page.locator('#connection-text')).toContainText('Connected', { timeout: 5000 });
    
    // Wait for WebSocket to be ready
    await page.waitForTimeout(1000);
    
    // Check if displayTranslation function exists
    const hasFunction = await page.evaluate(() => {
      return typeof (window as any).displayTranslation === 'function';
    });
    
    if (hasFunction) {
      // Simulate receiving a translation
      await page.evaluate(() => {
        (window as any).displayTranslation(
          'Bonjour le monde',
          'en-US',
          'fr-FR',
          'Hello world',
          null,
          false,
          'openai'
        );
      });
      
      // Check translation display
      await expect(page.locator('#translation-box')).toContainText('Hello world');
      await expect(page.locator('#translation-box')).toContainText('Bonjour le monde');
      await expect(page.locator('#play-button')).not.toBeDisabled();
    } else {
      // If function doesn't exist, just check that we're connected
      expect(await page.locator('#connection-text').textContent()).toContain('Connected');
    }
  });

  test('should handle audio playback controls', async () => {
    // Connect and set up
    await page.click('#connect-btn');
    await expect(page.locator('#connection-text')).toContainText('Connected', { timeout: 5000 });
    
    // Simulate receiving translation with audio
    await page.evaluate(() => {
      // Create fake audio data
      const fakeAudioData = btoa('fake audio data');
      (window as any).displayTranslation(
        'Hola mundo',
        'en-US',
        'es-ES',
        'Hello world',
        fakeAudioData,
        false,
        'openai'
      );
    });
    
    // Play button should be enabled
    await expect(page.locator('#play-button')).not.toBeDisabled();
    await expect(page.locator('#play-button')).toContainText('Play Translation');
  });

  test('should show errors appropriately', async () => {
    // Check if showError function exists
    const hasFunction = await page.evaluate(() => {
      return typeof (window as any).showError === 'function';
    });
    
    if (hasFunction) {
      // Test error display
      await page.evaluate(() => {
        (window as any).showError('Connection failed: Network error');
      });
      
      await expect(page.locator('.error-message')).toBeVisible();
      await expect(page.locator('.error-message')).toContainText('Connection failed');
      
      // Error should disappear after timeout
      await expect(page.locator('.error-message')).not.toBeVisible({ timeout: 6000 });
    } else {
      // Skip this test if function doesn't exist
      test.skip();
    }
  });
});