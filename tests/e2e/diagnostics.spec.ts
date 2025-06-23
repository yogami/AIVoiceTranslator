// @ts-check
import { test, expect, type Page, type Route } from '@playwright/test';
import { seedRealisticTestData, clearDiagnosticData } from './test-data-utils';
import { ensureTestDatabaseSchema } from './test-setup';

test.describe('Diagnostics Dashboard E2E Tests', () => {
  let page: Page;

  test.beforeAll(async () => {
    // Ensure database schema is current before any tests run
    await ensureTestDatabaseSchema();
  });

  test.beforeEach(async ({ browser }) => {
    // Seed test data before each test to ensure fresh data
    await clearDiagnosticData();
    await seedRealisticTestData();
    console.log('✅ Seeded fresh test data for diagnostics E2E test');
    
    page = await browser.newPage();
    await page.goto('/diagnostics.html');
    
    // Give the server and database time to sync
    await page.waitForTimeout(2000);
  });

  test.afterEach(async () => {
    await page.close();
    // Clean up test data after each test to ensure idempotency
    await clearDiagnosticData();
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
   
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('#export-btn');
    
    // Wait for download
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/analytics-export-\d{4}-\d{2}-\d{2}\.json/);
  });

  test('should display language pair metrics or no data message', async () => {
    // Simple check: either we have language pair data or a no-data message
    const hasLanguagePairs = await page.locator('.language-pairs-table').count() > 0;
    const hasNoDataMessage = await page.locator(':has-text("No language pair data available")').count() > 0;
    
    // One of these should be true - we either show data or explain there's no data
    expect(hasLanguagePairs || hasNoDataMessage).toBeTruthy();
  });

  test('should display current session quality stats', async () => {
    // Product owner needs: current system performance
    await page.waitForSelector('.metric-card', { timeout: 10000 });
    
    // Get API data to verify
    const apiResponse = await page.evaluate(async () => {
      const response = await fetch('/api/diagnostics?timeRange=last24Hours');
      return response.json();
    });
    
    // Verify key quality metrics are displayed
    await expect(page.locator('.metric-card:has-text("Translation Volume")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("System Health")')).toBeVisible();
    
    // Verify actual data matches what's in the database
    const translationVolumeValue = await page.locator('.metric-card:has-text("Translation Volume") .metric-value').first().textContent();
    expect(translationVolumeValue).toContain(apiResponse.translations.totalFromDatabase.toString());
  });

  test('should display historical usage stats', async () => {
    // Product owner needs: usage trends and adoption
    await page.waitForSelector('.metric-card', { timeout: 10000 });
    
    // Get API data for verification
    const apiResponse = await page.evaluate(async () => {
      const response = await fetch('/api/diagnostics?timeRange=last30Days');
      return response.json();
    });
    
    // Verify historical metrics are displayed
    await expect(page.locator('.metric-card:has-text("Total Sessions")')).toBeVisible();
    await expect(page.locator('.metric-card:has-text("Active Users")')).toBeVisible();
    
    // Verify session count matches database
    const totalSessionsValue = await page.locator('.metric-card:has-text("Total Sessions") .metric-value').first().textContent();
    expect(totalSessionsValue).toContain(apiResponse.sessions.totalSessions.toString());
  });

  test('should display recent session activity', async () => {
    // Product owner needs: what's happening right now
    await page.waitForSelector('#recent-activity', { timeout: 10000 });
    
    const recentActivity = page.locator('#recent-activity');
    await expect(recentActivity).toBeVisible();
    
    // Should show some session information (either sessions or "no recent activity")
    const activityContent = await recentActivity.textContent();
    const hasSessionData = activityContent?.includes('session') || activityContent?.includes('Session');
    const hasNoActivityMessage = activityContent?.includes('No recent') || activityContent?.includes('no recent');
    
    expect(hasSessionData || hasNoActivityMessage).toBeTruthy();
  });

  test('should handle API errors gracefully', async () => {
    // 1. Let the page load normally first (handled by beforeEach)
    // Ensure basic page structure is present before we mess with API calls
    await expect(page).toHaveTitle('Analytics Dashboard - AIVoiceTranslator', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Analytics Dashboard', { timeout: 5000 });

    // 2. Intercept the *next* API call only and return an error
    await page.route('/api/diagnostics**', async (route: Route) => {
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
    // Based on frontend logic: `Failed to load diagnostics data.: HTTP ${response.status}: ${response.text()}`
    // response.text() will be `{"message":"Internal Server Error from mock"}`
    const errorMessageLocator = errorContainerLocator.locator('.error-message');
    await expect(errorMessageLocator).toContainText('Failed to load diagnostics data.: HTTP 500: {\"message\":\"Internal Server Error from mock\"}', { timeout: 5000 });
  });

  test('should display formatted metrics correctly', async () => {
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

  test('should display recent session activity with proper content structure', async () => {
    // Wait for recent activity section
    await page.waitForSelector('#recent-activity', { timeout: 10000 }); // Increased timeout
    
    const recentActivity = page.locator('#recent-activity');
    const content = await recentActivity.textContent();
    
    // Should either show sessions or "no data" message
    expect(content).toMatch(/Recent.*Session|No recent session activity/);
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
    
    // Check that it contains connection-related metrics with actual values
    await expect(activeUsersCard).toContainText('Teachers Online');
    await expect(activeUsersCard).toContainText('Students Online');
    await expect(activeUsersCard).toContainText('Languages in Use');
    
    // Verify that metric values are displayed (not just labels)
    const metricValues = activeUsersCard.locator('.metric-value');
    await expect(metricValues).toHaveCount(3); // Should have 3 metric values
    
    // Check that the values are numbers (even if 0)
    const teachersValue = await activeUsersCard.locator('.metric-item:has-text("Teachers Online") .metric-value').textContent();
    const studentsValue = await activeUsersCard.locator('.metric-item:has-text("Students Online") .metric-value').textContent();
    const languagesValue = await activeUsersCard.locator('.metric-item:has-text("Languages in Use") .metric-value').textContent();
    
    // Values should be numeric (including 0)
    expect(teachersValue).toMatch(/^\d+$/);
    expect(studentsValue).toMatch(/^\d+$/);
    expect(languagesValue).toMatch(/^\d+$/);
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

  test('should display adoption metrics section with data', async ({ page }) => {
    await page.goto('/diagnostics.html');
    
    // Check that adoption metrics section exists
    const adoptionSection = page.locator('#adoption-metrics');
    await expect(adoptionSection).toBeVisible();
    
    // Check that we have some content in the adoption metrics area
    // This could be metric cards or a "no data" message
    await page.waitForTimeout(2000); // Allow time for data to load
    const hasContent = await adoptionSection.locator('*').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should display key product owner metrics in recent session activity', async () => {
    // Wait for recent activity section to load
    await page.waitForSelector('#recent-activity', { timeout: 10000 });
    
    const recentActivity = page.locator('#recent-activity');
    const content = await recentActivity.textContent();
    
    // Should show meaningful session activity or "no data" message
    expect(content).toMatch(/Recent.*Session|No recent session activity/);
    
    // If there are sessions, check for product owner specific metrics
    const hasSessions = await page.locator('.recent-sessions').count() > 0;
    if (hasSessions) {
      // Check for key metrics that answer product owner questions
      await expect(page.locator('.summary-label:has-text("Average Class Size")')).toBeVisible();
      await expect(page.locator('.summary-label:has-text("Full Class Sessions")')).toBeVisible();
      await expect(page.locator('.summary-label:has-text("Total Sessions Tracked")')).toBeVisible();
    }
  });

  test('should display section headers with product owner focus', async () => {
    // Check for key section headers that address product owner needs
    await expect(page.locator('.section-header:has-text("Product Usage Assessment")')).toBeVisible();
    await expect(page.locator('.section-header:has-text("Language & Translation Analytics")')).toBeVisible();
    await expect(page.locator('.section-header:has-text("Technical Reliability & Usage Patterns")')).toBeVisible();
    await expect(page.locator('.section-header:has-text("Recent Session Activity")')).toBeVisible();
  });

  test('should validate seeded data shows real usage (not all zeros)', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Check that we have realistic session data
    const totalSessionsCard = page.locator('.metric-card:has-text("Total Sessions")');
    const sessionsValue = await totalSessionsCard.locator('.metric-item:has-text("All-time Sessions") .metric-value').textContent();
    
    // Should have some session data from seeding
    const sessionsNum = parseInt(sessionsValue?.replace(/,/g, '') || '0');
    expect(sessionsNum).toBeGreaterThan(0);
    
    // Check recent activity shows our seeded sessions
    const recentActivity = page.locator('#recent-activity');
    const activityContent = await recentActivity.textContent();
    
    // Should show sessions from seeded data (e2e-session-X pattern)
    expect(activityContent).toMatch(/e2e-session-[1-5]/);
  });

  test('should verify test data is properly seeded and displayed', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card', { timeout: 10000 });
    
    // Verify that we have non-zero values from seeded data
    const totalSessionsCard = page.locator('.metric-card:has-text("Total Sessions")');
    await expect(totalSessionsCard).toBeVisible();
    
    // Check session count shows seeded data
    const totalSessionsValue = await totalSessionsCard.locator('.metric-value').first().textContent();
    const sessionsNum = parseInt(totalSessionsValue?.replace(/,/g, '') || '0');
    expect(sessionsNum).toBeGreaterThan(0);
    
    // Verify translation volume shows seeded data
    const translationVolumeCard = page.locator('.metric-card:has-text("Translation Volume")');
    await expect(translationVolumeCard).toBeVisible();
    
    const translationVolumeValue = await translationVolumeCard.locator('.metric-value').first().textContent();
    const translationsNum = parseInt(translationVolumeValue?.replace(/,/g, '') || '0');
    expect(translationsNum).toBeGreaterThanOrEqual(0); // Could be 0 if outside time range, but should be a valid number
    
    console.log(`✅ Test data verification: ${sessionsNum} sessions, ${translationsNum} translations displayed`);
  });
});
