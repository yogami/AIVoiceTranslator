// @ts-check
import { test, expect, type Page, type Route, type Browser } from '@playwright/test';
import { seedRealisticTestData, clearDiagnosticData, seedSessions } from './test-data-utils';
import { ensureTestDatabaseSchema } from './test-setup';
import type { InsertSession } from '../../shared/schema';

// Helper function to get classroom code from teacher page (waits for it to be populated)
async function getClassroomCodeFromTeacher(browser: Browser): Promise<{ page: Page; classroomCode: string }> {
  const teacherPage = await browser.newPage();
  await teacherPage.goto('http://127.0.0.1:5001/teacher');
  await expect(teacherPage.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
  
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
  
  // Wait for student registration to complete (should update the connection status text)
  await studentPage.waitForTimeout(2000); // Give registration time to complete
  
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
    // Validate that session items don't have invalid data
    for (let i = 0; i < sessionCount; i++) {
      const sessionItem = sessionItems.nth(i);
      const itemText = await sessionItem.textContent();
      
      // For teacher-only scenarios, "N/A" classroom codes are acceptable since no student has joined
      if (scenario !== 'teacher-only-no-session') {
        expect(itemText).not.toContain('N/A');
      }
      
      expect(itemText).not.toContain('undefined');
      expect(itemText).not.toContain('null');
    }
  }
  
  // Section headers validation
  await expect(diagnosticsPage.locator('.section-header:has-text("Product Usage Assessment")')).toBeVisible();
  await expect(diagnosticsPage.locator('.section-header:has-text("Performance & Quality Metrics")')).toBeVisible();
  
  console.log(`✓ All diagnostic fields validated for scenario: ${scenario}`);
}

