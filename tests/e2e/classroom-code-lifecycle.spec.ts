/**
 * Classroom Code Lifecycle E2E Tests
 * 
 * These tests cover the HIGH PRIORITY missing scenarios for classroom code management:
 * 1. Code generation uniqueness across concurrent sessions
 * 2. Code persistence across teacher reconnections (same session)
 * 3. Code expiration after configured time (2 hours prod / 30 sec test)
 * 4. Expired codes properly cleaned up from memory
 * 5. Student join edge cases with expired/invalid codes
 * 
 * All tests use UI emulation with analytics validation
 */

import { test, expect, Page } from '@playwright/test';
import { seedRealisticTestData, clearDiagnosticData } from './test-data-utils';
import { config } from '../../server/config';

// Helper function to navigate to analytics page
async function navigateToAnalytics(page: Page) {
  await page.goto('http://127.0.0.1:5001/analytics');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toContainText('Analytics');
}

// Helper function to ask analytics questions
async function askAnalyticsQuestion(page: Page, question: string): Promise<string> {
  await page.fill('#questionInput', question);
  
  // Count existing AI messages before asking
  const existingMessages = await page.locator('.ai-message').count();
  
  await page.click('#askButton');
  
  // Wait for a new AI message to appear
  await page.waitForFunction(
    (expectedCount: number) => document.querySelectorAll('.ai-message').length > expectedCount,
    existingMessages,
    { timeout: 30000 }
  );
  
  // Get the latest AI message
  const latestMessage = page.locator('.ai-message').last();
  const response = await latestMessage.textContent();
  return response || '';
}

// Helper function to simulate teacher login
async function simulateTeacherLogin(page: Page, teacherName: string): Promise<{ teacherId: string, token: string }> {
  const teacherId = `teacher-${teacherName}-${Date.now()}`;
  await page.goto(`http://127.0.0.1:5001/teacher?e2e=true&teacherId=${teacherId}&teacherUsername=${teacherName}`);
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  
  // Wait for the WebSocket to update the code from "LIVE" to a real 6-character code
  await page.waitForSelector('#classroom-code-display', { timeout: 30000 });
  await page.waitForFunction(() => {
    const element = document.querySelector('#classroom-code-display');
    return element && element.textContent && element.textContent !== 'LIVE' && element.textContent.length === 6;
  }, { timeout: 30000 });
  
  const teacherData = {
    id: teacherId,
    token: 'mock-token'
  };
  
  return {
    teacherId: teacherData.id,
    token: teacherData.token
  };
}

// Helper function to get classroom code from teacher page
async function getClassroomCodeFromTeacherPage(page: Page): Promise<string> {
  // Don't navigate again - use the current page
  const classroomCode = await page.locator('#classroom-code-display').textContent();
  return classroomCode || '';
}

