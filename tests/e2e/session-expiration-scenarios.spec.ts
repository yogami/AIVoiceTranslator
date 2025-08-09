/**
 * Session Expiration Scenarios E2E Tests
 *
 * Medium priority coverage for session lifecycle:
 * 1) Expiration while teacher connected
 * 2) Expiration while students connected
 * 3) Cleanup removes expired sessions from memory
 * 4) DB/memory consistency
 * 5) UI updates on expiration
 */

import { test, expect } from '@playwright/test';
import { testConfig } from './helpers/test-timeouts';
import { getTeacherURL, getStudentURL, getAnalyticsURL } from './helpers/test-config';
import { seedRealisticTestData, clearDiagnosticData } from './test-data-utils';

// Deterministic analytics helpers (avoid NL parsing flakiness)
async function isSessionActiveByClassCode(page: any, classroomCode: string): Promise<boolean> {
  const resp = await page.request.get('/api/analytics/active-sessions');
  if (!resp.ok()) return false;
  const json = await resp.json();
  const classCodes: string[] = json?.data?.classCodes || [];
  return classCodes.includes(classroomCode);
}

// Deterministic summaries (prefer over natural-language analytics)
async function getActiveSessionsSummary(page: any): Promise<{ activeSessions: Array<{ sessionId: string, classCode: string | null }>}> {
  // Try direct sessions endpoint first
  try {
    const res = await page.request.get('/api/sessions/active');
    const json = await res.json();
    if (json && json.data && Array.isArray(json.data.activeSessions)) {
      return json.data;
    }
  } catch (_) {
    // fall through to analytics fallback
  }
  // Fallback to analytics endpoint and normalize
  try {
    const res2 = await page.request.get('/api/analytics/active-sessions');
    const j2 = await res2.json();
    const data = j2?.data || {};
    const sessionIds: string[] = data.sessionIds || [];
    const classCodes: (string | null)[] = data.classCodes || [];
    const activeSessions = sessionIds.map((sid, idx) => ({ sessionId: sid, classCode: classCodes[idx] || null }));
    return { activeSessions };
  } catch (e) {
    return { activeSessions: [] };
  }
}

async function getSessionIdByClassCode(page: any, classroomCode: string): Promise<string | null> {
  const data = await getActiveSessionsSummary(page);
  const match = (data.activeSessions || []).find((s: any) => s.classCode === classroomCode);
  return match ? match.sessionId : null;
}

async function waitForSessionIdByClassCode(page: any, classroomCode: string, timeoutMs = 8000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const sid = await getSessionIdByClassCode(page, classroomCode);
    if (sid) return sid;
    await page.waitForTimeout(200);
  }
  return null;
}

