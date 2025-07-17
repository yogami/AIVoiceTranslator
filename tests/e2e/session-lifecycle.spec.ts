// @ts-check
import { test, expect } from '@playwright/test';
import { getAnalyticsURL } from './helpers/test-config';
import { seedRealisticTestData, clearDiagnosticData } from './test-data-utils';

/**
 * Session Lifecycle E2E Tests
 * 
 * Tests session lifecycle functionality through the analytics interface,
 * following the same pattern as analytics.spec.ts
 */

test.describe('Session Lifecycle E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await clearDiagnosticData();
    await seedRealisticTestData();
  });

  test.afterEach(async ({ page }) => {
    await clearDiagnosticData();
  });

  test('should validate session creation through analytics', async ({ page }) => {
    await page.goto(getAnalyticsURL());
    
    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.waitForSelector('#questionInput', { timeout: 5000 });
    
    // Query for session creation information
    await page.fill('#questionInput', 'How many sessions were created in the last hour?');
    await page.click('#askButton');
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Check that a response was added to the chat
    const messages = page.locator('.ai-message');
    await expect(messages).toHaveCount(1);
    
    // Verify the response contains some content
    const responseText = await messages.first().textContent();
    expect(responseText).toBeTruthy();
    expect(responseText?.length).toBeGreaterThan(10);
  });

  test('should verify session cleanup through analytics', async ({ page }) => {
    await page.goto(getAnalyticsURL());
    
    // Wait for page to load
    await page.waitForSelector('#questionInput', { timeout: 5000 });
    
    // Query for session cleanup information
    await page.fill('#questionInput', 'What sessions need cleanup and how many were cleaned up recently?');
    await page.click('#askButton');
    
    await page.waitForTimeout(2000);
    
    // Check that a response was generated
    const messages = page.locator('.ai-message');
    await expect(messages).toHaveCount(1);
    
    const response = await messages.first().textContent();
    expect(response).toBeTruthy();
  });

  test('should handle session lifecycle conversation through analytics', async ({ page }) => {
    await page.goto(getAnalyticsURL());
    
    // Wait for page to load
    await page.waitForSelector('#questionInput', { timeout: 5000 });
    
    // Simulate a conversation about session lifecycle
    const conversation = [
      'How many active sessions are there currently?',
      'What about sessions created in the last 24 hours?',
      'Show me sessions that need cleanup'
    ];
    
    for (let i = 0; i < conversation.length; i++) {
      await page.fill('#questionInput', conversation[i]);
      await page.click('#askButton');
      await page.waitForTimeout(2000);
      
      const messages = page.locator('.ai-message');
      await expect(messages).toHaveCount(i + 1);
    }
    
    // Verify all user messages are also displayed
    const userMessages = page.locator('.user-message');
    await expect(userMessages).toHaveCount(conversation.length);
  });
});
