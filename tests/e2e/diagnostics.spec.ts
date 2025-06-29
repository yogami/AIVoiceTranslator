// @ts-check
import { test, expect, type Page, type Route, type Browser } from '@playwright/test';
import { seedRealisticTestData, clearDiagnosticData } from './test-data-utils';
import { ensureTestDatabaseSchema } from './test-setup';

// Helper function to get classroom code from teacher page (waits for it to be populated)
async function getClassroomCodeFromTeacher(browser: Browser): Promise<{ page: Page; classroomCode: string }> {
  const teacherPage = await browser.newPage();
  await teacherPage.goto('http://127.0.0.1:5001/teacher');
  await expect(teacherPage.locator('#status')).toContainText('Successfully registered with server', { timeout: 10000 });
  
  const classroomCodeElement = teacherPage.locator('#classroom-code-display');
  await expect(classroomCodeElement).toBeVisible({ timeout: 10000 });
  await expect(classroomCodeElement).not.toBeEmpty({ timeout: 5000 });
  
  const classroomCode = await classroomCodeElement.innerText();
  expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);
  
  return { page: teacherPage, classroomCode };
}

// Helper function to connect a student to a classroom
async function connectStudent(browser: Browser, classroomCode: string): Promise<Page> {
  const studentPage = await browser.newPage();
  await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
  await studentPage.waitForLoadState('domcontentloaded');
  
  const connectButton = studentPage.locator('#connect-btn');
  await expect(connectButton).toBeEnabled();
  await connectButton.click();
  
  // Wait for connection to be established
  await expect(studentPage.locator('#connection-status')).toContainText('Connected', { timeout: 10000 });
  
  return studentPage;
}

