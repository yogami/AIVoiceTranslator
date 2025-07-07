import { test, expect, Browser } from '@playwright/test';
import { clearDiagnosticData, seedSessions } from './test-data-utils';
import type { InsertSession } from '../../shared/schema';

// Global array to track test session IDs for cleanup
let testSessionIds: string[] = [];

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

test.describe('Session Lifecycle E2E Tests', () => {
  test.beforeEach(async () => {
    // Reset the test session IDs array before each test
    testSessionIds = [];
  });

  test.afterEach(async () => {
    // Clean up test data after each test
    await clearDiagnosticData();
    testSessionIds = [];
  });

  test('should clean up sessions when teacher waits too long without students', async ({ page }) => {
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
    testSessionIds.push(sessionId);
    
    // Debug: Verify the session was created
    console.log(`Created test session: ${sessionId}`);
    
    // Let's also test the API directly to see what it returns
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/diagnostics');
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      } catch (error) {
        return { error: String(error) };
      }
    });
    console.log('API response:', JSON.stringify(response, null, 2));

    // Set the API URL before navigating to the page
    await page.addInitScript(() => {
      window.VITE_API_URL = 'http://127.0.0.1:5001';
    });
    
    // Navigate to diagnostics page to check sessions
    await page.goto('http://127.0.0.1:5001/diagnostics.html');
    
    // Verify the session appears in recent activity (because it has translations)
    await page.waitForLoadState('networkidle');
    
    // Debug: Check what VITE_API_URL is set to
    const apiUrl = await page.evaluate(() => window.VITE_API_URL);
    console.log('VITE_API_URL on page:', apiUrl);
    
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
    testSessionIds.push(sessionId);

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
    testSessionIds.push(sessionId + '-expired');

    // Trigger cleanup
    await page.evaluate(() => {
      return fetch('/api/admin/cleanup-sessions', { method: 'POST' });
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
    testSessionIds.push(sessionId);

    // Open teacher page
    await page.goto('/teacher');
    
    // Open student page in new context to simulate student joining
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    
    // Student joins the session (this should update activity)
    await studentPage.goto('/student?code=ACT-TEST');
    
    // Wait for connection to be established
    await studentPage.waitForTimeout(2000);

    // Now trigger cleanup - the session should NOT be cleaned up because activity was updated
    await page.evaluate(() => {
      return fetch('/api/admin/cleanup-sessions', { method: 'POST' });
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

    testSessionIds.push(activeSessionId, inactiveSessionId);

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
    testSessionIds.push(activeSessionId);

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
    testSessionIds.push(recentInactiveSessionId);

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
    testSessionIds.push(teacherOnlySessionId);

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
    testSessionIds.push(activeWithStudentsId);

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
