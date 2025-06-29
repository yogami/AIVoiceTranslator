import { test, expect } from '@playwright/test';
import { createTestSession, cleanupTestSessions, waitForTimeout } from './test-data-utils';

test.describe('Session Lifecycle E2E Tests', () => {
  let testSessionIds: string[] = [];

  test.afterEach(async () => {
    // Clean up test sessions
    if (testSessionIds.length > 0) {
      await cleanupTestSessions(testSessionIds);
      testSessionIds = [];
    }
  });

  test('should clean up sessions when teacher waits too long without students', async ({ page }) => {
    // Create a session that simulates a teacher waiting for 15 minutes
    const sessionId = 'teacher-waiting-e2e-test';
    await createTestSession({
      sessionId,
      studentsCount: 0,
      startTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      isActive: true
    });
    testSessionIds.push(sessionId);

    // Navigate to diagnostics page to check sessions
    await page.goto('/diagnostics');
    
    // Wait for cleanup service to run (it runs every 2 minutes)
    // In a real scenario, we'd wait longer, but for tests we can trigger it manually
    await page.evaluate(() => {
      // Trigger cleanup via API call
      return fetch('/api/admin/cleanup-sessions', { method: 'POST' });
    });

    // Wait a moment for the cleanup to complete
    await page.waitForTimeout(1000);

    // Refresh the diagnostics page
    await page.reload();

    // The session should no longer appear in active sessions
    // (assuming diagnostics page only shows active sessions)
    const sessionElements = await page.locator('[data-testid="session-row"]').all();
    const sessionTexts = await Promise.all(
      sessionElements.map(el => el.textContent())
    );

    // The test session should not be in the list of active sessions
    const hasTestSession = sessionTexts.some(text => text?.includes(sessionId));
    expect(hasTestSession).toBe(false);
  });

  test('should maintain sessions during grace period but clean up after', async ({ page }) => {
    // Create a session that had students but they left 3 minutes ago (within grace period)
    const sessionId = 'grace-period-e2e-test';
    await createTestSession({
      sessionId,
      studentsCount: 2,
      startTime: new Date(Date.now() - 20 * 60 * 1000),
      lastActivityAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      isActive: true
    });
    testSessionIds.push(sessionId);

    // Check that session is still active (within grace period)
    await page.goto('/diagnostics');
    
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
      studentsCount: 2,
      startTime: new Date(Date.now() - 25 * 60 * 1000),
      lastActivityAt: new Date(Date.now() - 7 * 60 * 1000), // 7 minutes ago
      isActive: true
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

  test('should update session activity when students interact', async ({ page, context }) => {
    // This test simulates the real flow of student interaction updating session activity
    
    // Create a session that would normally be cleaned up due to inactivity
    const sessionId = 'activity-update-e2e-test';
    await createTestSession({
      sessionId,
      studentsCount: 1,
      startTime: new Date(Date.now() - 45 * 60 * 1000),
      lastActivityAt: new Date(Date.now() - 32 * 60 * 1000), // 32 minutes ago - should be cleaned
      isActive: true,
      classCode: 'ACT-TEST'
    });
    testSessionIds.push(sessionId);

    // Open teacher page
    await page.goto('/teacher');
    
    // Open student page in new context to simulate student joining
    const studentContext = await context.newContext();
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
    await page.goto('/diagnostics');
    
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
      studentsCount: 1,
      isActive: true
    });

    await createTestSession({
      sessionId: inactiveSessionId,
      studentsCount: 0,
      isActive: false
    });

    testSessionIds.push(activeSessionId, inactiveSessionId);

    // Navigate to diagnostics page
    await page.goto('/diagnostics');

    // Get all session elements
    const sessionElements = await page.locator('[data-testid="session-row"]').all();
    const sessionTexts = await Promise.all(
      sessionElements.map(el => el.textContent())
    );

    // Active session should be visible
    const hasActiveSession = sessionTexts.some(text => text?.includes(activeSessionId));
    expect(hasActiveSession).toBe(true);

    // Inactive session should NOT be visible
    const hasInactiveSession = sessionTexts.some(text => text?.includes(inactiveSessionId));
    expect(hasInactiveSession).toBe(false);
  });
});