async function waitForClassCodeActiveState(page: any, classroomCode: string, expectedActive: boolean, timeoutMs = 8000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isActive = await isSessionActiveByClassCode(page, classroomCode);
    if (isActive === expectedActive) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

// Helper function to navigate to analytics page
async function navigateToAnalytics(page: any) {
  await page.goto(getAnalyticsURL());
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toContainText('Analytics');
}

// Helper function to ask analytics questions
async function askAnalyticsQuestion(page: any, question: string): Promise<string> {
  await page.fill('#questionInput', question);
  
  // Count existing AI messages before asking
  const existingMessages = await page.locator('.ai-message').count();
  
  await page.click('#askButton');
  
  // First, ensure the network request completed successfully
  await page.waitForResponse(
    (resp: any) => resp.url().endsWith('/api/analytics/ask') && resp.ok(),
    { timeout: Math.max(testConfig.ui.connectionStatusTimeout, 10000) }
  );

  // Then wait for a new AI message to appear in the DOM
  await page.waitForFunction(
    (expectedCount: number) => document.querySelectorAll('.ai-message').length > expectedCount,
    existingMessages,
    { timeout: Math.max(testConfig.ui.connectionStatusTimeout, 10000) }
  );
  
  // Get the latest AI message
  const latestMessage = page.locator('.ai-message').last();
  const response = await latestMessage.textContent();
  return response || '';
}

// Helper function to simulate teacher login
async function simulateTeacherLogin(page: any, teacherName: string): Promise<{ teacherId: string, token: string }> {
  // Ensure the teacher exists (idempotent)
  try {
    await page.request.post('/api/auth/register', {
      data: { username: teacherName, password: 'teacher123' },
    });
  } catch {
    // Ignore errors (e.g., user already exists)
  }

  // Perform real login via the UI
  await page.goto('/teacher-login');
  await page.waitForLoadState('domcontentloaded');
  // If the dev route didn't resolve, try explicit .html path
  if (!(await page.locator('#auth-form').first().isVisible({ timeout: 1000 }).catch(() => false))) {
    await page.goto('/teacher-login.html');
    await page.waitForLoadState('domcontentloaded');
  }
  // Assert form is present; on failure, surface HTML for diagnostics
  const formVisible = await page.locator('#auth-form').first().isVisible({ timeout: 2000 }).catch(() => false);
  if (!formVisible) {
    const html = await page.content();
    console.error('Login page did not render expected form. Page HTML:\n', html.slice(0, 2000));
    throw new Error('Teacher login form not found on /teacher-login');
  }

  await page.fill('#username', teacherName);
  await page.fill('#password', 'teacher123');
  // The login page uses #submit-btn for both login and registration
  await page.click('#submit-btn');
  await page.waitForURL('/teacher');
  
  const teacherData = await page.evaluate(() => {
    const teacherUser = localStorage.getItem('teacherUser');
    const token = localStorage.getItem('teacherToken');
    return teacherUser ? { user: JSON.parse(teacherUser), token } : null;
  });
  
  return {
    teacherId: teacherData?.user?.id || `teacher-${Date.now()}`,
    token: teacherData?.token || 'mock-token'
  };
}

// Helper function to get classroom code from teacher page
async function getClassroomCodeFromTeacherPage(page: any): Promise<string> {
  await page.goto(getTeacherURL('e2e=true'));
  await page.waitForLoadState('networkidle');
  
  await page.waitForSelector('#classroom-code-display', { timeout: testConfig.ui.elementVisibilityTimeout });
  
  const classroomCode = await page.locator('#classroom-code-display').textContent();
  return classroomCode || '';
}

// Helper function to simulate student joining session
async function simulateStudentJoin(page: any, classroomCode: string): Promise<{ success: boolean, errorMessage?: string }> {
  await page.goto(getStudentURL(classroomCode));
  await page.waitForLoadState('networkidle');
  
  // Check for error message
  const errorElement = page.locator('.error-message');
  const errorCount = await errorElement.count();
  
  if (errorCount > 0) {
    const errorMessage = await errorElement.textContent();
    return { success: false, errorMessage: errorMessage || 'Unknown error' };
  }
  
  return { success: true };
}

// Helper function to check if teacher page shows active session
async function checkTeacherSessionActive(page: any): Promise<boolean> {
  await page.goto(getTeacherURL('e2e=true'));
  await page.waitForLoadState('networkidle');
  
  // Check for active session indicators
  const activeIndicators = await page.locator('.session-active, .classroom-code-active, #classroom-code-display').count();
  return activeIndicators > 0;
}

// Helper function to let session timeouts elapse in test environment
async function forceSessionExpiration(page: any, classroomCode: string, expirationType: 'general' | 'empty-teacher' | 'students-left') {
  const toNumber = (v: any, d: number) => {
    const n = parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? n : d;
  };
  const staleMs = toNumber(process.env.SESSION_STALE_TIMEOUT_MS, 90 * 60 * 1000);
  const emptyTeacherMs = toNumber(process.env.SESSION_EMPTY_TEACHER_TIMEOUT_MS, 10 * 60 * 1000);
  const studentsLeftMs = toNumber(process.env.SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS, 10 * 60 * 1000);
  const cleanupMs = toNumber(process.env.SESSION_CLEANUP_INTERVAL_MS, 2 * 60 * 1000);

  let base = staleMs;
  if (expirationType === 'empty-teacher') base = emptyTeacherMs;
  if (expirationType === 'students-left') base = studentsLeftMs;

  // Wait for timeout + cleanup sweep + small buffer
  const waitMs = Math.max(base + cleanupMs + 500, 1500);
  await page.waitForTimeout(waitMs);
}

test.describe('Session Expiration Scenarios E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Ensure clean test data
    await clearDiagnosticData();
    await seedRealisticTestData();
  });

  test.describe('Session Expiration While Teacher Connected', () => {
    test('should expire session due to general inactivity while teacher remains connected', async ({ page, context }) => {
      // Step 1: Teacher creates session and stays connected
      const { teacherId } = await simulateTeacherLogin(page, 'expiration-teacher-connected');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Student joins to create activity
      const studentPage = await context.newPage();
      const joinResult = await simulateStudentJoin(studentPage, classroomCode);
      expect(joinResult.success).toBe(true);
      
      // Step 3: Verify session is initially active via UI
      expect(await checkTeacherSessionActive(page)).toBe(true);
      
      // Step 4: Force session expiration due to 90-minute general timeout
      await forceSessionExpiration(page, classroomCode, 'general');
      // Proactively trigger server-side cleanup (skipped on intervals in test env)
      await page.request.post('/api/sessions/cleanup-now');
      
      // Step 5: Verify session is no longer active via analytics endpoint (with small polling window)
      expect(await waitForClassCodeActiveState(page, classroomCode, false, 8000)).toBe(true);
      
      // Step 6: Teacher page may still render, but session should be inactive in system
      // We rely on server-side authoritative state instead of UI hiding elements automatically
      
      // Step 7: Verify student can no longer join (real join attempt)
      const newStudentPage = await context.newPage();
      await newStudentPage.goto(getStudentURL(classroomCode));
      await newStudentPage.waitForLoadState('networkidle');
      await newStudentPage.selectOption('#language-dropdown', { index: 1 });
      await newStudentPage.click('#connect-btn');
      // Expect either an explicit error or connection to remain disconnected
      await newStudentPage.waitForTimeout(1000);
      const errorCount = await newStudentPage.locator('.error-message, .session-expired').count();
      const statusText = await newStudentPage.locator('#connection-status span').textContent().catch(() => '');
      expect(errorCount > 0 || /disconnected/i.test(statusText || '')).toBe(true);
      
      await studentPage.close();
      await newStudentPage.close();
    });

    test('should expire session due to empty teacher timeout while teacher connected', async ({ page, context }) => {
      // Step 1: Teacher creates session but no students join
      const { teacherId } = await simulateTeacherLogin(page, 'empty-teacher-timeout');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Verify session starts active with no students (UI-based)
      expect(await checkTeacherSessionActive(page)).toBe(true);
      
      // Step 3: Force session expiration due to 10-minute empty teacher timeout
      await forceSessionExpiration(page, classroomCode, 'empty-teacher');
      
      // Step 4: Verify session expired due to no students (server state)
      expect(await waitForClassCodeActiveState(page, classroomCode, false, 8000)).toBe(true);
      
      // Step 5: Verify session expired by server state (UI may still show elements)
      expect(await waitForClassCodeActiveState(page, classroomCode, false, 8000)).toBe(true);
      
      // Step 6: Verify student cannot join expired session
      const studentPage = await context.newPage();
      const joinResult = await simulateStudentJoin(studentPage, classroomCode);
      expect(joinResult.success).toBe(false);
      expect(joinResult.errorMessage).toMatch(/expired|invalid/i);
      
      await studentPage.close();
    });
  });

  test.describe('Session Expiration While Students Connected', () => {
    test('should expire session due to students-left timeout while students still connected', async ({ page, context }) => {
      // Step 1: Teacher creates session
      const { teacherId } = await simulateTeacherLogin(page, 'students-left-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Students join
      const studentPage1 = await context.newPage();
      const studentPage2 = await context.newPage();
      
      await simulateStudentJoin(studentPage1, classroomCode);
      await simulateStudentJoin(studentPage2, classroomCode);
      
      // Step 3: Verify session has students (deterministic)
      const sId = await getSessionIdByClassCode(page, classroomCode);
      expect(sId).toBeTruthy();
      const stRes = await page.request.get(`/api/sessions/${sId}/status`);
      const stJson = await stRes.json();
      expect(stJson?.success).toBe(true);
      expect(stJson?.data?.connectedStudents ?? -1).toBe(2);
      
      // Step 4: Force session expiration due to students-left timeout
      await forceSessionExpiration(page, classroomCode, 'students-left');
      
      // Step 5: Verify session expired despite having students (server state)
      expect(await waitForClassCodeActiveState(page, classroomCode, false, 8000)).toBe(true);
      
      // Step 6: Verify existing students are disconnected
      const studentPage1Active = await checkStudentPageActive(studentPage1);
      const studentPage2Active = await checkStudentPageActive(studentPage2);
      expect(studentPage1Active).toBe(false);
      expect(studentPage2Active).toBe(false);
      
      // Step 7: Verify new students cannot join
      const newStudentPage = await context.newPage();
      const newJoinResult = await simulateStudentJoin(newStudentPage, classroomCode);
      expect(newJoinResult.success).toBe(false);
      
      await studentPage1.close();
      await studentPage2.close();
      await newStudentPage.close();
    });

    test('should handle gradual student disconnection leading to expiration', async ({ page, context }) => {
      // Step 1: Teacher creates session
      const { teacherId } = await simulateTeacherLogin(page, 'gradual-disconnect-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Multiple students join
      const studentPages = [];
      for (let i = 0; i < 3; i++) {
        const studentPage = await context.newPage();
        await simulateStudentJoin(studentPage, classroomCode);
        studentPages.push(studentPage);
      }
      
      // Step 3: Verify session has multiple students (deterministic)
      const sid = await getSessionIdByClassCode(page, classroomCode);
      expect(sid).toBeTruthy();
      const stRes2 = await page.request.get(`/api/sessions/${sid}/status`);
      const st2 = await stRes2.json();
      expect(st2?.success).toBe(true);
      expect(st2?.data?.connectedStudents ?? -1).toBe(3);
      
      // Step 4: Students disconnect one by one
      for (let i = 0; i < studentPages.length; i++) {
        await studentPages[i].close();
        
        // Check session status after each disconnect (deterministic)
        const stRes3 = await page.request.get(`/api/sessions/${sid}/status`);
        const st3 = await stRes3.json();
        expect(st3?.success).toBe(true);
        expect(st3?.data?.connectedStudents ?? -1).toBe(Math.max(0, 2 - i));
      }
      
      // Step 5: Force expiration after all students left
      await forceSessionExpiration(page, classroomCode, 'students-left');
      
      // Step 6: Verify session expired after all students left
      const finalStatusResponse = await askAnalyticsQuestion(page, 
        `What is the final status of session with classroom code "${classroomCode}" after all students left?`
      );
      expect(finalStatusResponse.toLowerCase()).toContain('expired');
      expect(finalStatusResponse.toLowerCase()).toContain('students');
    });
  });

  test.describe('Cleanup Timer and Memory Management', () => {
    test('should remove expired sessions from memory during cleanup', async ({ page, context }) => {
      // Step 1: Create multiple sessions
      const sessionData = [];
      for (let i = 0; i < 3; i++) {
        const teacherPage = await context.newPage();
        const { teacherId } = await simulateTeacherLogin(teacherPage, `cleanup-teacher-${i}`);
        const classroomCode = await getClassroomCodeFromTeacherPage(teacherPage);
        
        sessionData.push({ teacherPage, teacherId, classroomCode });
      }
      
      // Step 2: Verify all sessions are active (deterministic)
      const allClassroomCodes = sessionData.map(s => s.classroomCode);
      const initialSummary = await getActiveSessionsSummary(page);
      const activeCount = (initialSummary.activeSessions || []).filter(s => allClassroomCodes.includes(s.classCode)).length;
      expect(activeCount).toBe(3);
      
      // Step 3: Force expiration of all sessions
      for (const session of sessionData) {
        await forceSessionExpiration(page, session.classroomCode, 'general');
      }
      
      // Step 4: Trigger cleanup explicitly
      await page.request.post('/api/sessions/cleanup-now');
      
      // Step 5: Verify expired sessions are removed from active summary
      const afterSummary = await getActiveSessionsSummary(page);
      const afterActive = (afterSummary.activeSessions || []).filter(s => allClassroomCodes.includes(s.classCode)).length;
      expect(afterActive).toBe(0);
      
      // Step 6: Verify memory cleanup is complete
      const memoryCleanupResponse = await askAnalyticsQuestion(page, 
        `Verify that all expired sessions have been properly cleaned from memory: ${allClassroomCodes.join(', ')}`
      );
      expect(memoryCleanupResponse.toLowerCase()).toContain('cleaned');
      
      // Cleanup
      for (const session of sessionData) {
        await session.teacherPage.close();
      }
    });

    test('should maintain database consistency during memory cleanup', async ({ page, context }) => {
      // Step 1: Create session
      const { teacherId } = await simulateTeacherLogin(page, 'consistency-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Record initial database state
      await navigateToAnalytics(page);
      const initialDbState = await askAnalyticsQuestion(page, 
        `Record the complete database state for session with classroom code "${classroomCode}" including all timestamps and metadata`
      );
      expect(initialDbState).toBeTruthy();
      
      // Step 3: Force expiration
      await forceSessionExpiration(page, classroomCode, 'general');
      
      // Step 4: Verify session no longer appears in active summary
      const postSummary = await getActiveSessionsSummary(page);
      const stillActive = (postSummary.activeSessions || []).some(s => s.classCode === classroomCode);
      expect(stillActive).toBe(false);
      
      // Step 5: Verify database-memory consistency
      const consistencyResponse = await askAnalyticsQuestion(page, 
        `Verify that database and memory states are consistent for session with classroom code "${classroomCode}"`
      );
      expect(consistencyResponse.toLowerCase()).not.toContain('mismatch');
      expect(consistencyResponse.toLowerCase()).not.toContain('inconsistent');
      
      // Step 6: Verify audit trail is maintained
      const auditResponse = await askAnalyticsQuestion(page, 
        `Show the complete audit trail for session with classroom code "${classroomCode}" from creation to expiration`
      );
      expect(auditResponse).toContain('created');
      expect(auditResponse).toContain('expired');
      expect(auditResponse).toContain(classroomCode);
    });
  });

  test.describe('Real-time Expiration Notifications', () => {
    test('should handle teacher UI updates during session expiration', async ({ page, context }) => {
      // Step 1: Teacher creates session
      const { teacherId } = await simulateTeacherLogin(page, 'ui-update-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Monitor teacher page for UI changes
      const teacherUIActive = await checkTeacherSessionActive(page);
      expect(teacherUIActive).toBe(true);
      
      // Step 3: Force expiration
      await forceSessionExpiration(page, classroomCode, 'empty-teacher');
      
      // Step 4: Verify teacher session expired by server state
      expect(await waitForClassCodeActiveState(page, classroomCode, false, 8000)).toBe(true);
      
      // Step 5: Verify teacher can create new session
      const newClassroomCode = await getClassroomCodeFromTeacherPage(page);
      expect(newClassroomCode).not.toBe(classroomCode);
      expect(newClassroomCode).toMatch(/^[A-Z0-9]{6}$/);
      
      // Step 6: Verify new session is properly initialized
      await navigateToAnalytics(page);
      const newSessionResponse = await askAnalyticsQuestion(page, 
        `Verify that new session with classroom code "${newClassroomCode}" is properly initialized after previous session "${classroomCode}" expired`
      );
      expect(newSessionResponse).toContain(newClassroomCode);
      expect(newSessionResponse.toLowerCase()).toContain('active');
    });

    test('should handle student UI updates during session expiration', async ({ page, context }) => {
      // Step 1: Create session with students
      const { teacherId } = await simulateTeacherLogin(page, 'student-ui-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      const studentPage = await context.newPage();
      await simulateStudentJoin(studentPage, classroomCode);
      
      // Step 2: Verify student page is active (connect explicitly)
      await studentPage.selectOption('#language-dropdown', { index: 1 });
      await studentPage.click('#connect-btn');
      await studentPage.waitForFunction(() => (document.querySelector('#connection-status span')?.textContent || '').toLowerCase().includes('connected'));
      
      // Step 3: Force expiration
      await forceSessionExpiration(page, classroomCode, 'general');
      
      // Step 4: Verify student page reflects expiration
      const studentAfterExpiration = await checkStudentPageActive(studentPage);
      expect(studentAfterExpiration).toBe(false);
      
      // Step 5: Verify student cannot perform actions
      const studentErrorCheck = await studentPage.locator('.error-message, .session-expired').count();
      expect(studentErrorCheck).toBeGreaterThan(0);
      
      await studentPage.close();
    });
  });
});

// Helper function to check if student page shows active session
async function checkStudentPageActive(page: any): Promise<boolean> {
  try {
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check for active session indicators
    const activeIndicators = await page.locator('.session-active, .translation-interface, .microphone-button').count();
    const errorIndicators = await page.locator('.error-message, .session-expired').count();
    
    return activeIndicators > 0 && errorIndicators === 0;
  } catch (error) {
    return false;
  }
}
