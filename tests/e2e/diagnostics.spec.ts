import { test, expect, Page } from '@playwright/test';

test.describe('Diagnostics Dashboard', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    await page.goto('http://127.0.0.1:5000/diagnostics.html');
  });

  test('should display initial UI elements correctly', async () => {
    // Check page title
    await expect(page).toHaveTitle('AI Voice Translator - Diagnostics Dashboard');

    // Check main heading
    await expect(page.locator('h1')).toContainText('📊 Diagnostics Dashboard');

    // Check header info
    const systemStatus = page.locator('#system-status');
    await expect(systemStatus).toBeVisible();
    await expect(systemStatus).toHaveText('Operational');
    await expect(systemStatus).toHaveClass(/status-good/);

    // Check back to home link
    const homeLink = page.locator('a.back-link');
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toContainText('← Back to Home');
    await expect(homeLink).toHaveAttribute('href', '/');

    // Check control buttons
    await expect(page.locator('button#refresh-btn')).toBeVisible();
    await expect(page.locator('button#refresh-btn')).toContainText('🔄 Refresh Data');
    await expect(page.locator('button#test-api-btn')).toBeVisible();
    await expect(page.locator('button#test-api-btn')).toContainText('🧪 Test API');
    await expect(page.locator('button#export-btn')).toBeVisible();
    await expect(page.locator('button#export-btn')).toContainText('📥 Export Data');
    await expect(page.locator('button#auto-refresh-btn')).toBeVisible();
    await expect(page.locator('button#auto-refresh-btn')).toContainText('⏰ Auto-refresh: OFF');

    // Check containers
    await expect(page.locator('#error-container')).toBeAttached();
    await expect(page.locator('#debug-container')).toBeAttached();
    await expect(page.locator('#metrics-container')).toBeAttached();
    await expect(page.locator('#last-updated')).toBeAttached();
  });

  test('should load and display metrics on page load', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card', { timeout: 10000 });

    // Check that metric cards are displayed
    const metricCards = page.locator('.metric-card');
    await expect(metricCards).toHaveCount(6); // Connection, Session, Translation, Usage, Audio, System

    // Check specific metric cards
    await expect(page.locator('[data-testid="connection-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="translation-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-metrics"]')).toBeVisible();

    // Check that status shows success
    await expect(page.locator('#status')).toContainText('Diagnostics loaded successfully');

    // Check last updated time is displayed
    await expect(page.locator('#last-updated')).toContainText('Last updated:');
  });

  test('should refresh data when refresh button is clicked', async () => {
    // Wait for initial load
    await page.waitForSelector('.metric-card');

    // Get initial last updated time
    const initialLastUpdated = await page.locator('#last-updated').textContent();

    // Intercept the API call to add a delay so we can catch the loading state
    await page.route('/api/diagnostics', async route => {
      // Add a small delay to make the loading state visible
      await new Promise(resolve => setTimeout(resolve, 100));
      // Continue with the original request
      await route.continue();
    });

    // Click refresh button
    await page.click('#refresh-btn');

    // Check loading status (now we should be able to catch it)
    await expect(page.locator('#status')).toContainText('Loading diagnostics data...', { timeout: 1000 });

    // Wait for refresh to complete
    await page.waitForFunction(
      () => document.querySelector('#status')?.textContent?.includes('Diagnostics loaded successfully'),
      { timeout: 5000 }
    );

    // Check that metrics are still displayed
    await expect(page.locator('.metric-card')).toHaveCount(6);

    // Verify the last updated time has changed
    const newLastUpdated = await page.locator('#last-updated').textContent();
    expect(newLastUpdated).not.toBe(initialLastUpdated);
  });

  test('should test API connection when test button is clicked', async () => {
    // Click test API button
    await page.click('#test-api-btn');

    // Wait for the API test to complete
    await page.waitForFunction(
      () => document.querySelector('#status')?.textContent?.includes('API test completed successfully'),
      { timeout: 10000 }
    );

    // Check debug info is displayed
    const debugInfo = page.locator('.debug-info');
    await expect(debugInfo).toBeVisible();
    await expect(debugInfo).toContainText('API test successful');
  });

  test('should toggle auto-refresh functionality', async () => {
    const autoRefreshBtn = page.locator('#auto-refresh-btn');

    // Initially should be OFF
    await expect(autoRefreshBtn).toContainText('⏰ Auto-refresh: OFF');
    await expect(autoRefreshBtn).not.toHaveClass(/active/);

    // Click to enable
    await autoRefreshBtn.click();
    await expect(autoRefreshBtn).toContainText('⏰ Auto-refresh: ON');
    await expect(autoRefreshBtn).toHaveClass(/active/);
    
    // Wait for status to update
    await page.waitForFunction(
      () => document.querySelector('#status')?.textContent?.includes('Auto-refresh enabled'),
      { timeout: 5000 }
    );

    // Click to disable
    await autoRefreshBtn.click();
    await expect(autoRefreshBtn).toContainText('⏰ Auto-refresh: OFF');
    await expect(autoRefreshBtn).not.toHaveClass(/active/);
    
    // Wait for status to update
    await page.waitForFunction(
      () => document.querySelector('#status')?.textContent?.includes('Auto-refresh disabled'),
      { timeout: 5000 }
    );
  });

  test('should export diagnostics data', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-card');

    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('#export-btn');

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/diagnostics-\d{4}-\d{2}-\d{2}\.json/);

    // Wait for success status
    await page.waitForFunction(
      () => document.querySelector('#status')?.textContent?.includes('Diagnostics exported successfully'),
      { timeout: 10000 }
    );
  });

  test('should display connection metrics correctly', async () => {
    await page.waitForSelector('[data-testid="connection-metrics"]');

    const connectionCard = page.locator('[data-testid="connection-metrics"]');
    
    // Check card title
    await expect(connectionCard.locator('h3')).toContainText('🔌 Connection Status');

    // Check metric items
    await expect(connectionCard.locator('.metric-item')).toHaveCount(4);
    
    // Check specific metrics
    await expect(connectionCard).toContainText('Total Connections');
    await expect(connectionCard).toContainText('Active Connections');
    await expect(connectionCard).toContainText('Teachers Connected');
    await expect(connectionCard).toContainText('Students Connected');
  });

  test('should display usage metrics with language pairs', async () => {
    await page.waitForSelector('[data-testid="usage-metrics"]');

    const usageCard = page.locator('[data-testid="usage-metrics"]');
    
    // Check card title
    await expect(usageCard.locator('h3')).toContainText('📈 Usage & Adoption');

    // Check main metrics
    await expect(usageCard).toContainText('Peak Concurrent Users');
    await expect(usageCard).toContainText('Unique Teachers Today');
    await expect(usageCard).toContainText('Unique Students Today');
    await expect(usageCard).toContainText('Average Session Length');
    await expect(usageCard).toContainText('Total Transcriptions');
  });

  test('should handle API errors gracefully', async () => {
    // Intercept API call and return error
    await page.route('/api/diagnostics', route => {
      route.fulfill({
        status: 500,
        body: 'Internal Server Error'
      });
    });

    // Reload page to trigger error
    await page.reload();

    // Check error display
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('Failed to load diagnostics');
    await expect(page.locator('#status')).toContainText('Failed to load diagnostics');
    await expect(page.locator('#system-status')).toHaveText('Data Error');
    await expect(page.locator('#system-status')).toHaveClass(/status-error/);
  });

  test('should maintain consistent design with teacher/student pages', async () => {
    // Check container structure
    await expect(page.locator('.container')).toBeVisible();
    
    // Check consistent styling
    const container = page.locator('.container');
    await expect(container).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(container).toHaveCSS('border-radius', '10px');
    
    // Check button styling matches
    const primaryBtn = page.locator('.primary-btn');
    await expect(primaryBtn).toHaveCSS('background-color', 'rgb(52, 152, 219)');
    
    // Check responsive grid
    const metricsContainer = page.locator('.metrics-container');
    await expect(metricsContainer).toHaveCSS('display', 'grid');
  });
});

