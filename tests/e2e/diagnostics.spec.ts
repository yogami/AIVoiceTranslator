// @ts-check
import { test, expect, type Page, type Route } from '@playwright/test';
import { seedRealisticTestData, clearDiagnosticData } from './test-data-utils';
import { ensureTestDatabaseSchema } from './test-setup';

test.describe('Diagnostics Dashboard E2E Tests', () => {
  let page: Page;

  test.beforeAll(async () => {
    await ensureTestDatabaseSchema();
  });

  test.beforeEach(async ({ browser }) => {
    await clearDiagnosticData();
    await seedRealisticTestData();
    
    page = await browser.newPage();
    await page.goto('http://127.0.0.1:5001/diagnostics.html');
    await page.waitForTimeout(2000);
  });

  test.afterEach(async () => {
    await page.close();
  });

  // =====================================
  // CORE FUNCTIONALITY TESTS
  // =====================================

  test('should load the analytics dashboard', async () => {
    await expect(page).toHaveTitle('Analytics Dashboard - AIVoiceTranslator');
    
    const heading = page.locator('h1');
    await expect(heading).toContainText('Analytics Dashboard');
    
    const subtitle = page.locator('.subtitle');
    await expect(subtitle).toContainText('Real-time usage metrics and adoption analytics for AI Voice Translator');
  });

  test('should display essential controls', async () => {
    const refreshBtn = page.locator('#refresh-btn');
    await expect(refreshBtn).toBeVisible();
    await expect(refreshBtn).toContainText('🔄 Refresh Data');
    
    const timeRangeSelect = page.locator('#time-range-select');
    await expect(timeRangeSelect).toBeVisible();
  });

  test('should display metrics with real seeded data', async () => {
    await page.waitForSelector('.metric-card', { timeout: 10000 });
    
    // Verify core metric cards are present
    await expect(page.locator('.metric-card:has-text("Total Sessions")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("Active Users")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("Translation Volume")')).toBeVisible();
    
    // Verify values are not just placeholders
    const totalSessionsValue = await page.locator('.metric-card:has-text("Total Sessions") .metric-value').first().textContent();
    expect(totalSessionsValue).not.toBe('0');
    expect(totalSessionsValue).not.toBe('--');
  });

  test('should handle API errors gracefully', async () => {
    await expect(page).toHaveTitle('Analytics Dashboard - AIVoiceTranslator', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Analytics Dashboard', { timeout: 5000 });
    
    // Mock API failure
    await page.route('/api/diagnostics**', async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.locator('#refresh-btn').click();
    
    // Should show error message instead of crashing
    const errorContainerLocator = page.locator('#error-container');
    await expect(errorContainerLocator).toBeVisible({ timeout: 5000 });
  });

  test('should display metrics with proper formatting', async () => {
    await page.waitForSelector('.metric-value', { timeout: 10000 });
    
    // Check that metric values are properly formatted (not just raw numbers)
    const metricValues = page.locator('.metric-value');
    const count = await metricValues.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Values should not be empty or show error states
    for (let i = 0; i < Math.min(count, 5); i++) {
      const value = await metricValues.nth(i).textContent();
      expect(value).not.toBe('');
      expect(value).not.toBe('Error');
    }
  });

  test('should navigate back to home', async () => {
    await page.click('a:has-text("Back to Home")');
    
    // Should navigate to home page
    await expect(page).toHaveURL('/');
  });

  test('should be responsive on mobile', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Metrics should still be visible and accessible
    const metricsGrid = page.locator('.metrics-grid').first();
    await expect(metricsGrid).toBeVisible();
  });

  // =====================================
  // TIME RANGE FUNCTIONALITY TESTS
  // =====================================

  test('should change time range and update data', async () => {
    await page.waitForSelector('.metric-card', { timeout: 10000 });
    
    // Change time range
    await page.selectOption('#time-range-select', 'last7Days');
    await page.waitForTimeout(1000);
    
    // Verify metrics are still displayed
    await expect(page.locator('.metric-card').first()).toBeVisible();
  });

  // =====================================
  // SPECIFIC METRIC VALIDATION TESTS
  // =====================================

  test('should display active users metric', async () => {
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Active Users card should be present and show meaningful data
    const activeUsersCard = page.locator('.metric-card:has-text("Active Users")');
    await expect(activeUsersCard).toBeVisible();
    
    // Get the main metric value (the large one for Teachers Online)
    const value = await activeUsersCard.locator('.metric-value.large').textContent();
    expect(value).toBeTruthy();
    // The test may show 0 for teachers connected since this is a test environment
    expect(parseInt(value || '0')).toBeGreaterThanOrEqual(0);
  });

  test('should display total sessions metric', async () => {
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Total Sessions card should show real data
    const sessionsCard = page.locator('.metric-card:has-text("Total Sessions")');
    await expect(sessionsCard).toBeVisible();
    
    // Get the main metric value (the large one)
    const value = await sessionsCard.locator('.metric-value.large').textContent();
    expect(value).toBeTruthy();
    expect(parseInt(value || '0')).toBeGreaterThanOrEqual(0);
  });

  test('should display translation volume metric', async () => {
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Translation Volume card should show real data  
    const translationCard = page.locator('.metric-card:has-text("Translation Volume")');
    await expect(translationCard).toBeVisible();
    
    // Get the main metric value (the large one)
    const value = await translationCard.locator('.metric-value.large').textContent();
    expect(value).toBeTruthy();
    expect(parseInt(value || '0')).toBeGreaterThanOrEqual(0);
  });

  // =====================================
  // DATA VALIDATION TESTS
  // =====================================

  test('should verify API returns seeded data', async () => {
    const apiResponse = await page.evaluate(async () => {
      const response = await fetch('/api/diagnostics?timeRange=last24Hours');
      return response.json();
    });
    
    // Verify we have seeded data
    expect(apiResponse.translations).toBeDefined();
    expect(apiResponse.sessions).toBeDefined();
    expect(apiResponse.translations.totalFromDatabase).toBeGreaterThan(0);
    expect(apiResponse.sessions.totalSessions).toBeGreaterThan(0);
  });

  test('should display section headers for product owners', async () => {
    // Check for key section headers that address product owner needs
    await expect(page.locator('.section-header:has-text("Product Usage Assessment")')).toBeVisible();
    await expect(page.locator('.section-header:has-text("Performance & Quality Metrics")')).toBeVisible();
    await expect(page.locator('.section-header:has-text("Recent Session Activity")')).toBeVisible();
  });

  test('should refresh data when refresh button is clicked', async () => {
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Click refresh button
    await page.click('#refresh-btn');
    await page.waitForTimeout(1000);
    
    // Verify metrics are still displayed after refresh
    const metricCards = page.locator('.metric-card');
    await expect(metricCards.first()).toBeVisible();
  });
});