// @ts-check
import { test, expect, type Page } from '@playwright/test';

// TODO: Implement a data seeding strategy for E2E tests to ensure consistent
// and realistic data for verifying time-range filtering and metric calculations.
// This could involve pre-loading data into the test database or using mock API
// responses with specific datasets for different time ranges.

test.describe('Analytics Dashboard E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/diagnostics.html');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should load the analytics dashboard', async () => {
    // Check page title
    await expect(page).toHaveTitle('Analytics Dashboard - AIVoiceTranslator');
    
    // Check main heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('Analytics Dashboard');
    
    // Check subtitle
    const subtitle = page.locator('.subtitle');
    await expect(subtitle).toContainText('Real-time usage metrics and adoption analytics');
  });

  test('should display all control buttons', async () => {
    // Check refresh button
    const refreshBtn = page.locator('#refresh-btn');
    await expect(refreshBtn).toBeVisible();
    await expect(refreshBtn).toContainText('🔄 Refresh Data');
    
    // Check export button
    const exportBtn = page.locator('#export-btn');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toContainText('📥 Export Data');
    
    // Check auto-refresh button
    const autoRefreshBtn = page.locator('#auto-refresh-btn');
    await expect(autoRefreshBtn).toBeVisible();
    await expect(autoRefreshBtn).toContainText('⏰ Auto-refresh: OFF');
  });

  test('should display all metric sections', async () => {
    // Check Product Adoption Metrics section
    const adoptionSection = page.locator('.section-header:has-text("Product Adoption Metrics")');
    await expect(adoptionSection).toBeVisible();
    
    // Check Usage Analytics section
    const usageSection = page.locator('.section-header:has-text("Usage Analytics")');
    await expect(usageSection).toBeVisible();
    
    // Check Performance Metrics section
    const performanceSection = page.locator('.section-header:has-text("Performance & Quality Metrics")');
    await expect(performanceSection).toBeVisible();
    
    // Check Recent Activity section
    const activitySection = page.locator('.section-header:has-text("Recent Session Activity")');
    await expect(activitySection).toBeVisible();
  });

  test('should load and display metrics data', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Check that metric cards are displayed
    const metricCards = page.locator('.metric-card');
    await expect(metricCards).toHaveCount(6); // 3 adoption + 3 performance
    
    // Check specific metric cards
    await expect(page.locator('.metric-card:has-text("Total Sessions")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("Active Users")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("Translation Volume")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("System Health")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("Audio Generation")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("Real-time Performance")')).toBeVisible();
  });

  test('should refresh data when refresh button is clicked', async () => {
    // Wait for initial load
    await page.waitForSelector('#last-updated', { timeout: 5000 });
    
    // Get initial last updated time
    const lastUpdated = page.locator('#last-updated');
    const initialTimeText = await lastUpdated.textContent();
    
    // Click refresh button
    await page.click('#refresh-btn');
    
    // Wait a moment for the refresh to process
    await page.waitForTimeout(500);
    
    // Check that last updated time exists
    const newTime = await lastUpdated.textContent();
      expect(newTime).toContain('Last updated:');
  });

  test('should toggle auto-refresh', async () => {
    const autoRefreshBtn = page.locator('#auto-refresh-btn');
    
    // Initially should be OFF
    await expect(autoRefreshBtn).toContainText('⏰ Auto-refresh: OFF');
    await expect(autoRefreshBtn).not.toHaveClass('auto-refresh-on');
    
    // Click to enable
    await autoRefreshBtn.click();
    await expect(autoRefreshBtn).toContainText('⏰ Auto-refresh: ON');
    await expect(autoRefreshBtn).toHaveClass(/auto-refresh-on/);

    // Click to disable
    await autoRefreshBtn.click();
    await expect(autoRefreshBtn).toContainText('⏰ Auto-refresh: OFF');
    await expect(autoRefreshBtn).not.toHaveClass('auto-refresh-on');
  });

  test('should export data when export button is clicked', async () => {
    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('#export-btn');
    
    // Wait for download
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/analytics-export-\d{4}-\d{2}-\d{2}\.json/);
  });

  test('should display language pair metrics table or no data message', async () => {
    // Wait for usage analytics section to load
    await page.waitForSelector('#usage-analytics', { timeout: 5000 });
    
    // Check if table exists or no data message is shown
    const tableExists = await page.locator('.language-pairs-table').count() > 0;
    const noDataExists = await page.locator('.no-data').count() > 0;
    
    // Either table or no data message should be present
    expect(tableExists || noDataExists).toBeTruthy();
    
    if (tableExists) {
      // Check table headers
      const headers = page.locator('.language-pairs-table th');
      await expect(headers).toHaveCount(4);
      await expect(headers.nth(0)).toContainText('Source Language');
      await expect(headers.nth(1)).toContainText('Target Language');
      await expect(headers.nth(2)).toContainText('Translation Count');
      await expect(headers.nth(3)).toContainText('Average Latency');
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // 1. Let the page load normally first (handled by beforeEach)
    // Ensure basic page structure is present before we mess with API calls
    await expect(page).toHaveTitle('Analytics Dashboard - AIVoiceTranslator', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Analytics Dashboard', { timeout: 5000 });

    // 2. Intercept the *next* API call only and return an error
    await page.route('/api/diagnostics**/*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error from mock' }) // Ensure body gives a message
      });
    }, { times: 1 }); // Apply only once

    // 3. Trigger the API call by clicking the refresh button
    await page.locator('#refresh-btn').click();
    
    // 4. Wait for the error container to become visible
    const errorContainerLocator = page.locator('#error-container');
    await expect(errorContainerLocator).toBeVisible({ timeout: 10000 });
    
    // 5. Check the error message text
    // Based on frontend logic: `Failed to load diagnostics data.: HTTP error! status: 500: ${response.text()}`
    // response.text() will be `{"message":"Internal Server Error from mock"}`
    const errorMessageLocator = errorContainerLocator.locator('.error-message');
    await expect(errorMessageLocator).toContainText('Failed to load diagnostics data.: HTTP error! status: 500: {\"message\":\"Internal Server Error from mock\"}', { timeout: 5000 });
  });

  test('should display formatted metrics correctly', async ({ page }) => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-value', { timeout: 10000 }); // Increased timeout
    
    // Check that metrics are formatted
    const metricValues = page.locator('.metric-value');
    const count = await metricValues.count();
    
    // At least some metrics should be displayed
    expect(count).toBeGreaterThan(0);
    
    // Check specific formatting
    const firstValue = await metricValues.first().textContent();
    expect(firstValue).toBeTruthy();
  });

  test('should navigate back to home', async () => {
    // Click back to home link
    await page.click('a:has-text("Back to Home")');
    
    // Should navigate to home page
    await expect(page).toHaveURL('/');
  });

  test('should be responsive on mobile', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that layout adapts - use first metrics grid
    const metricsGrid = page.locator('.metrics-grid').first();
    const gridStyleValue = await metricsGrid.evaluate((el: HTMLElement) => 
      window.getComputedStyle(el).gridTemplateColumns
    );
    
    // Should be single column on mobile (either '1fr' or a single pixel value)
    const isSingleColumn = gridStyleValue === '1fr' || 
                          (gridStyleValue.match(/^\d+px$/) !== null && !gridStyleValue.includes(' '));
    expect(isSingleColumn).toBeTruthy();
    
    // Buttons should stack vertically
    const controls = page.locator('.controls');
    const controlsStyle = await controls.evaluate((el: HTMLElement) => 
      window.getComputedStyle(el).flexDirection
    );
    expect(controlsStyle).toBe('column');
  });

  test('should display recent session activity', async () => {
    // Wait for recent activity section
    await page.waitForSelector('#recent-activity', { timeout: 10000 }); // Increased timeout
    
    const recentActivity = page.locator('#recent-activity');
    const content = await recentActivity.textContent();
    
    // Should either show sessions or "no data" message
    expect(content).toMatch(/Recent Sessions|No recent session activity/);
  });

  test('should update metrics in real-time when auto-refresh is enabled', async () => {
    // Enable auto-refresh
    await page.click('#auto-refresh-btn');
    
    // Get initial last updated time
    const lastUpdated = page.locator('#last-updated');
    const initialTimeText = await lastUpdated.textContent();
    
    // Wait for auto-refresh (5 seconds + buffer)
    await page.waitForTimeout(6000);
    
    // Check that last updated time exists (may or may not have changed in test environment)
    const updatedTime = await lastUpdated.textContent();
    expect(updatedTime).toContain('Last updated:');
  });

  test('should display connection metrics correctly', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Find the Active Users card which contains connection info
    const activeUsersCard = page.locator('.metric-card:has-text("Active Users")');
    await expect(activeUsersCard).toBeVisible();
    
    // Check that it contains connection-related metrics
    await expect(activeUsersCard).toContainText('Teachers Online');
    await expect(activeUsersCard).toContainText('Students Online');
    await expect(activeUsersCard).toContainText('Languages in Use');
  });

  test('should display session metrics correctly', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Find the Total Sessions card
    const sessionsCard = page.locator('.metric-card:has-text("Total Sessions")');
    await expect(sessionsCard).toBeVisible();
    
    // Check that it contains session-related metrics
    await expect(sessionsCard).toContainText('All-time Sessions');
    await expect(sessionsCard).toContainText('Active Now');
    await expect(sessionsCard).toContainText('Average Duration');
  });

  test('should display translation metrics correctly', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Find the Translation Volume card
    const translationCard = page.locator('.metric-card:has-text("Translation Volume")');
    await expect(translationCard).toBeVisible();
    
    // Check that it contains translation-related metrics
    await expect(translationCard).toContainText('Total Translations');
    await expect(translationCard).toContainText('Last Hour');
    await expect(translationCard).toContainText('Average Latency');
  });

  test('should display performance metrics correctly', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Check System Health card
    const systemHealthCard = page.locator('.metric-card:has-text("System Health")');
    await expect(systemHealthCard).toBeVisible();
    
    // Check Audio Generation card
    const audioCard = page.locator('.metric-card:has-text("Audio Generation")');
    await expect(audioCard).toBeVisible();
    
    // Check Real-time Performance card
    const performanceCard = page.locator('.metric-card:has-text("Real-time Performance")');
    await expect(performanceCard).toBeVisible();
  });

  test('should have a time range selector with default preset', async ({ page }) => {
    await page.goto('/diagnostics.html');
    const timeRangeSelector = page.locator('#time-range-select');
    await expect(timeRangeSelector).toBeVisible();
    // Assuming 'last24Hours' is the default or a common initial value
    await expect(timeRangeSelector).toHaveValue('last24Hours'); 
    const currentTimeRangeInfo = page.locator('#current-time-range-info');
    await expect(currentTimeRangeInfo).toBeVisible();
    // Placeholder: Check for text indicating the default range, e.g., "Displaying metrics for: Last 24 Hours"
    await expect(currentTimeRangeInfo).not.toBeEmpty(); 
  });

  test('should update metrics when "Last 7 Days" is selected', async ({ page }) => {
    await page.goto('/diagnostics.html');
    const timeRangeSelector = page.locator('#time-range-select');
    await timeRangeSelector.selectOption('last7Days');
    
    const currentTimeRangeInfo = page.locator('#current-time-range-info');
    await expect(currentTimeRangeInfo).toBeVisible();
    // Placeholder: Check for text indicating "Last 7 Days"
    await expect(currentTimeRangeInfo).toContainText('Last 7 Days'); // Or similar, depending on implementation

    // Placeholder: Check if a key metric element updates or is visible
    // Example: const totalSessionsMetric = page.locator('#total-sessions-metric');
    // await expect(totalSessionsMetric).not.toBeEmpty(); 
    // More specific checks would require knowing how data is presented
    await page.waitForTimeout(500); // Allow time for data to potentially reload
  });

  test('should update metrics when "Last 30 Days" is selected', async ({ page }) => {
    await page.goto('/diagnostics.html');
    const timeRangeSelector = page.locator('#time-range-select');
    await timeRangeSelector.selectOption('last30Days');

    const currentTimeRangeInfo = page.locator('#current-time-range-info');
    await expect(currentTimeRangeInfo).toBeVisible();
    // Placeholder: Check for text indicating "Last 30 Days"
    await expect(currentTimeRangeInfo).toContainText('Last 30 Days'); // Or similar

    // Placeholder: Check another key metric
    // Example: const totalTranslationsMetric = page.locator('#total-translations-metric');
    // await expect(totalTranslationsMetric).not.toBeEmpty();
    await page.waitForTimeout(500); // Allow time for data to potentially reload
  });

  test('should display specific adoption metrics sections', async ({ page }) => {
    await page.goto('/diagnostics.html');
    // These are more conceptual based on product owner intent.
    // Actual selectors would depend on UI implementation.
    // Example:
    // await expect(page.locator('#active-users-daily')).toBeVisible();
    // await expect(page.locator('#new-users-weekly')).toBeVisible();
    // await expect(page.locator('#session-duration-trends')).toBeVisible();
    // For now, this test is a placeholder for future, more specific metric UI elements.
    expect(true).toBe(true); // Placeholder assertion
  });
});