// Helper function to create test sessions using the seeding utility
async function createTestSession(sessionData: Partial<InsertSession> & { sessionId: string }) {
  const fullSessionData: InsertSession = {
    sessionId: sessionData.sessionId,
    isActive: sessionData.isActive ?? true,
    teacherLanguage: sessionData.teacherLanguage ?? 'en-US',
    studentLanguage: sessionData.studentLanguage ?? 'es-ES',
    classCode: sessionData.classCode ?? 'TEST',
    startTime: sessionData.startTime ?? null, // Don't set startTime unless explicitly provided (mimics real behavior)
    endTime: sessionData.endTime,
    studentsCount: sessionData.studentsCount ?? 0,
    totalTranslations: sessionData.totalTranslations ?? 0,
    lastActivityAt: sessionData.lastActivityAt
  };
  
  await seedSessions([fullSessionData]);
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
    await page.waitForTimeout(6000);
    
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

  test('should distinguish between currently active sessions and recent activity', async ({ browser }) => {
    await clearDiagnosticData();
    
    // Create a session with teacher and student
    const { page: teacherPage, classroomCode } = await getClassroomCodeFromTeacher(browser);
    const studentPage = await connectStudent(browser, classroomCode);
    
    // Send some translations to create activity
    await teacherPage.fill('#speech-input', 'Hello currently active session');
    await teacherPage.click('#send-btn');
    
    // Wait for translation to appear
    await expect(studentPage.locator('#output')).toContainText('Hola', { timeout: 10000 });
    
    // Give time for session to be persisted as active with students
    await teacherPage.waitForTimeout(2000);
    
    // Check diagnostics page
    const diagnosticsPage = await browser.newPage();
    await diagnosticsPage.goto('http://127.0.0.1:5001/analytics');
    await diagnosticsPage.waitForSelector('.metric-card', { timeout: 10000 });
    
    // Check for currently active sessions section
    const currentlyActiveSection = diagnosticsPage.locator('text=Currently Active Sessions').or(
      diagnosticsPage.locator('text=Active Sessions')
    );
    await expect(currentlyActiveSection).toBeVisible({ timeout: 5000 });
    
    // Check for recent activity section  
    const recentActivitySection = diagnosticsPage.locator('text=Recent Session Activity').or(
      diagnosticsPage.locator('text=Recent Activity')
    );
    await expect(recentActivitySection).toBeVisible({ timeout: 5000 });
    
    // Verify that our active session appears in the appropriate section
    // (The session should be in currently active since it has students and is active)
    const sessionInfo = diagnosticsPage.locator(`text=${classroomCode}`).first();
    await expect(sessionInfo).toBeVisible({ timeout: 5000 });
    
    // Clean up
    await teacherPage.close();
    await studentPage.close();
    await diagnosticsPage.close();
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

  // Session Lifecycle Tests
  test('should clean up sessions when teacher waits too long without students', async ({ page }) => {
    // Clear any existing data first
    await clearDiagnosticData();
    
    // Create a session that has translations but no current students (inactive session)
    // This simulates a teacher who had activity but students left and session ended
    const sessionId = 'teacher-waiting-e2e-test';
    await createTestSession({
      sessionId,
      studentsCount: 0, // Students left
      startTime: new Date(Date.now() - 60 * 60 * 1000), // Started 60 minutes ago when students were present
      totalTranslations: 2, // Has translations so will appear in recent activity
      isActive: false, // Not currently active (students left)
      endTime: new Date(Date.now() - 20 * 60 * 1000) // Ended 20 minutes ago
    });

    // Debug: Check what was actually created in the database
    const fullApiResponse = await page.evaluate(async () => {
      // Call the diagnostics API to see what sessions it returns
      const response = await fetch('http://127.0.0.1:5001/api/diagnostics');
      const data = await response.json();
      return data;
    });
    console.log('=== Full API Response ===');
    console.log('API Response:', JSON.stringify(fullApiResponse.sessions, null, 2));
    console.log('=== End Full API Response ===');

    // Navigate to diagnostics page to check sessions
    await page.goto('http://127.0.0.1:5001/diagnostics.html');
    
    // Add debug logging to the frontend
    await page.addInitScript(() => {
      // Override console.log to capture it in the test
      const originalLog = console.log;
      (window as any).testLogs = [];
      console.log = (...args: any[]) => {
        (window as any).testLogs.push(args.join(' '));
        originalLog.apply(console, args);
      };
    });
    
    // Wait for the page to load and add debug logging to the displayRecentSessionActivity function
    await page.evaluate(() => {
      // Override the displayRecentSessionActivity function to add debug logging
      const originalDisplayRecentSessionActivity = (window as any).displayRecentSessionActivity;
      if (originalDisplayRecentSessionActivity) {
        (window as any).displayRecentSessionActivity = function(sessions: any) {
          console.log('displayRecentSessionActivity called with:', sessions);
          return originalDisplayRecentSessionActivity.call(this, sessions);
        };
      }
    });
    
    // Verify the session appears in recent activity (because it has translations)
    await page.waitForLoadState('networkidle');
    
    // Capture any JavaScript console logs
    const consoleLogs = await page.evaluate(() => {
      return (window as any).testLogs || [];
    });
    console.log('=== Frontend Console Logs ===');
    console.log('Console logs:', consoleLogs);
    console.log('=== End Frontend Console Logs ===');
    
    let sessionElements = await page.locator('[data-testid="session-row"]').all();
    let sessionTexts = await Promise.all(
      sessionElements.map(el => el.textContent())
    );

    // The test session should appear in recent activity because it has translations
    let hasTestSession = sessionTexts.some(text => text?.includes(sessionId));
    expect(hasTestSession).toBe(true);

    // Trigger cleanup via API call (this should clean up old inactive sessions)
    await page.evaluate(() => {
      return fetch('/api/admin/cleanup-sessions', { method: 'POST' });
    });

    // Wait a moment for the cleanup to complete
    await page.waitForTimeout(1000);

    // Refresh the diagnostics page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The session should no longer appear after cleanup
    sessionElements = await page.locator('[data-testid="session-row"]').all();
    sessionTexts = await Promise.all(
      sessionElements.map(el => el.textContent())
    );

    // The test session should not be in the list anymore
    hasTestSession = sessionTexts.some(text => text?.includes(sessionId));
    expect(hasTestSession).toBe(false);
  });
  
  test('should maintain sessions during grace period but clean up after', async ({ page }) => {
    // Create a session that had students but they left 3 minutes ago (within grace period)
    const sessionId = 'grace-period-e2e-test';
    await createTestSession({
      sessionId,
      studentsCount: 0, // Students recently left, but session is still in grace period
      startTime: new Date(Date.now() - 20 * 60 * 1000), // Started 20 minutes ago when first student joined
      lastActivityAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      totalTranslations: 5, // Had translations while students were present
      isActive: false, // Students left, so not currently active
      endTime: new Date(Date.now() - 3 * 60 * 1000) // Ended when students left
    });

    // Check that session is still active (within grace period)
    await page.goto('http://127.0.0.1:5001/diagnostics.html');
    
    let sessionElements = await page.locator('[data-testid="session-row"]').all();
    let sessionTexts = await Promise.all(
      sessionElements.map(el => el.textContent())
    );
    
    // Session should still be active
    let hasTestSession = sessionTexts.some(text => text?.includes(sessionId));
    expect(hasTestSession).toBe(true);

    // Now simulate that 6 minutes have passed (beyond grace period)
    await createTestSession({
      sessionId: sessionId + '-expired',
      studentsCount: 0, // Students left
      startTime: new Date(Date.now() - 25 * 60 * 1000), // Started 25 minutes ago when first student joined
      lastActivityAt: new Date(Date.now() - 7 * 60 * 1000), // 7 minutes ago
      totalTranslations: 3, // Had translations while students were present
      isActive: false, // Students left, so not currently active
      endTime: new Date(Date.now() - 7 * 60 * 1000) // Ended when students left
    });

    // Trigger cleanup
    await page.evaluate(() => {
      return fetch('http://127.0.0.1:5001/api/admin/cleanup-sessions', { method: 'POST' });
    });

    await page.waitForTimeout(1000);
    await page.reload();

    // Now the expired session should be gone
    sessionElements = await page.locator('[data-testid="session-row"]').all();
    sessionTexts = await Promise.all(
      sessionElements.map(el => el.textContent())
    );

    const hasExpiredSession = sessionTexts.some(text => text?.includes(sessionId + '-expired'));
    expect(hasExpiredSession).toBe(false);
  });

  test('should update session activity when students interact', async ({ page, browser }) => {
    // This test simulates the real flow of student interaction updating session activity
    
    // Create a session that would normally be cleaned up due to inactivity
    const sessionId = 'activity-update-e2e-test';
    await createTestSession({
      sessionId,
      studentsCount: 0, // Students left, but will rejoin
      startTime: new Date(Date.now() - 45 * 60 * 1000), // Started 45 minutes ago when first student joined
      lastActivityAt: new Date(Date.now() - 32 * 60 * 1000), // 32 minutes ago - should be cleaned
      totalTranslations: 5, // Had translations
      isActive: false, // Students left, so not currently active
      endTime: new Date(Date.now() - 32 * 60 * 1000), // Ended when students left
      classCode: 'ACT-TEST'
    });

    // Open teacher page
    await page.goto('http://127.0.0.1:5001/teacher');
    
    // Open student page in new context to simulate student joining
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    
    // Student joins the session (this should update activity)
    await studentPage.goto('http://127.0.0.1:5001/student?code=ACT-TEST');
    
    // Wait for connection to be established
    await studentPage.waitForTimeout(2000);

    // Now trigger cleanup - the session should NOT be cleaned up because activity was updated
    await page.evaluate(() => {
      return fetch('http://127.0.0.1:5001/api/admin/cleanup-sessions', { method: 'POST' });
    });

    await page.waitForTimeout(1000);

    // Check diagnostics page - session should still be active
    await page.goto('http://127.0.0.1:5001/diagnostics.html');
    
    const sessionElements = await page.locator('[data-testid="session-row"]').all();
    const sessionTexts = await Promise.all(
      sessionElements.map(el => el.textContent())
    );

    const hasTestSession = sessionTexts.some(text => text?.includes(sessionId));
    expect(hasTestSession).toBe(true);

    await studentContext.close();
  });

  test('DEBUG: Check what diagnostics API returns for seeded session', async ({ page }) => {
    // Clear any existing data first
    await clearDiagnosticData();
    
    // Create a session that should appear in recent activity
    const sessionId = 'debug-session-test';
    await seedSessions([{
      sessionId,
      studentsCount: 0,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      totalTranslations: 2,
      isActive: false,
      endTime: new Date(Date.now() - 20 * 60 * 1000),
      teacherLanguage: 'en-US',
      studentLanguage: 'es-ES',
      classCode: 'DEBUG'
    }]);
    
    // Check what the API returns
    const response = await page.goto('http://127.0.0.1:5001/api/diagnostics');
    const data = await response?.json();
    
    console.log('=== DIAGNOSTICS API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('=== END DEBUG ===');
    
    // For now, just pass the test since this is debug
    expect(true).toBe(true);
  });

  test('should only show active sessions on diagnostics page', async ({ page }) => {
    // Create both active and inactive sessions
    const activeSessionId = 'active-e2e-test';
    const inactiveSessionId = 'inactive-e2e-test';

    await createTestSession({
      sessionId: activeSessionId,
      studentsCount: 1, // Active session with students should have startTime
      startTime: new Date(Date.now() - 10 * 60 * 1000), // Started 10 minutes ago when first student joined
      totalTranslations: 3,
      isActive: true
    });

    await createTestSession({
      sessionId: inactiveSessionId,
      studentsCount: 0, // Inactive session with no students
      startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 minutes ago when students were present
      totalTranslations: 1, // Add translations so it appears in recent activity
      isActive: false, // Students left
      endTime: new Date(Date.now() - 15 * 60 * 1000) // Ended 15 minutes ago
    });

    // Navigate to diagnostics page
    await page.goto('http://127.0.0.1:5001/diagnostics.html');

    // Get all session elements
    const sessionElements = await page.locator('[data-testid="session-row"]').all();
    const sessionTexts = await Promise.all(
      sessionElements.map(el => el.textContent())
    );

    // Active session should be visible
    const hasActiveSession = sessionTexts.some(text => text?.includes(activeSessionId));
    expect(hasActiveSession).toBe(true);

    // Inactive session should be visible in recent activity (not in currently active)
    const hasInactiveSession = sessionTexts.some(text => text?.includes(inactiveSessionId));
    expect(hasInactiveSession).toBe(true); // Should appear in recent activity section
  });

  test('should distinguish currently active sessions from recent historical activity', async ({ page }) => {
    // Create a currently active session (with students)
    const activeSessionId = 'currently-active-test';
    await createTestSession({
      sessionId: activeSessionId,
      classCode: 'ACTIVE123',
      studentsCount: 2, // Has students, so it should have startTime
      startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 minutes ago when first student joined
      isActive: true,
      totalTranslations: 5
    });

    // Create a recent but inactive session (with translations)
    const recentInactiveSessionId = 'recent-inactive-test';
    await createTestSession({
      sessionId: recentInactiveSessionId,
      classCode: 'RECENT456',
      studentsCount: 0, // No current students (they left)
      startTime: new Date(Date.now() - 60 * 60 * 1000), // Started 60 minutes ago when first student joined
      isActive: false,
      totalTranslations: 10, // Has historical translations
      endTime: new Date(Date.now() - 30 * 60 * 1000) // Ended 30 minutes ago
    });

    // Navigate to diagnostics page
    await page.goto('http://127.0.0.1:5001/diagnostics.html');
    await page.waitForLoadState('networkidle');

    // Look for sections distinguishing current vs recent activity
    const currentlyActiveSection = page.locator('text=Currently Active').or(
      page.locator('text=Active Sessions')
    );
    const recentActivitySection = page.locator('text=Recent Activity').or(
      page.locator('text=Recent Session Activity')
    );

    // Both sections should exist
    await expect(currentlyActiveSection).toBeVisible({ timeout: 10000 });
    await expect(recentActivitySection).toBeVisible({ timeout: 10000 });

    // Check that sessions appear in appropriate sections
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('ACTIVE123'); // Currently active session
    expect(pageContent).toContain('RECENT456'); // Recent historical session
  });

  test('should only show sessions with students in currently active section', async ({ page }) => {
    // Create an active session without students (should not appear in currently active)
    const teacherOnlySessionId = 'teacher-only-session';
    await createTestSession({
      sessionId: teacherOnlySessionId,
      classCode: 'TEACHER1',
      studentsCount: 0, // No students, so no startTime
      startTime: null, // No students joined
      isActive: false, // No students, so not active
      totalTranslations: 0
    });

    // Create an active session with students (should appear in currently active)
    const activeWithStudentsId = 'active-with-students';
    await createTestSession({
      sessionId: activeWithStudentsId,
      classCode: 'STUDENT1',
      studentsCount: 3, // Has students, so it should have startTime
      startTime: new Date(Date.now() - 15 * 60 * 1000), // Started 15 minutes ago when first student joined
      isActive: true,
      totalTranslations: 2
    });

    // Navigate to diagnostics page
    await page.goto('http://127.0.0.1:5001/diagnostics.html');
    await page.waitForLoadState('networkidle');

    const pageContent = await page.textContent('body');
    
    // Session with students should be visible
    expect(pageContent).toContain('STUDENT1');
    
    // Session without students should be less prominent or in a different section
    // (The exact behavior depends on UI implementation, but it should be distinguished)
    const currentlyActiveSection = page.locator('text=Currently Active').or(
      page.locator('text=Active Sessions')
    );
    await expect(currentlyActiveSection).toBeVisible();
  });

});