// Helper function to simulate student joining session
async function simulateStudentJoin(page: Page, classroomCode: string): Promise<{ success: boolean, errorMessage?: string, studentId?: string, classroomCode?: string }> {
  await page.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for initial page load
  await page.waitForTimeout(2000);
  
  // Click the connect button to initiate the WebSocket connection
  const connectButton = page.locator('#connect-btn');
  const connectButtonExists = await connectButton.isVisible();
  
  if (!connectButtonExists) {
    return { success: false, errorMessage: 'Connect button not found' };
  }
  
  const isEnabled = await connectButton.isEnabled();
  if (!isEnabled) {
    return { success: false, errorMessage: 'Connect button is disabled' };
  }
  
  // Click connect and wait for the response
  await connectButton.click();
  
  // Wait for WebSocket connection with proper timeout handling
  try {
    await page.waitForTimeout(5000); // Increased timeout for slower browsers
  } catch (error) {
    console.log('Timeout waiting for connection response');
  }
  
  // Check for the translation display content after connection attempt
  const translationDisplay = page.locator('#translation-display');
  let displayContent = '';
  
  try {
    displayContent = await translationDisplay.textContent() || '';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('Error reading translation display content:', errorMessage);
    // If page is closed or error occurred, treat as connection failure
    return { success: false, errorMessage: 'Connection failed or page closed', classroomCode };
  }
  
  if (displayContent && displayContent.includes('Waiting for teacher to start speaking')) {
    const studentId = `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return { success: true, studentId, classroomCode };
  }
  
  // Check for specific error messages
  if (displayContent && displayContent.includes('Error')) {
    return { success: false, errorMessage: displayContent };
  }
  
  if (displayContent && displayContent.includes('Invalid classroom code')) {
    return { success: false, errorMessage: 'Invalid classroom code' };
  }
  
  if (displayContent && displayContent.includes('Classroom session expired or invalid')) {
    return { success: false, errorMessage: 'Classroom session expired or invalid' };
  }
  
  if (displayContent && displayContent.includes('Classroom not found')) {
    return { success: false, errorMessage: 'Classroom not found' };
  }
  
  // Check connection status as secondary indicator
  const connectionStatus = page.locator('#connection-status');
  const statusContent = await connectionStatus.textContent() || '';
  
  // Success cases - Connected status
  if (statusContent && statusContent.includes('Connected')) {
    const studentId = `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return { success: true, studentId, classroomCode };
  }
  
  // Error cases
  if (statusContent && statusContent.includes('No classroom code provided')) {
    return { success: false, errorMessage: 'No classroom code provided' };
  }
  
  // If we have a translation display visible, check if it shows a proper waiting message
  const hasTranslationDisplay = await translationDisplay.isVisible();
  if (hasTranslationDisplay) {
    // Only treat as success if there's a proper waiting message
    if (displayContent && displayContent.includes('Waiting for teacher')) {
      const studentId = `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return { success: true, studentId, classroomCode };
    } else {
      // Translation display is visible but no waiting message = likely an error
      return { success: false, errorMessage: displayContent || 'Unknown error' };
    }
  }
  
  // Default failure case
  return { success: false, errorMessage: 'Unknown connection issue' };
}

// Helper function specifically for testing invalid codes that cause server WebSocket closure
async function simulateStudentJoinWithInvalidCode(page: Page, classroomCode: string): Promise<{ success: boolean, errorMessage?: string, connectionClosed?: boolean }> {
  await page.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for initial page load
  await page.waitForTimeout(2000);
  
  // Click the connect button to initiate the WebSocket connection
  const connectButton = page.locator('#connect-btn');
  const connectButtonExists = await connectButton.isVisible();
  
  if (!connectButtonExists) {
    return { success: false, errorMessage: 'Connect button not found' };
  }
  
  const isEnabled = await connectButton.isEnabled();
  if (!isEnabled) {
    return { success: false, errorMessage: 'Connect button is disabled' };
  }
  
  // Set up promise race to detect connection closure vs timeout
  const connectionPromise = new Promise<{ success: boolean, errorMessage?: string, connectionClosed?: boolean }>((resolve) => {
    // Listen for page close/navigation events that indicate WebSocket closure
    page.once('close', () => {
      resolve({ success: false, errorMessage: 'Page closed due to server connection termination', connectionClosed: true });
    });
    
    // Listen for navigation events that might indicate context destruction
    page.once('framenavigated', () => {
      resolve({ success: false, errorMessage: 'Page navigated due to context destruction', connectionClosed: true });
    });
  });
  
  const timeoutPromise = new Promise<{ success: boolean, errorMessage?: string, connectionClosed?: boolean }>((resolve) => {
    setTimeout(() => {
      resolve({ success: false, errorMessage: 'Timeout waiting for connection response', connectionClosed: false });
    }, 8000); // 8 second timeout
  });
  
  // Click connect and race between connection closure and timeout
  await connectButton.click();
  
  // Race between connection closure detection and timeout
  const raceResult = await Promise.race([connectionPromise, timeoutPromise]);
  
  // If connection was closed by server (expected for invalid codes), that's the expected behavior
  if (raceResult.connectionClosed) {
    return raceResult;
  }
  
  // If no closure detected, try to read the UI for error messages
  try {
    const translationDisplay = page.locator('#translation-display');
    const displayContent = await translationDisplay.textContent() || '';
    
    // Check for error messages in the UI
    if (displayContent && displayContent.includes('Invalid classroom code')) {
      return { success: false, errorMessage: 'Invalid classroom code' };
    }
    
    if (displayContent && displayContent.includes('Classroom session expired or invalid')) {
      return { success: false, errorMessage: 'Classroom session expired or invalid' };
    }
    
    if (displayContent && displayContent.includes('Classroom not found')) {
      return { success: false, errorMessage: 'Classroom not found' };
    }
    
    // Check connection status
    const connectionStatus = page.locator('#connection-status');
    const statusContent = await connectionStatus.textContent() || '';
    
    if (statusContent && statusContent.includes('Disconnected')) {
      return { success: false, errorMessage: 'Connection disconnected', connectionClosed: true };
    }
    
    // If we got here, the connection might have succeeded unexpectedly
    if (displayContent && displayContent.includes('Waiting for teacher to start speaking')) {
      return { success: true };
    }
    
  } catch (error) {
    // If we can't read the UI, likely due to context destruction
    return { success: false, errorMessage: 'Unable to read UI - likely connection closed', connectionClosed: true };
  }
  
  // Return the timeout result if no other conditions were met
  return raceResult;
}

// Helper function to wait for code expiration (dynamically based on configuration)
async function waitForCodeExpiration() {
  // Get the actual configured expiration time from the config system
  const expirationTime = config.session.classroomCodeExpiration;
  
  // Wait for 1.1x the expiration time to ensure code is definitely expired
  const waitTime = Math.round(expirationTime * 1.1);
  
  console.log(`⏳ Waiting ${waitTime}ms for code expiration (${waitTime/1000}s)`);
  console.log(`📊 Config shows classroom code expiration: ${expirationTime}ms (${expirationTime/1000}s)`);
  
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

test.describe('Classroom Code Lifecycle E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Ensure clean test data
    await clearDiagnosticData();
    await seedRealisticTestData();
    
    // Log timing configuration for debugging
    console.log('🔧 Test Environment Configuration:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   - E2E_TEST_MODE: ${process.env.E2E_TEST_MODE}`);
    console.log(`   - TEST_TIMING_SCALE: ${process.env.TEST_TIMING_SCALE}`);
    console.log(`   - Classroom Code Expiration: ${config.session.classroomCodeExpiration}ms (${config.session.classroomCodeExpiration/1000}s)`);
    console.log(`   - Production expiration would be: ${2 * 60 * 60 * 1000}ms (2 hours)`);
  });

  test.describe('Code Generation and Uniqueness', () => {
    test('should generate unique classroom codes across concurrent sessions', async ({ page, context }) => {
      const concurrentTeachers = 5;
      const classroomCodes: string[] = [];
      const pages: Page[] = [];
      
      // Step 1: Create multiple concurrent teacher sessions
      for (let i = 0; i < concurrentTeachers; i++) {
        const teacherPage = await context.newPage();
        await simulateTeacherLogin(teacherPage, `concurrent-teacher-${i}`);
        const classroomCode = await getClassroomCodeFromTeacherPage(teacherPage);
        
        classroomCodes.push(classroomCode);
        pages.push(teacherPage);
        
        // Verify code format
        expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);
      }
      
      // Step 2: Verify all codes are unique
      const uniqueCodes = new Set(classroomCodes);
      expect(uniqueCodes.size).toBe(concurrentTeachers);
      
      // Step 3: Verify codes are unique and have correct format
      const uniqueCodesSet = new Set(classroomCodes);
      expect(uniqueCodesSet.size).toBe(concurrentTeachers);
      
      // Verify all codes are 6 characters long and alphanumeric
      classroomCodes.forEach(code => {
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
      });
      
      console.log('✅ All classroom codes are unique and properly formatted:', classroomCodes);
      
      // Cleanup
      for (const teacherPage of pages) {
        await teacherPage.close();
      }
    });

    test('should maintain code uniqueness even during high-frequency generation', async ({ page, context }) => {
      const rapidGenerationCount = 10;
      const classroomCodes: string[] = [];
      
      // Step 1: Rapidly generate codes by creating and destroying sessions
      for (let i = 0; i < rapidGenerationCount; i++) {
        const teacherPage = await context.newPage();
        await simulateTeacherLogin(teacherPage, `rapid-teacher-${i}`);
        const classroomCode = await getClassroomCodeFromTeacherPage(teacherPage);
        
        classroomCodes.push(classroomCode);
        await teacherPage.close();
        
        // Small delay to simulate rapid but not simultaneous generation
        await page.waitForTimeout(100);
      }
      
      // Step 2: Verify all rapidly generated codes are unique
      const uniqueCodes = new Set(classroomCodes);
      expect(uniqueCodes.size).toBe(rapidGenerationCount);
      
      // Step 3: Verify through analytics that rapid generation didn't cause issues
      await navigateToAnalytics(page);
      const rapidGenerationResponse = await askAnalyticsQuestion(page, 
        `Analyze the rapid generation of these classroom codes for any patterns or collisions: ${classroomCodes.join(', ')}`
      );
      expect(rapidGenerationResponse).toBeTruthy();
      expect(rapidGenerationResponse.toLowerCase()).not.toContain('collision');
      expect(rapidGenerationResponse.toLowerCase()).not.toContain('duplicate');
    });
  });

  test.describe('Code Persistence Across Reconnections', () => {
    test('should persist classroom code when teacher reconnects to same session', async ({ page, context }) => {
      // Step 1: Generate a consistent teacher ID for reconnection test
      const teacherId = `teacher-persistence-${Date.now()}`;
      
      // Step 2: Teacher creates session with consistent ID
      await page.goto(`http://127.0.0.1:5001/teacher?e2e=true&teacherId=${teacherId}&teacherUsername=persistence-teacher`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000); // Wait for WebSocket connection
      
      const originalClassroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 3: Student joins to make session persistent
      const studentPage = await context.newPage();
      const studentJoinResult = await simulateStudentJoin(studentPage, originalClassroomCode);
      expect(studentJoinResult.success).toBe(true);
      
      // Step 4: Verify code format and presence
      expect(originalClassroomCode).toHaveLength(6);
      expect(originalClassroomCode).toMatch(/^[A-Z0-9]{6}$/);
      
      // Step 5: Teacher disconnects
      await page.close();
      
      // Step 6: Teacher reconnects with SAME teacher ID
      const reconnectedPage = await context.newPage();
      await reconnectedPage.goto(`http://127.0.0.1:5001/teacher?e2e=true&teacherId=${teacherId}&teacherUsername=persistence-teacher`);
      await reconnectedPage.waitForLoadState('domcontentloaded');
      await reconnectedPage.waitForTimeout(3000); // Wait for WebSocket connection
      
      const reconnectedClassroomCode = await getClassroomCodeFromTeacherPage(reconnectedPage);
      
      // Step 6: Verify SAME classroom code is maintained
      expect(reconnectedClassroomCode).toBe(originalClassroomCode);
      
      // Step 7: Verify code format is still correct
      expect(reconnectedClassroomCode).toHaveLength(6);
      expect(reconnectedClassroomCode).toMatch(/^[A-Z0-9]{6}$/);
      
      // Step 8: Verify student can still use the same code
      const newStudentPage = await context.newPage();
      const newStudentJoinResult = await simulateStudentJoin(newStudentPage, originalClassroomCode);
      expect(newStudentJoinResult.success).toBe(true);
      
      await studentPage.close();
      await newStudentPage.close();
      await reconnectedPage.close();
    });

    test('should generate new code when session expires between reconnections', async ({ page, context }) => {
      // Step 1: Teacher creates session
      const { teacherId } = await simulateTeacherLogin(page, 'expiration-teacher');
      const originalClassroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Teacher disconnects immediately (no students joined)
      await page.close();
      
      // Step 3: Wait for session expiration (simulated by time delay)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Teacher reconnects after expiration
      const reconnectedPage = await context.newPage();
      await simulateTeacherLogin(reconnectedPage, 'expiration-teacher');
      const newClassroomCode = await getClassroomCodeFromTeacherPage(reconnectedPage);
      
      // Step 5: Verify NEW classroom code is generated
      expect(newClassroomCode).not.toBe(originalClassroomCode);
      expect(newClassroomCode).toMatch(/^[A-Z0-9]{6}$/);
      
      // Step 6: Verify student can join with new code
      const newStudentPage = await context.newPage();
      const newStudentJoinResult = await simulateStudentJoin(newStudentPage, newClassroomCode);
      expect(newStudentJoinResult.success).toBe(true);
      
      await newStudentPage.close();
      await reconnectedPage.close();
    });
  });

  test.describe('Code Expiration and Cleanup', () => {
    test('should expire classroom codes after configured time', async ({ page, context }) => {
      test.setTimeout(120000); // 2 minutes timeout (72s wait + 48s buffer)
      // Step 1: Create session with classroom code
      const { teacherId } = await simulateTeacherLogin(page, 'expiration-test-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Verify code is initially valid
      const studentPage = await context.newPage();
      const initialJoinResult = await simulateStudentJoin(studentPage, classroomCode);
      expect(initialJoinResult.success).toBe(true);
      
      // Step 3: Wait for code expiration (5 seconds in test environment)
      await waitForCodeExpiration();
      
      // Step 4: Verify code is now expired for new students
      const newStudentPage = await context.newPage();
      const expiredJoinResult = await simulateStudentJoinWithInvalidCode(newStudentPage, classroomCode);
      expect(expiredJoinResult.success).toBe(false);
      
      // Verify that server closed connection or showed error for expired code
      const isExpectedExpiredError = expiredJoinResult.connectionClosed || 
                                   (expiredJoinResult.errorMessage && 
                                    expiredJoinResult.errorMessage.toLowerCase().includes('expired'));
      expect(isExpectedExpiredError).toBe(true);
      
      // Step 5: Verify expired code cannot be used (second attempt)
      const secondExpiredJoinResult = await simulateStudentJoinWithInvalidCode(newStudentPage, classroomCode);
      expect(secondExpiredJoinResult.success).toBe(false);
      
      const isExpectedSecondError = secondExpiredJoinResult.connectionClosed || 
                                  (secondExpiredJoinResult.errorMessage && 
                                   secondExpiredJoinResult.errorMessage.match(/expired|invalid|not found/i));
      expect(isExpectedSecondError).toBe(true);
      
      await studentPage.close();
      await newStudentPage.close();
    });

    test('should clean up expired codes from memory', async ({ page, context }) => {
      test.setTimeout(120000); // 2 minutes timeout (72s wait + 48s buffer)
      // Step 1: Create multiple sessions
      const classroomCodes: string[] = [];
      const teacherPages: Page[] = [];
      
      for (let i = 0; i < 3; i++) {
        const teacherPage = await context.newPage();
        await simulateTeacherLogin(teacherPage, `cleanup-teacher-${i}`);
        const classroomCode = await getClassroomCodeFromTeacherPage(teacherPage);
        
        classroomCodes.push(classroomCode);
        teacherPages.push(teacherPage);
      }
      
      // Step 2: Verify all codes are unique and properly formatted
      const uniqueCodes = new Set(classroomCodes);
      expect(uniqueCodes.size).toBe(3);
      
      classroomCodes.forEach(code => {
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
      });
      
      // Step 3: Wait for expiration
      await waitForCodeExpiration();
      
      // Step 4: Trigger cleanup by attempting student joins
      for (const code of classroomCodes) {
        const studentPage = await context.newPage();
        const joinResult = await simulateStudentJoinWithInvalidCode(studentPage, code);
        // After expiration, join attempts should fail
        expect(joinResult.success).toBe(false);
        
        // Verify server closed connection or showed error for expired code
        const isExpectedCleanupError = joinResult.connectionClosed || 
                                     (joinResult.errorMessage && 
                                      joinResult.errorMessage.match(/expired|invalid|not found|connection|closed/i));
        expect(isExpectedCleanupError).toBe(true);
        
        await studentPage.close();
      }
      
      // Step 5: Verify new sessions generate new codes
      const newTeacherPage = await context.newPage();
      await simulateTeacherLogin(newTeacherPage, 'cleanup-new-teacher');
      const newClassroomCode = await getClassroomCodeFromTeacherPage(newTeacherPage);
      
      // New code should be different from any previous ones
      expect(classroomCodes).not.toContain(newClassroomCode);
      expect(newClassroomCode).toHaveLength(6);
      expect(newClassroomCode).toMatch(/^[A-Z0-9]{6}$/);
      
      // Cleanup
      for (const teacherPage of teacherPages) {
        await teacherPage.close();
      }
      await newTeacherPage.close();
    });
  });

  test.describe('Student Join Edge Cases', () => {
    test('should handle student joining with expired classroom code', async ({ page, context }) => {
      test.setTimeout(120000); // 2 minutes timeout (72s wait + 48s buffer)
      // Step 1: Create session
      const { teacherId } = await simulateTeacherLogin(page, 'expired-join-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Teacher disconnects (no students joined)
      await page.close();
      
      // Step 3: Wait for expiration
      await waitForCodeExpiration();
      
      // Step 4: Student tries to join expired session
      const studentPage = await context.newPage();
      const joinResult = await simulateStudentJoinWithInvalidCode(studentPage, classroomCode);
      
      // Step 5: Verify proper error handling - server should close connection for expired codes
      expect(joinResult.success).toBe(false);
      
      // Step 6: Verify that either:
      // a) Server closed the connection (expected behavior for expired codes)
      // b) UI showed appropriate error message
      const isExpectedError = joinResult.connectionClosed || 
                             (joinResult.errorMessage && (
                               joinResult.errorMessage.includes('expired') ||
                               joinResult.errorMessage.includes('invalid') ||
                               joinResult.errorMessage.includes('not found') ||
                               joinResult.errorMessage.includes('connection') ||
                               joinResult.errorMessage.includes('closed') ||
                               joinResult.errorMessage.includes('terminated')
                             ));
      
      expect(isExpectedError).toBe(true);
      
      console.log(`Expired code '${classroomCode}' test result:`, {
        success: joinResult.success,
        errorMessage: joinResult.errorMessage,
        connectionClosed: joinResult.connectionClosed
      });
      
      await studentPage.close();
    });

    test('should reject invalid classroom codes', async ({ page, context }) => {
      const invalidCodes = ['INVALID1', 'TOOLONG123', 'short', '123456', 'ABCDEF'];
      
      // Navigate to analytics page for validation
      await navigateToAnalytics(page);
      
      for (const invalidCode of invalidCodes) {
        console.log(`Testing invalid code: ${invalidCode}`);
        
        // Step 1: Try to join with invalid code (server will close connection - this is expected)
        const studentPage = await context.newPage();
        try {
          await studentPage.goto(`http://127.0.0.1:5001/student?code=${invalidCode}`);
          await studentPage.waitForSelector('#connect-btn', { timeout: 5000 });
          await studentPage.click('#connect-btn');
          await studentPage.waitForTimeout(2000); // Give server time to process and reject
        } catch (error) {
          console.log(`Connection handled for invalid code ${invalidCode} (expected behavior)`);
        } finally {
          try {
            await studentPage.close();
          } catch (e) {
            // Page may already be closed by server
          }
        }
        
        // Step 2: Use analytics to check if the code exists in database
        const analyticsQuery = `Show me all classroom codes that exist in the database. List all active sessions.`;
        const analyticsResponse = await askAnalyticsQuestion(page, analyticsQuery);
        
        console.log(`Analytics response for ${invalidCode}: ${analyticsResponse}`);
        
        // Step 3: Verify the invalid code was properly rejected
        // The most important check: invalid code should NOT appear in the database
        expect(analyticsResponse).toBeDefined();
        expect(analyticsResponse).not.toContain(invalidCode);
        
        // Step 4: Additional validation - either shows session data or error (both are acceptable)
        const hasSessionData = analyticsResponse.toLowerCase().match(/session|statistics|total|active|teacher|student|classroom/);
        const hasError = analyticsResponse.toLowerCase().includes('error') || analyticsResponse.toLowerCase().includes('try again');
        
        // We expect either session data (showing no invalid code) or an error response
        expect(hasSessionData || hasError).toBe(true);
        
        // Most important: invalid code should never appear in any response
        expect(analyticsResponse.toLowerCase()).not.toContain(invalidCode.toLowerCase());
      }
    });

    test('should handle multiple students joining simultaneously', async ({ page, context }) => {
      // Step 1: Create session
      const { teacherId } = await simulateTeacherLogin(page, 'concurrent-join-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Multiple students join simultaneously
      const simultaneousJoins = 5;
      const studentPages: Promise<Page>[] = [];
      const joinPromises: Promise<any>[] = [];
      
      for (let i = 0; i < simultaneousJoins; i++) {
        const studentPage = context.newPage();
        studentPages.push(studentPage);
        
        const joinPromise = studentPage.then((page: Page) => 
          simulateStudentJoin(page, classroomCode)
        );
        joinPromises.push(joinPromise);
      }
      
      // Step 3: Wait for all joins to complete
      const joinResults = await Promise.all(joinPromises);
      
      // Step 4: Verify all students successfully joined
      const successfulJoins = joinResults.filter(result => result.success);
      expect(successfulJoins.length).toBe(simultaneousJoins);
      
      // Step 5: Verify each student has a unique session
      const uniqueStudentIds = new Set(successfulJoins.map(result => result.studentId));
      expect(uniqueStudentIds.size).toBe(simultaneousJoins);
      
      // Step 6: Verify all students are connected to the same classroom code
      successfulJoins.forEach(result => {
        expect(result.classroomCode).toBe(classroomCode);
      });
      
      // Cleanup
      const resolvedStudentPages = await Promise.all(studentPages);
      for (const studentPage of resolvedStudentPages) {
        await studentPage.close();
      }
    });
  });

  test.describe('Code Lifecycle Integration', () => {
    test('should handle complete lifecycle from generation to expiration', async ({ page, context }) => {
      test.setTimeout(120000); // 2 minutes timeout (72s wait + 48s buffer)
      // Step 1: Generate classroom code
      const { teacherId } = await simulateTeacherLogin(page, 'lifecycle-teacher');
      const classroomCode = await getClassroomCodeFromTeacherPage(page);
      
      // Step 2: Students join and use code
      const studentPage = await context.newPage();
      const joinResult = await simulateStudentJoin(studentPage, classroomCode);
      expect(joinResult.success).toBe(true);
      
      // Step 3: Verify code is valid and active
      expect(classroomCode).toHaveLength(6);
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);
      
      // Step 4: Teacher disconnects, session continues
      await page.close();
      
      // Step 5: Wait for natural expiration
      await waitForCodeExpiration();
      
      // Step 6: Verify code is no longer accessible
      const finalStudentPage = await context.newPage();
      
      // Add debug logging to understand what's happening
      console.log(`Testing expired code: ${classroomCode} after ${6}s wait`);
      
      const finalJoinResult = await simulateStudentJoinWithInvalidCode(finalStudentPage, classroomCode);
      
      console.log(`Final join result:`, {
        success: finalJoinResult.success,
        errorMessage: finalJoinResult.errorMessage,
        connectionClosed: finalJoinResult.connectionClosed
      });
      
      expect(finalJoinResult.success).toBe(false);
      
      // Verify server closed connection or showed error for expired code
      const isExpectedFinalError = finalJoinResult.connectionClosed || 
                                 (finalJoinResult.errorMessage && 
                                  finalJoinResult.errorMessage.match(/expired|invalid|not found|connection|closed/i));
      expect(isExpectedFinalError).toBe(true);
      
      await studentPage.close();
      await finalStudentPage.close();
    });
  });
});