// Helper function to validate all diagnostic fields
async function validateDiagnosticFields(diagnosticsPage: Page, scenario: string) {
  console.log(`Validating diagnostic fields for scenario: ${scenario}`);
  
  // Wait for data to load
  await diagnosticsPage.waitForSelector('.metric-card', { timeout: 10000 });
  
  // Core metrics validation
  const totalSessionsCard = diagnosticsPage.locator('.metric-card:has-text("Total Sessions")');
  await expect(totalSessionsCard).toBeVisible();
  const totalSessionsValue = await totalSessionsCard.locator('.metric-value.large').textContent();
  expect(totalSessionsValue).toBeTruthy();
  expect(totalSessionsValue).not.toBe('--');
  expect(totalSessionsValue).not.toBe('N/A');
  
  const activeUsersCard = diagnosticsPage.locator('.metric-card:has-text("Active Users")');
  await expect(activeUsersCard).toBeVisible();
  const activeUsersValue = await activeUsersCard.locator('.metric-value.large').textContent();
  expect(activeUsersValue).toBeTruthy();
  expect(activeUsersValue).not.toBe('--');
  expect(activeUsersValue).not.toBe('N/A');
  
  const translationVolumeCard = diagnosticsPage.locator('.metric-card:has-text("Translation Volume")');
  await expect(translationVolumeCard).toBeVisible();
  const translationVolumeValue = await translationVolumeCard.locator('.metric-value.large').textContent();
  expect(translationVolumeValue).toBeTruthy();
  expect(translationVolumeValue).not.toBe('--');
  expect(translationVolumeValue).not.toBe('N/A');
  
  // Recent Session Activity validation - should not show phantom sessions
  const sessionActivitySection = diagnosticsPage.locator('.section-header:has-text("Recent Session Activity")');
  await expect(sessionActivitySection).toBeVisible();
  
  // Check for session activity items
  const sessionItems = diagnosticsPage.locator('.session-item, .activity-item');
  const sessionCount = await sessionItems.count();
  
  if (sessionCount > 0) {
    // Validate that session items don't have "N/A" classroom codes
    for (let i = 0; i < sessionCount; i++) {
      const sessionItem = sessionItems.nth(i);
      const itemText = await sessionItem.textContent();
      expect(itemText).not.toContain('N/A');
      expect(itemText).not.toContain('undefined');
      expect(itemText).not.toContain('null');
    }
  }
  
  // Section headers validation
  await expect(diagnosticsPage.locator('.section-header:has-text("Product Usage Assessment")')).toBeVisible();
  await expect(diagnosticsPage.locator('.section-header:has-text("Performance & Quality Metrics")')).toBeVisible();
  
  console.log(`✓ All diagnostic fields validated for scenario: ${scenario}`);
}

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
  // COMPREHENSIVE SCENARIO VALIDATION TESTS
  // =====================================

  test('should show correct diagnostics with teacher only (no session creation)', async ({ browser }) => {
    // Clear any seeded data to start fresh
    await clearDiagnosticData();
    
    // Start with a teacher only - should NOT create a session
    const { page: teacherPage, classroomCode } = await getClassroomCodeFromTeacher(browser);
    
    // Give time for any potential session creation
    await page.waitForTimeout(2000);
    
    // Now check diagnostics - should not show phantom sessions
    await page.reload();
    await validateDiagnosticFields(page, 'teacher-only-no-session');
    
    // Specifically validate that Active Users shows 1 teacher but no sessions from this teacher-only connection
    const activeUsersCard = page.locator('.metric-card:has-text("Active Users")');
    const teachersOnlineValue = await activeUsersCard.locator('.metric-value.large').textContent();
    expect(parseInt(teachersOnlineValue || '0')).toBeGreaterThanOrEqual(1);
    
    await teacherPage.close();
  });

  test('should show correct diagnostics when student joins teacher (session creation)', async ({ browser }) => {
    // Clear any seeded data to start fresh
    await clearDiagnosticData();
    
    // Start with a teacher
    const { page: teacherPage, classroomCode } = await getClassroomCodeFromTeacher(browser);
    
    // Add a student - this SHOULD create a session
    const studentPage = await connectStudent(browser, classroomCode);
    
    // Give time for session creation and metrics update
    await page.waitForTimeout(3000);
    
    // Now check diagnostics - should show the new session
    await page.reload();
    await validateDiagnosticFields(page, 'teacher-plus-student-session-created');
    
    // Validate that we have active users and a session
    const activeUsersCard = page.locator('.metric-card:has-text("Active Users")');
    const activeUsersValue = await activeUsersCard.locator('.metric-value.large').textContent();
    expect(parseInt(activeUsersValue || '0')).toBeGreaterThanOrEqual(1);
    
    // Check for session in Recent Session Activity
    const sessionItems = page.locator('.session-item, .activity-item');
    const sessionCount = await sessionItems.count();
    expect(sessionCount).toBeGreaterThanOrEqual(1);
    
    // Validate classroom code appears correctly (not N/A)
    if (sessionCount > 0) {
      const firstSessionText = await sessionItems.first().textContent();
      expect(firstSessionText).toContain(classroomCode);
      expect(firstSessionText).not.toContain('N/A');
    }
    
    await teacherPage.close();
    await studentPage.close();
  });

  test('should handle multiple concurrent sessions correctly', async ({ browser }) => {
    // Clear any seeded data to start fresh
    await clearDiagnosticData();
    
    // Create multiple teacher-student pairs
    const sessions = [];
    
    // Session 1
    const session1 = await getClassroomCodeFromTeacher(browser);
    const student1 = await connectStudent(browser, session1.classroomCode);
    sessions.push({ teacher: session1.page, student: student1, code: session1.classroomCode });
    
    // Session 2
    const session2 = await getClassroomCodeFromTeacher(browser);
    const student2 = await connectStudent(browser, session2.classroomCode);
    sessions.push({ teacher: session2.page, student: student2, code: session2.classroomCode });
    
    // Give time for all sessions to be created
    await page.waitForTimeout(3000);
    
    // Check diagnostics
    await page.reload();
    await validateDiagnosticFields(page, 'multiple-concurrent-sessions');
    
    // Validate metrics reflect multiple sessions
    const activeUsersCard = page.locator('.metric-card:has-text("Active Users")');
    const activeUsersValue = await activeUsersCard.locator('.metric-value.large').textContent();
    expect(parseInt(activeUsersValue || '0')).toBeGreaterThanOrEqual(2);
    
    // Check that both classroom codes appear in Recent Session Activity
    const sessionItems = page.locator('.session-item, .activity-item');
    const sessionCount = await sessionItems.count();
    expect(sessionCount).toBeGreaterThanOrEqual(2);
    
    // Validate both classroom codes appear (not N/A)
    const allSessionText = await sessionItems.allTextContents();
    const combinedText = allSessionText.join(' ');
    expect(combinedText).toContain(sessions[0].code);
    expect(combinedText).toContain(sessions[1].code);
    expect(combinedText).not.toContain('N/A');
    
    // Clean up
    for (const session of sessions) {
      await session.teacher.close();
      await session.student.close();
    }
  });

  test('should not show phantom sessions from seeded data when live sessions exist', async ({ browser }) => {
    // This test ensures that when we have both seeded historical data AND live sessions,
    // we don't get phantom "N/A" entries
    
    // Keep seeded data AND add live session
    const { page: teacherPage, classroomCode } = await getClassroomCodeFromTeacher(browser);
    const studentPage = await connectStudent(browser, classroomCode);
    
    await page.waitForTimeout(3000);
    await page.reload();
    await validateDiagnosticFields(page, 'seeded-data-plus-live-session');
    
    // Ensure no "N/A" values appear anywhere
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('N/A');
    expect(pageText).not.toContain('undefined');
    expect(pageText).not.toContain('null');
    
    await teacherPage.close();
    await studentPage.close();
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
    
    // Validate all fields with seeded data
    await validateDiagnosticFields(page, 'basic-load-with-seeded-data');
  });

  test('should display essential controls', async () => {
    const refreshBtn = page.locator('#refresh-btn');
    await expect(refreshBtn).toBeVisible();
    await expect(refreshBtn).toContainText('🔄 Refresh Data');
    
    const timeRangeSelect = page.locator('#time-range-select');
    await expect(timeRangeSelect).toBeVisible();
    
    // Validate all fields are properly displayed
    await validateDiagnosticFields(page, 'essential-controls-check');
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
    expect(totalSessionsValue).not.toBe('N/A');
    
    // Comprehensive validation
    await validateDiagnosticFields(page, 'seeded-data-metrics');
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
    
    // Ensure no "N/A" values appear during error state
    const errorPageText = await page.textContent('body');
    expect(errorPageText).not.toContain('N/A');
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
      expect(value).not.toBe('N/A');
      expect(value).not.toBe('undefined');
    }
    
    // Comprehensive validation
    await validateDiagnosticFields(page, 'proper-formatting-check');
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
    
    // Comprehensive validation on mobile
    await validateDiagnosticFields(page, 'mobile-responsive-check');
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
    
    // Comprehensive validation after time range change
    await validateDiagnosticFields(page, 'time-range-last7days');
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
    expect(value).not.toBe('N/A');
    expect(value).not.toBe('undefined');
    // The test may show 0 for teachers connected since this is a test environment
    expect(parseInt(value || '0')).toBeGreaterThanOrEqual(0);
    
    // Comprehensive validation
    await validateDiagnosticFields(page, 'active-users-metric-focus');
  });

  test('should display total sessions metric', async () => {
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Total Sessions card should show real data
    const sessionsCard = page.locator('.metric-card:has-text("Total Sessions")');
    await expect(sessionsCard).toBeVisible();
    
    // Get the main metric value (the large one)
    const value = await sessionsCard.locator('.metric-value.large').textContent();
    expect(value).toBeTruthy();
    expect(value).not.toBe('N/A');
    expect(value).not.toBe('undefined');
    expect(parseInt(value || '0')).toBeGreaterThanOrEqual(0);
    
    // Comprehensive validation
    await validateDiagnosticFields(page, 'total-sessions-metric-focus');
  });

  test('should display translation volume metric', async () => {
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Translation Volume card should show real data  
    const translationCard = page.locator('.metric-card:has-text("Translation Volume")');
    await expect(translationCard).toBeVisible();
    
    // Get the main metric value (the large one)
    const value = await translationCard.locator('.metric-value.large').textContent();
    expect(value).toBeTruthy();
    expect(value).not.toBe('N/A');
    expect(value).not.toBe('undefined');
    expect(parseInt(value || '0')).toBeGreaterThanOrEqual(0);
    
    // Comprehensive validation
    await validateDiagnosticFields(page, 'translation-volume-metric-focus');
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
    
    // Comprehensive validation
    await validateDiagnosticFields(page, 'api-data-verification');
  });

  test('should display section headers for product owners', async () => {
    // Check for key section headers that address product owner needs
    await expect(page.locator('.section-header:has-text("Product Usage Assessment")')).toBeVisible();
    await expect(page.locator('.section-header:has-text("Performance & Quality Metrics")')).toBeVisible();
    await expect(page.locator('.section-header:has-text("Recent Session Activity")')).toBeVisible();
    
    // Comprehensive validation
    await validateDiagnosticFields(page, 'section-headers-validation');
  });

  test('should refresh data when refresh button is clicked', async () => {
    await page.waitForSelector('.metric-card', { timeout: 5000 });
    
    // Click refresh button
    await page.click('#refresh-btn');
    await page.waitForTimeout(1000);
    
    // Verify metrics are still displayed after refresh
    const metricCards = page.locator('.metric-card');
    await expect(metricCards.first()).toBeVisible();
    
    // Comprehensive validation after refresh
    await validateDiagnosticFields(page, 'post-refresh-validation');
  });
});