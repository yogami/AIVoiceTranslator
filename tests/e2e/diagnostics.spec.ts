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