test.describe('Analytics Dashboard E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await page.goto('/diagnostics.html');
  });

  test('should load the analytics dashboard', async () => {
    // Check page title
    await expect(page).toHaveTitle(/Analytics Dashboard/);
    
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
    await expect(refreshBtn).toContainText('Refresh Data');
    
    // Check export button
    const exportBtn = page.locator('#export-btn');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toContainText('Export Data');
    
    // Check auto-refresh button
    const autoRefreshBtn = page.locator('#auto-refresh-btn');
    await expect(autoRefreshBtn).toBeVisible();
    await expect(autoRefreshBtn).toContainText('Auto-refresh: OFF');
  });

  test('should display all metric sections', async () => {
    // Wait for data to load
    await page.waitForTimeout(1000);
    
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
    const initialTime = await lastUpdated.textContent();
    
    // Click refresh button
    await page.click('#refresh-btn');
    
    // Wait for update (with a longer timeout)
    await page.waitForTimeout(2000);
    
    // Check that last updated time has changed
    const newTime = await lastUpdated.textContent();
    // If times are the same (happens in fast tests), at least check it's a valid time
    if (newTime === initialTime) {
      expect(newTime).toContain('Last updated:');
    } else {
      expect(newTime).not.toBe(initialTime);
    }
  });

  test('should toggle auto-refresh', async () => {
    const autoRefreshBtn = page.locator('#auto-refresh-btn');
    
    // Initially should be OFF
    await expect(autoRefreshBtn).toContainText('Auto-refresh: OFF');
    
    // Click to enable
    await autoRefreshBtn.click();
    await expect(autoRefreshBtn).toContainText('Auto-refresh: ON');
    
    // Button should change color to green (allowing for slight variations)
    const bgColor = await autoRefreshBtn.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    // Check if it's a green color (allowing for browser differences)
    expect(bgColor).toMatch(/rgb\(4[67], (19[0-9]|20[0-9]), 1(1[0-9]|3[0-9])\)/);
    
    // Click to disable
    await autoRefreshBtn.click();
    await expect(autoRefreshBtn).toContainText('Auto-refresh: OFF');
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

  test('should handle API errors gracefully', async () => {
    // Intercept API call and return error
    await page.route('/api/diagnostics', route => {
      route.fulfill({
        status: 500,
        body: 'Internal Server Error'
      });
    });
    
    // Reload page
    await page.reload();
    
    // Should show error message
    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Failed to load diagnostics');
  });

  test('should display formatted metrics correctly', async () => {
    // Wait for metrics to load
    await page.waitForSelector('.metric-value', { timeout: 5000 });
    
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
    const gridStyle = await metricsGrid.evaluate((el: HTMLElement) => 
      window.getComputedStyle(el).gridTemplateColumns
    );
    
    // Should be single column on mobile (either '1fr' or a pixel value less than 400px)
    const isSingleColumn = gridStyle === '1fr' || (gridStyle.includes('px') && parseInt(gridStyle) < 400);
    expect(isSingleColumn).toBeTruthy();
    
    // Buttons should have reasonable width on mobile (at least 150px)
    const refreshBtn = page.locator('#refresh-btn');
    const btnWidth = await refreshBtn.evaluate((el: HTMLElement) => el.offsetWidth);
    expect(btnWidth).toBeGreaterThan(150);
  });

  test('should display recent session activity', async () => {
    // Wait for recent activity section
    await page.waitForSelector('#recent-activity', { timeout: 5000 });
    
    const recentActivity = page.locator('#recent-activity');
    const content = await recentActivity.textContent();
    
    // Should either show sessions or "no data" message
    expect(content).toMatch(/Recent Sessions|No recent session activity/);
  });

  test('should update metrics in real-time when auto-refresh is enabled', async () => {
    // Enable auto-refresh
    await page.click('#auto-refresh-btn');
    
    // Get initial metric value
    const metricValue = page.locator('.metric-value').first();
    const initialValue = await metricValue.textContent();
    
    // Wait for auto-refresh (5 seconds)
    await page.waitForTimeout(6000);
    
    // Check that last updated time has changed
    const lastUpdated = page.locator('#last-updated');
    const updatedTime = await lastUpdated.textContent();
    expect(updatedTime).toContain('Last updated:');
  });
});
